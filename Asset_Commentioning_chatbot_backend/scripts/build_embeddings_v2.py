#!/usr/bin/env python3
"""
build_embeddings_v2.py  –  Production Embeddings Pipeline
=========================================================
Reads the updated adani-excel.db, applies the EXACT same math as the
CEO-Tracker UI, and produces:
  1.  data/faiss_index/index.faiss   (vector index)
  2.  data/faiss_index/metadata.pkl  (chunk texts)
  3.  data/embeddings.db             (SQLite mirror of chunks + vectors)

Run:
    cd Asset_Commentioning_chatbot_backend
    python -m scripts.build_embeddings_v2
"""

import sqlite3
import json
import os
import sys
import pickle
import numpy as np
import pandas as pd
import faiss
from dotenv import load_dotenv

# ── Paths ─────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "adani-excel.db")
FAISS_DIR = os.path.join(BASE_DIR, "data", "faiss_index")
INDEX_PATH = os.path.join(FAISS_DIR, "index.faiss")
METADATA_PATH = os.path.join(FAISS_DIR, "metadata.pkl")
EMBEDDINGS_DB = os.path.join(BASE_DIR, "data", "embeddings.db")
DOMAIN_KNOWLEDGE = os.path.join(BASE_DIR, "data", "domain_knowledge.txt")
TARGETS_JSON = os.path.join(BASE_DIR, "data", "targets.json")

# ── Env ───────────────────────────────────────────────────────
load_dotenv(os.path.join(BASE_DIR, ".env"))
MODEL_PATH = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ.setdefault("HF_HUB_DISABLE_SSL_VERIFY", "1")
os.environ.setdefault("CURL_CA_BUNDLE", "")

# ── Month columns (same order as the UI: Apr→Mar) ────────────
MONTH_COLS = [
    "apr", "may", "jun",   # Q1
    "jul", "aug", "sep",   # Q2
    "oct", "nov", "dec",   # Q3
    "jan", "feb", "mar",   # Q4
]

def _safe(val):
    """Coalesce None / NaN to 0."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return 0.0
    return float(val)


def _monthly_sum(row):
    """Exactly mirrors UI: totalCapacity = sum(apr…mar)."""
    return sum(_safe(row.get(m, 0)) for m in MONTH_COLS)


def _quarter_sums(row):
    """Q1=apr+may+jun, Q2=jul+aug+sep, Q3=oct+nov+dec, Q4=jan+feb+mar."""
    q1 = _safe(row.get("apr", 0)) + _safe(row.get("may", 0)) + _safe(row.get("jun", 0))
    q2 = _safe(row.get("jul", 0)) + _safe(row.get("aug", 0)) + _safe(row.get("sep", 0))
    q3 = _safe(row.get("oct", 0)) + _safe(row.get("nov", 0)) + _safe(row.get("dec", 0))
    q4 = _safe(row.get("jan", 0)) + _safe(row.get("feb", 0)) + _safe(row.get("mar", 0))
    return q1, q2, q3, q4


# =================================================================
#  LAYER BUILDERS
# =================================================================

def _layer_1_schema(conn) -> list[str]:
    """Table & column level context."""
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]

    texts = []
    for tbl in tables:
        cursor.execute(f'PRAGMA table_info("{tbl}")')
        col_info = cursor.fetchall()
        cols = [r[1] for r in col_info]
        col_names_set = set(cols)

        # Not every table has is_deleted — use it only if the column exists
        try:
            if "is_deleted" in col_names_set:
                cnt = conn.execute(f'SELECT COUNT(*) FROM "{tbl}" WHERE is_deleted=0').fetchone()[0]
            else:
                cnt = conn.execute(f'SELECT COUNT(*) FROM "{tbl}"').fetchone()[0]
        except Exception:
            cnt = 0

        texts.append(
            f"Table: {tbl}. Columns: {', '.join(cols)}. "
            f"Active rows: {cnt}. "
            f"Use this table for project-level capacity queries."
        )

    # Column-level intelligence
    col_docs = [
        "Column: project_name – name of the commissioning project (e.g., 'Khavda Solar Ph-1').",
        "Column: spv – Special Purpose Vehicle / legal entity for the project.",
        "Column: project_type – values: 'Merchant', 'Group', 'PPA'. NOT used for Solar/Wind classification.",
        "Column: category – determines Solar/Wind type. Solar categories contain 'Solar' (e.g., 'Khavda Solar', 'Rajasthan Solar'). Wind categories contain 'Wind' (e.g., 'Khavda Wind', 'Non-Khavda Wind').",
        "Column: section – 'A' (primary CEO targets), 'B' (supplementary), 'C' (additional), 'D'/'D1'/'D2' (extended).",
        "Column: plan_actual – 'Plan' for targets, 'Actual' for commissioned capacity.",
        "Column: fiscal_year – e.g., 'FY_25-26'.",
        "Column: included_in_total – 1 means included in official CEO-tracker topline, 0 means draft/shadow.",
        "Column: is_deleted – 0 for active rows, 1 for soft-deleted.",
        "Column: capacity – originally entered total capacity (may not match UI; use monthly sum instead).",
        "Column: total_capacity – stored total (may not match UI; use monthly sum instead).",
        "Columns: apr,may,jun,jul,aug,sep,oct,nov,dec,jan,feb,mar – monthly phasing values in MW.",
        "UI MATH RULE: totalCapacity = apr+may+jun+jul+aug+sep+oct+nov+dec+jan+feb+mar.",
        "QUARTER RULE: Q1 = apr+may+jun, Q2 = jul+aug+sep, Q3 = oct+nov+dec, Q4 = jan+feb+mar.",
    ]
    texts.extend(col_docs)
    return texts


def _layer_2_summaries(conn) -> list[str]:
    """Pre-calculated aggregates matching UI math."""
    texts = []

    # Get all distinct fiscal years
    fy_rows = conn.execute(
        "SELECT DISTINCT fiscal_year FROM commissioning_projects WHERE is_deleted=0"
    ).fetchall()
    fiscal_years = [r[0] for r in fy_rows if r[0]]

    for fy in fiscal_years:
        # Get all Plan rows for this FY
        df_all = pd.read_sql_query(
            """
            SELECT project_type, category, section, included_in_total,
                   apr, may, jun, jul, aug, sep, oct, nov, dec, jan, feb, mar
            FROM commissioning_projects
            WHERE is_deleted = 0
              AND plan_actual = 'Plan'
              AND fiscal_year = ?
            """,
            conn,
            params=[fy],
        )

        if df_all.empty:
            continue

        # Compute monthly-sum capacity for each row (UI math)
        df_all["calc_capacity"] = df_all.apply(_monthly_sum, axis=1)

        # ── Overall (included_in_total = 1) ──
        df_inc = df_all[df_all["included_in_total"] == 1]
        overall = df_inc["calc_capacity"].sum()
        solar = df_inc[df_inc["category"].str.contains("Solar", case=False, na=False)]["calc_capacity"].sum()
        wind = df_inc[df_inc["category"].str.contains("Wind", case=False, na=False)]["calc_capacity"].sum()

        texts.append(
            f"FACT: The Total Overall Target Capacity (included_in_total=1) for {fy} is {overall:,.1f} MW. "
            f"This is the sum of all monthly phasing columns for Plan rows."
        )
        texts.append(
            f"FACT: The Total Solar Target (included_in_total=1) for {fy} is {solar:,.1f} MW."
        )
        texts.append(
            f"FACT: The Total Wind Target (included_in_total=1) for {fy} is {wind:,.1f} MW."
        )

        # ── Section-wise breakdown ──
        for sec in sorted(df_inc["section"].dropna().unique()):
            df_sec = df_inc[df_inc["section"] == sec]
            sec_total = df_sec["calc_capacity"].sum()
            sec_solar = df_sec[df_sec["category"].str.contains("Solar", case=False, na=False)]["calc_capacity"].sum()
            sec_wind = df_sec[df_sec["category"].str.contains("Wind", case=False, na=False)]["calc_capacity"].sum()
            texts.append(
                f"FACT: Section {sec} Target for {fy}: Total={sec_total:,.1f} MW, "
                f"Solar={sec_solar:,.1f} MW, Wind={sec_wind:,.1f} MW."
            )

        # ── Category-wise breakdown ──
        for cat, grp in df_inc.groupby("category"):
            cat_total = grp["calc_capacity"].sum()
            texts.append(
                f"FACT: Category '{cat}' Target for {fy} is {cat_total:,.1f} MW "
                f"(included_in_total=1, Plan)."
            )

        # ── Quarter-wise aggregates ──
        q_cols = {"Q1": ["apr", "may", "jun"], "Q2": ["jul", "aug", "sep"],
                  "Q3": ["oct", "nov", "dec"], "Q4": ["jan", "feb", "mar"]}
        for qname, months in q_cols.items():
            q_val = sum(df_inc[m].apply(_safe).sum() for m in months)
            texts.append(
                f"FACT: {qname} Total Target for {fy} is {q_val:,.1f} MW (all types, included_in_total=1)."
            )
            for ptype in ["Solar", "Wind"]:
                df_t = df_inc[df_inc["category"].str.contains(ptype, case=False, na=False)]
                q_t = sum(df_t[m].apply(_safe).sum() for m in months)
                texts.append(
                    f"FACT: {qname} {ptype} Target for {fy} is {q_t:,.1f} MW."
                )

        # ── Actual vs Plan (if Actual rows exist) ──
        df_act = pd.read_sql_query(
            """
            SELECT project_type, category,
                   apr, may, jun, jul, aug, sep, oct, nov, dec, jan, feb, mar
            FROM commissioning_projects
            WHERE is_deleted = 0
              AND plan_actual = 'Actual'
              AND fiscal_year = ?
            """,
            conn,
            params=[fy],
        )
        if not df_act.empty:
            df_act["calc_capacity"] = df_act.apply(_monthly_sum, axis=1)
            actual_total = df_act["calc_capacity"].sum()
            variance = actual_total - overall
            texts.append(
                f"FACT: Actual Commissioned for {fy} is {actual_total:,.1f} MW. "
                f"Variance (Actual - Plan) = {variance:,.1f} MW."
            )

    return texts


def _layer_3_projects(conn) -> list[str]:
    """Individual project-level embeddings."""
    texts = []
    df = pd.read_sql_query(
        """
        SELECT project_name, spv, project_type, category, section,
               plan_actual, fiscal_year, included_in_total,
               apr, may, jun, jul, aug, sep, oct, nov, dec, jan, feb, mar
        FROM commissioning_projects
        WHERE is_deleted = 0
        """,
        conn,
    )

    for _, row in df.iterrows():
        cap = _monthly_sum(row)
        q1, q2, q3, q4 = _quarter_sums(row)
        incl = "Yes" if row["included_in_total"] == 1 else "No"
        texts.append(
            f"Project '{row['project_name']}' | SPV: {row['spv']} | "
            f"Type: {row['project_type']} | Category: {row['category']} | "
            f"Section: {row['section']} | {row['plan_actual']} | "
            f"FY: {row['fiscal_year']} | "
            f"Capacity: {cap:,.1f} MW (Q1={q1:,.1f}, Q2={q2:,.1f}, Q3={q3:,.1f}, Q4={q4:,.1f}) | "
            f"Included in Total: {incl}"
        )

        # Also create a QA-style duplicate for better semantic match
        texts.append(
            f"The capacity of {row['project_name']} ({row['plan_actual']}) for "
            f"{row['fiscal_year']} is {cap:,.1f} MW."
        )

    return texts


def _layer_4_domain_knowledge() -> list[str]:
    """Domain knowledge and calculation rules from files."""
    texts = []

    if os.path.exists(DOMAIN_KNOWLEDGE):
        with open(DOMAIN_KNOWLEDGE, "r", encoding="utf-8") as f:
            content = f.read()
        sections = content.split("🔹")
        for s in sections:
            s = s.strip()
            if s:
                texts.append(f"DOMAIN RULE: {s}")

    if os.path.exists(TARGETS_JSON):
        with open(TARGETS_JSON, "r") as f:
            targets = json.load(f)
        for t in targets:
            rule = t.get("calculation_rule", "")
            texts.append(
                f"CALCULATION RULE for {t['metric']} ({t['category']}): "
                f"{t['description']}. SQL: {rule}"
            )

    return texts


def _layer_5_ui_math_rules() -> list[str]:
    """Hard-coded rules that encode the UI calculation logic."""
    return [
        "CRITICAL RULE: The UI calculates totalCapacity as the SUM of all 12 monthly columns: "
        "apr+may+jun+jul+aug+sep+oct+nov+dec+jan+feb+mar. This is the ONLY correct way to compute capacity.",

        "CRITICAL RULE: Q1 = apr + may + jun. Q2 = jul + aug + sep. "
        "Q3 = oct + nov + dec. Q4 = jan + feb + mar.",

        "CRITICAL RULE: To get the Total Target, SUM the monthly columns for all rows WHERE "
        "plan_actual='Plan' AND included_in_total=1 AND is_deleted=0.",

        "CRITICAL RULE: Solar projects have project_type='Solar'. "
        "Wind projects have project_type='Wind'. Do NOT use category LIKE for type filtering.",

        "CRITICAL RULE: The 'total_capacity' column in the database may be stale. "
        "Always compute capacity from the 12 monthly columns to match the UI exactly.",

        "CRITICAL RULE: included_in_total=1 means the project counts towards the CEO Tracker topline. "
        "Always apply this filter when computing targets unless the user asks for ALL projects.",

        "CRITICAL RULE: plan_actual='Plan' rows are targets. plan_actual='Actual' rows are commissioned. "
        "Variance = Actual - Plan.",

        "CRITICAL RULE: If the database returns NULL or 0, report 'No data found' or '0 MW'. "
        "NEVER fabricate or estimate a number.",
    ]


# =================================================================
#  EMBEDDINGS DB (SQLite storage)
# =================================================================

def _save_to_embeddings_db(texts: list[str], embeddings: np.ndarray):
    """Save chunks and their vectors to a SQLite database."""
    if os.path.exists(EMBEDDINGS_DB):
        os.remove(EMBEDDINGS_DB)

    conn = sqlite3.connect(EMBEDDINGS_DB)
    conn.execute("""
        CREATE TABLE chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chunk_text TEXT NOT NULL,
            vector BLOB NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    for i, (text, vec) in enumerate(zip(texts, embeddings)):
        conn.execute(
            "INSERT INTO chunks (chunk_text, vector) VALUES (?, ?)",
            (text, vec.tobytes()),
        )

    conn.execute(
        "INSERT INTO metadata (key, value) VALUES (?, ?)",
        ("total_chunks", str(len(texts))),
    )
    conn.execute(
        "INSERT INTO metadata (key, value) VALUES (?, ?)",
        ("embedding_dim", str(embeddings.shape[1])),
    )
    conn.commit()
    conn.close()
    print(f"  ✅ Embeddings DB saved to: {EMBEDDINGS_DB}")


# =================================================================
#  MAIN BUILD
# =================================================================

def build():
    print("=" * 60)
    print("  EMBEDDINGS PIPELINE V2 – Production Build")
    print("=" * 60)

    if not os.path.exists(DB_PATH):
        print(f"❌ FATAL: Database not found at {DB_PATH}")
        sys.exit(1)

    print(f"  DB:    {DB_PATH}")
    print(f"  Model: {MODEL_PATH}")

    # Load embedding model
    print("\n[1/7] Loading embedding model...")
    from sentence_transformers import SentenceTransformer

    if os.path.exists(MODEL_PATH):
        print(f"  Loading from local path: {MODEL_PATH}")
        model = SentenceTransformer(MODEL_PATH)
    else:
        print(f"  Loading from Hub: {MODEL_PATH}")
        model = SentenceTransformer(MODEL_PATH)

    conn = sqlite3.connect(DB_PATH)

    # Build layers
    print("\n[2/7] Building Layer 1: Schema Intelligence...")
    l1 = _layer_1_schema(conn)
    print(f"  → {len(l1)} chunks")

    print("\n[3/7] Building Layer 2: Pre-calculated Summaries (UI Math)...")
    l2 = _layer_2_summaries(conn)
    print(f"  → {len(l2)} chunks")

    print("\n[4/7] Building Layer 3: Project-level Embeddings...")
    l3 = _layer_3_projects(conn)
    print(f"  → {len(l3)} chunks")

    print("\n[5/7] Building Layer 4: Domain Knowledge & Rules...")
    l4 = _layer_4_domain_knowledge()
    print(f"  → {len(l4)} chunks")

    print("\n[5.5/7] Building Layer 5: UI Math Hard Rules...")
    l5 = _layer_5_ui_math_rules()
    print(f"  → {len(l5)} chunks")

    conn.close()

    all_texts = l1 + l2 + l3 + l4 + l5
    print(f"\n  TOTAL CHUNKS: {len(all_texts)}")

    # Embed
    print("\n[6/7] Encoding embeddings...")
    embeddings = model.encode(all_texts, show_progress_bar=True, normalize_embeddings=True)

    # FAISS Index
    print("\n[7/7] Building FAISS index...")
    os.makedirs(FAISS_DIR, exist_ok=True)
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatIP(dimension)  # Inner product (cosine sim with normalized vecs)
    index.add(embeddings.astype(np.float32))

    faiss.write_index(index, INDEX_PATH)
    with open(METADATA_PATH, "wb") as f:
        pickle.dump(all_texts, f)
    print(f"  ✅ FAISS index saved: {INDEX_PATH}")
    print(f"  ✅ Metadata saved:    {METADATA_PATH}")

    # SQLite embeddings DB
    _save_to_embeddings_db(all_texts, embeddings)

    print("\n" + "=" * 60)
    print(f"  ✅ BUILD COMPLETE — {len(all_texts)} chunks indexed")
    print("=" * 60)


if __name__ == "__main__":
    build()
