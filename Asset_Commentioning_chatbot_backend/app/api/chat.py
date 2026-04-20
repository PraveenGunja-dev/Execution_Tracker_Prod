"""
chat.py  –  Zero-Hallucination Chatbot API
===========================================
Architecture:
  1. Intent classification (keyword-based, NO LLM)
  2. Deterministic SQL execution (pre-defined templates matching UI math)
  3. RAG retrieval for context enrichment
  4. LLM used ONLY for formatting the final answer

DB FACTS (from diagnostic):
  - project_type values: 'Merchant', 'Group', 'PPA'  (NOT 'Solar'/'Wind')
  - Solar/Wind is determined by the CATEGORY column:
      Solar → category LIKE '%Solar%'
      Wind  → category LIKE '%Wind%'
  - plan_actual values: 'Plan', 'Actual', 'Rephase'
  - sections: 'A', 'B', 'C', 'D', 'D1', 'D2'
  - fiscal_year values: 'FY_25-26', 'FY_26-27'
"""

import faiss
import pickle
import os
import re
import sqlite3
import numpy as np
import pandas as pd
from typing import Optional
from fastapi import APIRouter
from app.models.schemas import ChatRequest, ChatResponse
from app.llm.llm_factory import generate
from app.core.config import settings

router = APIRouter()

# ── Module globals ────────────────────────────────────────────
_index = None
_metadata = []
_model = None

# ── Paths ─────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "data", "adani-excel.db")
INDEX_PATH = os.path.join(BASE_DIR, "data", "faiss_index", "index.faiss")
METADATA_PATH = os.path.join(BASE_DIR, "data", "faiss_index", "metadata.pkl")

# ── Month columns (same as UI) ───────────────────────────────
MONTH_COLS = ["apr", "may", "jun", "jul", "aug", "sep",
              "oct", "nov", "dec", "jan", "feb", "mar"]

# ── The capacity formula (matches the UI exactly) ────────────
CAPACITY_EXPR = " + ".join(f"COALESCE({m}, 0)" for m in MONTH_COLS)

Q1_EXPR = "COALESCE(apr,0) + COALESCE(may,0) + COALESCE(jun,0)"
Q2_EXPR = "COALESCE(jul,0) + COALESCE(aug,0) + COALESCE(sep,0)"
Q3_EXPR = "COALESCE(oct,0) + COALESCE(nov,0) + COALESCE(dec,0)"
Q4_EXPR = "COALESCE(jan,0) + COALESCE(feb,0) + COALESCE(mar,0)"

# ── Standard WHERE fragments ─────────────────────────────────
BASE_FILTER = "is_deleted = 0"
PLAN_FILTER = f"{BASE_FILTER} AND plan_actual = 'Plan'"
ACTUAL_FILTER = f"{BASE_FILTER} AND plan_actual = 'Actual'"
TARGET_FILTER = f"{PLAN_FILTER} AND included_in_total = 1"

# ── Type detection via CATEGORY (the actual DB pattern) ──────
SOLAR_CONDITION = "LOWER(category) LIKE '%solar%'"
WIND_CONDITION  = "LOWER(category) LIKE '%wind%'"

# ── Month mapping for cumulative calculations ────────────────
# Fiscal year order: Apr → Mar
MONTH_ORDER = ["apr", "may", "jun", "jul", "aug", "sep",
               "oct", "nov", "dec", "jan", "feb", "mar"]
MONTH_NAME_MAP = {
    "april": "apr", "apr": "apr",
    "may": "may",
    "june": "jun", "jun": "jun",
    "july": "jul", "jul": "jul",
    "august": "aug", "aug": "aug",
    "september": "sep", "sep": "sep", "sept": "sep",
    "october": "oct", "oct": "oct",
    "november": "nov", "nov": "nov",
    "december": "dec", "dec": "dec",
    "january": "jan", "jan": "jan",
    "february": "feb", "feb": "feb",
    "march": "mar", "mar": "mar",
}
MONTH_DISPLAY = {
    "apr": "April", "may": "May", "jun": "June", "jul": "July",
    "aug": "August", "sep": "September", "oct": "October",
    "nov": "November", "dec": "December", "jan": "January",
    "feb": "February", "mar": "March",
}


# =================================================================
#  RAG RESOURCE LOADING
# =================================================================

def _load_rag():
    global _index, _metadata, _model

    os.environ.setdefault("HF_HUB_DISABLE_SSL_VERIFY", "1")
    os.environ.setdefault("CURL_CA_BUNDLE", "")

    if not (os.path.exists(INDEX_PATH) and os.path.exists(METADATA_PATH)):
        print("[RAG] Index not found — attempting auto-build …")
        from app.rag_auto import build_index
        if not build_index():
            print("[RAG] Auto-build failed. RAG disabled.")
            return

    _index = faiss.read_index(INDEX_PATH)
    with open(METADATA_PATH, "rb") as f:
        _metadata = pickle.load(f)

    model_name = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    from sentence_transformers import SentenceTransformer
    _model = SentenceTransformer(model_name)
    print(f"[RAG] Loaded: {_index.ntotal} vectors, model={model_name}")


_load_rag()


# =================================================================
#  INTENT CLASSIFIER  (pure keyword, no LLM)
# =================================================================

def _extract_fy(q: str) -> str:
    """Extract fiscal year from query, default to settings.DEFAULT_FY."""
    m = re.search(r"fy\s*_?\s*(\d{2})\s*[-–]\s*(\d{2})", q, re.IGNORECASE)
    if m:
        return f"FY_{m.group(1)}-{m.group(2)}"
    # Check for "26-27" or "2025-26" patterns without FY prefix
    m2 = re.search(r"(\d{2})\s*[-–]\s*(\d{2})", q)
    if m2:
        return f"FY_{m2.group(1)}-{m2.group(2)}"
    return settings.DEFAULT_FY


def _extract_project_name(q: str) -> Optional[str]:
    """Try to extract a project name from the query."""
    # Look for quoted names first
    m = re.search(r"['\"](.+?)['\"]", q)
    if m:
        return m.group(1)

    # Common project name patterns
    patterns = [
        r"(?:capacity|target|status)\s+(?:of|for)\s+(.+?)(?:\?|$|\s+(?:in|for|during))",
        r"(?:project)\s+(.+?)(?:\?|$|\s+(?:in|for|during|capacity|target))",
        r"(?:about)\s+(.+?)(?:\?|$)",
    ]
    for pat in patterns:
        m = re.search(pat, q, re.IGNORECASE)
        if m:
            name = m.group(1).strip().rstrip("?.,")
            # Filter out generic words and energy types
            generic = {"solar", "wind", "total", "overall", "the", "all", "each",
                       "target", "capacity", "plan", "actual", "energy",
                       "full year", "quarterly", "monthly", "cumulative",
                       "cumm", "status", "variance", "breakdown"}
            if name.lower() in generic or len(name) <= 2:
                continue
            # Filter out fiscal year patterns (e.g., fy26-27, FY_25-26, 25-26)
            if re.match(r"^(?:fy)?[_\s]?\d{2,4}[-–]\d{2,4}$", name, re.IGNORECASE):
                continue
            # Filter out month names (e.g., "jan", "january", "feb")
            if name.lower().strip() in MONTH_NAME_MAP:
                continue
            # Filter out FY + month combos (e.g., "jan fy 26-27")
            if re.match(r"^\w{3,9}\s+(?:fy)?[_\s]?\d{2,4}[-–]\d{2,4}$", name, re.IGNORECASE):
                continue
            return name
    return None


def _detect_energy_type(q: str) -> Optional[str]:
    """Detect if user is asking about Solar or Wind from the query text."""
    ql = q.lower()
    if "solar" in ql:
        return "solar"
    if "wind" in ql:
        return "wind"
    return None


def _extract_month(q: str) -> Optional[str]:
    """Extract a month name from the query and return its short form."""
    ql = q.lower()
    for name, short in MONTH_NAME_MAP.items():
        # Match the month name as a whole word
        if re.search(r'\b' + re.escape(name) + r'\b', ql):
            return short
    return None


def _classify_intent(q: str) -> dict:
    """
    Classify user question into an intent with parameters.
    Returns: {"intent": str, "fy": str, ...}
    """
    ql = q.lower().strip()
    fy = _extract_fy(q)
    energy_type = _detect_energy_type(q)
    result = {"fy": fy, "raw_query": q, "energy_type": energy_type}

    # ── Greetings / non-data ──
    if any(g in ql for g in ["hello", "hi ", "hey", "good morning", "good evening",
                              "hi,", "hi!", "hey!", "thank"]):
        result["intent"] = "greeting"
        return result

    # ── Help / how-to ──
    if any(h in ql for h in ["how do i", "how can i", "how to", "help me",
                              "explain", "what can you"]):
        result["intent"] = "help"
        return result

    # ── Cumulative Actual (must be checked BEFORE plan_vs_actual) ──
    if any(kw in ql for kw in ["cumm", "cumul", "cummul", "cumalt", "cumal",
                                "cumilat", "cummilat", "status as of",
                                "commissioned till", "actual till", "actual as of",
                                "actual upto", "actual up to"]):
        result["intent"] = "cumulative_actual"
        month = _extract_month(q)
        if month:
            result["as_of_month"] = month
        return result

    # ── Plan vs Actual / Variance / Achievement ──
    if ("actual" in ql and ("plan" in ql or "target" in ql)) or \
       "variance" in ql or "gap" in ql or "achievement" in ql:
        result["intent"] = "plan_vs_actual"
        return result

    # ── Quarterly ──
    if any(qw in ql for qw in ["quarter", "quarterly", " q1", " q2", " q3", " q4",
                                 "q1 ", "q2 ", "q3 ", "q4 ", "q1?", "q2?", "q3?", "q4?"]):
        result["intent"] = "quarterly"
        qm = re.search(r"\bq([1-4])\b", ql)
        if qm:
            result["specific_quarter"] = int(qm.group(1))
        # Check for "till [month]" pattern
        till_match = re.search(r"\b(?:till|until|upto|up to|as of)\s+(\w+)", ql)
        if till_match:
            month = _extract_month(till_match.group(1))
            if month:
                result["till_month"] = month
        return result

    # ── Category breakdown ──
    if any(c in ql for c in ["category", "categories", "breakdown", "bifurcation",
                              "split", "group by", "segment", "wise"]):
        result["intent"] = "category_breakdown"
        return result

    # ── Section-specific ──
    sec_match = re.search(r"\bsection\s*([a-dA-D]\d?)\b", ql, re.IGNORECASE)
    if sec_match:
        result["section"] = sec_match.group(1).upper()
        result["intent"] = "section_target"
        return result

    if "capacity by section" in ql or "section wise" in ql or "section-wise" in ql:
        result["intent"] = "section_breakdown"
        return result

    # ── Project list ──
    if any(p in ql for p in ["list all", "all projects", "show projects",
                              "project list", "how many projects", "count project",
                              "number of projects"]):
        result["intent"] = "project_list"
        return result

    # ── Location / specific category ──
    location_keywords = {
        "khavda": "Khavda", "rajasthan": "Rajasthan", "mundra": "Mundra",
        "muppandal": "Muppandal", "kayathar": "Kayathar",
        "non-khavda": "Non-Khavda", "non khavda": "Non-Khavda"
    }
    for kw, loc in location_keywords.items():
        if kw in ql:
            # If it's "khavda solar target" → location + solar
            result["intent"] = "location_target"
            result["location"] = loc
            return result

    # ── Solar total ──
    if energy_type == "solar" and any(t in ql for t in [
        "total", "target", "capacity", "how much", "what is", "full year"
    ]):
        result["intent"] = "solar_target"
        return result

    # ── Wind total ──
    if energy_type == "wind" and any(t in ql for t in [
        "total", "target", "capacity", "how much", "what is", "full year"
    ]):
        result["intent"] = "wind_target"
        return result

    # ── Overall total ──
    if any(t in ql for t in ["total target", "total capacity", "overall target",
                              "overall capacity", "fy target", "current target",
                              "what is the target", "current fy", "full year target"]):
        result["intent"] = "total_target"
        return result

    # ── Specific project (AFTER solar/wind/total checks) ──
    proj_name = _extract_project_name(q)
    if proj_name:
        result["intent"] = "project_detail"
        result["project_name"] = proj_name
        return result

    # ── Monthly ──
    if any(m in ql for m in ["monthly", "month wise", "month-wise", "monthwise"]):
        result["intent"] = "monthly"
        return result

    # ── Fallback: general RAG ──
    result["intent"] = "general"
    return result


# =================================================================
#  SQL EXECUTORS  (deterministic, UI-math, category-based typing)
# =================================================================

def _db_query(sql: str, params: tuple = ()) -> pd.DataFrame:
    """Execute a read-only SQL query against the data DB."""
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database not found: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    try:
        df = pd.read_sql_query(sql, conn, params=params)
        return df
    finally:
        conn.close()


def _energy_type_condition(energy_type: Optional[str]) -> str:
    """Return SQL WHERE clause fragment for Solar/Wind based on CATEGORY."""
    if energy_type == "solar":
        return f" AND {SOLAR_CONDITION}"
    elif energy_type == "wind":
        return f" AND {WIND_CONDITION}"
    return ""


def _total_target(fy: str, energy_type: str = None, section: str = None) -> str:
    """Total target capacity matching UI math."""
    where = f"WHERE {TARGET_FILTER} AND fiscal_year = ?"
    params = [fy]
    where += _energy_type_condition(energy_type)
    if section:
        where += " AND section = ?"
        params.append(section)

    sql = f"SELECT SUM({CAPACITY_EXPR}) as total FROM commissioning_projects {where}"
    df = _db_query(sql, tuple(params))
    val = df.iloc[0]["total"]
    if val is None or pd.isna(val):
        return "0"
    return f"{val:,.1f}"


def _project_detail(fy: str, project_name: str) -> str:
    """Get details for a specific project."""
    sql = f"""
        SELECT project_name, spv, project_type, category, section,
               plan_actual, included_in_total,
               ({CAPACITY_EXPR}) as capacity,
               ({Q1_EXPR}) as q1, ({Q2_EXPR}) as q2,
               ({Q3_EXPR}) as q3, ({Q4_EXPR}) as q4
        FROM commissioning_projects
        WHERE {BASE_FILTER} AND fiscal_year = ?
          AND LOWER(project_name) LIKE LOWER(?)
    """
    df = _db_query(sql, (fy, f"%{project_name}%"))
    if df.empty:
        return f"No project matching '{project_name}' found for {fy}."
    return df.to_string(index=False)


def _category_breakdown(fy: str, energy_type: str = None) -> str:
    """Category-wise breakdown."""
    where = f"WHERE {TARGET_FILTER} AND fiscal_year = ?"
    params = [fy]
    where += _energy_type_condition(energy_type)

    sql = f"""
        SELECT category,
               COUNT(*) as projects,
               ROUND(SUM({CAPACITY_EXPR}), 1) as total_capacity_mw
        FROM commissioning_projects
        {where}
        GROUP BY category
        ORDER BY total_capacity_mw DESC
    """
    df = _db_query(sql, tuple(params))
    if df.empty:
        return "No data found for the given filters."
    grand_total = df["total_capacity_mw"].sum()
    return f"Category-wise Target for {fy} (Grand Total: {grand_total:,.1f} MW):\n\n{df.to_string(index=False)}"


def _quarterly(fy: str, energy_type: str = None, specific_q: int = None, till_month: str = None) -> str:
    """
    Quarterly capacity breakdown.
    Uses the stored q1/q2/q3/q4 columns from DB (same as UI).
    Optionally filters to show only quarters up to a specified month.
    """
    where = f"WHERE {TARGET_FILTER} AND fiscal_year = ?"
    params = [fy]
    where += _energy_type_condition(energy_type)

    # Use stored q1, q2, q3, q4 columns (matches UI exactly)
    sql = f"""
        SELECT
            ROUND(SUM(COALESCE(q1, 0)), 1) as Q1_MW,
            ROUND(SUM(COALESCE(q2, 0)), 1) as Q2_MW,
            ROUND(SUM(COALESCE(q3, 0)), 1) as Q3_MW,
            ROUND(SUM(COALESCE(q4, 0)), 1) as Q4_MW
        FROM commissioning_projects
        {where}
    """
    df = _db_query(sql, tuple(params))
    if df.empty:
        return "No quarterly data found."

    q_values = {
        1: float(df.iloc[0]["Q1_MW"] or 0),
        2: float(df.iloc[0]["Q2_MW"] or 0),
        3: float(df.iloc[0]["Q3_MW"] or 0),
        4: float(df.iloc[0]["Q4_MW"] or 0),
    }

    # Determine which quarters to show based on "till month"
    # Quarter mapping: Q1=apr-jun, Q2=jul-sep, Q3=oct-dec, Q4=jan-mar
    MONTH_TO_QUARTER = {
        "apr": 1, "may": 1, "jun": 1,
        "jul": 2, "aug": 2, "sep": 2,
        "oct": 3, "nov": 3, "dec": 3,
        "jan": 4, "feb": 4, "mar": 4,
    }

    max_quarter = 4  # default: show all quarters
    if till_month and till_month in MONTH_TO_QUARTER:
        max_quarter = MONTH_TO_QUARTER[till_month]

    type_label = f" {energy_type.title()}" if energy_type else ""
    till_label = f" (till {MONTH_DISPLAY.get(till_month, '')})" if till_month else ""

    lines = [f"Quarterly{type_label} Target for {fy}{till_label}:\n"]
    total = 0
    for qi in range(1, max_quarter + 1):
        val = q_values[qi]
        lines.append(f"Q{qi}: {val:,.1f} MW")
        total += val
    lines.append(f"\nTotal (Q1-Q{max_quarter}): {total:,.1f} MW")

    return "\n".join(lines)


def _plan_vs_actual(fy: str, energy_type: str = None) -> str:
    """Plan vs Actual variance."""
    type_cond = _energy_type_condition(energy_type)

    plan_sql = f"""
        SELECT ROUND(SUM({CAPACITY_EXPR}), 1) as plan_total
        FROM commissioning_projects
        WHERE {TARGET_FILTER} AND fiscal_year = ?{type_cond}
    """
    actual_sql = f"""
        SELECT ROUND(SUM({CAPACITY_EXPR}), 1) as actual_total
        FROM commissioning_projects
        WHERE {ACTUAL_FILTER} AND fiscal_year = ?{type_cond}
    """
    df_p = _db_query(plan_sql, (fy,))
    df_a = _db_query(actual_sql, (fy,))

    plan_val = df_p.iloc[0]["plan_total"]
    actual_val = df_a.iloc[0]["actual_total"]
    plan_val = 0 if plan_val is None or pd.isna(plan_val) else plan_val
    actual_val = 0 if actual_val is None or pd.isna(actual_val) else actual_val
    variance = actual_val - plan_val

    type_label = f" {energy_type.title()}" if energy_type else ""
    return (
        f"{type_label} Plan vs Actual for {fy}:\n"
        f"Plan (Target): {plan_val:,.1f} MW\n"
        f"Actual (Commissioned): {actual_val:,.1f} MW\n"
        f"Variance: {variance:,.1f} MW\n"
        f"{'Over-performance ✅' if variance >= 0 else 'Under-performance ⚠️'}"
    )


def _cumulative_actual(fy: str, as_of_month: str = None, energy_type: str = None) -> str:
    """
    Cumulative Actual: sum of Actual months from Apr up to the specified month.
    This matches the UI's 'CUMM. ACTUAL — STATUS AS OF [month]' card.
    """
    # Default to latest month with data if none specified
    if as_of_month and as_of_month in MONTH_ORDER:
        end_idx = MONTH_ORDER.index(as_of_month)
    else:
        # Auto-detect: find the last month with non-zero actual data
        as_of_month = None
        end_idx = len(MONTH_ORDER) - 1  # default to full year

    # Build cumulative expression: sum from apr to the target month
    cumulative_months = MONTH_ORDER[:end_idx + 1]
    cumm_expr = " + ".join(f"COALESCE({m}, 0)" for m in cumulative_months)
    month_display = MONTH_DISPLAY.get(MONTH_ORDER[end_idx], MONTH_ORDER[end_idx].title())

    type_cond = _energy_type_condition(energy_type)

    # Cumulative Actual (also filter by included_in_total to match UI)
    actual_sql = f"""
        SELECT ROUND(SUM({cumm_expr}), 1) as cumm_actual
        FROM commissioning_projects
        WHERE {ACTUAL_FILTER} AND included_in_total = 1 AND fiscal_year = ?{type_cond}
    """
    df_a = _db_query(actual_sql, (fy,))
    actual_val = df_a.iloc[0]["cumm_actual"]
    actual_val = 0 if actual_val is None or pd.isna(actual_val) else actual_val

    # Full year Plan Target (for context)
    plan_sql = f"""
        SELECT ROUND(SUM({CAPACITY_EXPR}), 1) as plan_total
        FROM commissioning_projects
        WHERE {TARGET_FILTER} AND fiscal_year = ?{type_cond}
    """
    df_p = _db_query(plan_sql, (fy,))
    plan_val = df_p.iloc[0]["plan_total"]
    plan_val = 0 if plan_val is None or pd.isna(plan_val) else plan_val

    # Achievement %
    pct = (actual_val / plan_val * 100) if plan_val > 0 else 0

    type_label = f" {energy_type.title()}" if energy_type else ""
    months_counted = ", ".join(m.title() for m in cumulative_months)

    return (
        f"Cumulative{type_label} Actual for {fy} (Status as of {month_display}):\n"
        f"Cumulative Actual (Apr to {month_display}): {actual_val:,.1f} MW\n"
        f"Full Year Target: {plan_val:,.1f} MW\n"
        f"Achievement: {pct:.1f}%\n"
        f"Months counted: {months_counted}"
    )


def _project_list(fy: str, energy_type: str = None) -> str:
    """List all projects with capacity."""
    where = f"WHERE {TARGET_FILTER} AND fiscal_year = ?"
    params = [fy]
    where += _energy_type_condition(energy_type)

    sql = f"""
        SELECT project_name, project_type, category, section,
               ROUND({CAPACITY_EXPR}, 1) as capacity_mw
        FROM commissioning_projects
        {where}
        ORDER BY category, project_name
    """
    df = _db_query(sql, tuple(params))
    if df.empty:
        return "No projects found."
    count = len(df)
    total = df["capacity_mw"].sum()
    type_label = f" {energy_type.title()}" if energy_type else ""
    return f"Found {count}{type_label} projects for {fy} (Total: {total:,.1f} MW):\n\n{df.to_string(index=False)}"


def _location_target(fy: str, location: str, energy_type: str = None) -> str:
    """Capacity for a specific location/category."""
    type_cond = _energy_type_condition(energy_type)
    sql = f"""
        SELECT category,
               COUNT(*) as projects,
               ROUND(SUM({CAPACITY_EXPR}), 1) as total_capacity_mw
        FROM commissioning_projects
        WHERE {TARGET_FILTER} AND fiscal_year = ?
          AND LOWER(category) LIKE LOWER(?){type_cond}
        GROUP BY category
        ORDER BY total_capacity_mw DESC
    """
    like = f"%{location}%"
    df = _db_query(sql, (fy, like))
    if df.empty:
        return f"No projects found matching location '{location}' for {fy}."
    total = df["total_capacity_mw"].sum()
    return f"Location '{location}' — Total: {total:,.1f} MW for {fy}:\n\n{df.to_string(index=False)}"


def _section_target(fy: str, section: str, energy_type: str = None) -> str:
    """Capacity for a specific section."""
    type_cond = _energy_type_condition(energy_type)
    sql = f"""
        SELECT section, category,
               COUNT(*) as projects,
               ROUND(SUM({CAPACITY_EXPR}), 1) as total_capacity_mw
        FROM commissioning_projects
        WHERE {TARGET_FILTER} AND fiscal_year = ?
          AND section = ?{type_cond}
        GROUP BY category
        ORDER BY total_capacity_mw DESC
    """
    df = _db_query(sql, (fy, section))
    if df.empty:
        return f"No projects found for Section {section} in {fy}."
    total = df["total_capacity_mw"].sum()
    type_label = f" {energy_type.title()}" if energy_type else ""
    return f"Section {section}{type_label} Target for {fy}: {total:,.1f} MW\n\n{df.to_string(index=False)}"


def _section_breakdown(fy: str, energy_type: str = None) -> str:
    """Breakdown by all sections."""
    type_cond = _energy_type_condition(energy_type)
    sql = f"""
        SELECT section,
               COUNT(*) as projects,
               ROUND(SUM({CAPACITY_EXPR}), 1) as total_capacity_mw
        FROM commissioning_projects
        WHERE {TARGET_FILTER} AND fiscal_year = ?{type_cond}
        GROUP BY section
        ORDER BY section
    """
    df = _db_query(sql, (fy,))
    if df.empty:
        return "No section data found."
    total = df["total_capacity_mw"].sum()
    type_label = f" {energy_type.title()}" if energy_type else ""
    return f"Section-wise{type_label} Target for {fy} (Total: {total:,.1f} MW):\n\n{df.to_string(index=False)}"


def _monthly(fy: str, energy_type: str = None) -> str:
    """Monthly capacity breakdown."""
    where = f"WHERE {TARGET_FILTER} AND fiscal_year = ?"
    params = [fy]
    where += _energy_type_condition(energy_type)

    month_sums = ", ".join(f"ROUND(SUM(COALESCE({m},0)), 1) as {m}" for m in MONTH_COLS)
    sql = f"""
        SELECT {month_sums}
        FROM commissioning_projects
        {where}
    """
    df = _db_query(sql, tuple(params))
    if df.empty:
        return "No monthly data found."
    type_label = f" {energy_type.title()}" if energy_type else ""
    return f"Monthly{type_label} Target for {fy}:\n\n{df.to_string(index=False)}"


# =================================================================
#  RAG RETRIEVAL
# =================================================================

def _retrieve_context(query: str, top_k: int = 5) -> str:
    """Retrieve semantically relevant chunks from FAISS."""
    if _index is None or _model is None:
        return ""
    qvec = _model.encode([query], normalize_embeddings=True)
    D, I = _index.search(qvec.astype(np.float32), top_k)
    chunks = []
    for i in I[0]:
        if 0 <= i < len(_metadata):
            chunks.append(_metadata[i])
    return "\n".join(chunks)


# =================================================================
#  LLM FORMATTING (the ONLY place where LLM is used)
# =================================================================

def _format_answer(query: str, data_result: str, context: str = "") -> str:
    """
    Use LLM ONLY to format the raw data result into a professional answer.
    The LLM is NEVER allowed to compute or infer numbers.
    """
    prompt = f"""You are a professional CXO-level Analytics Assistant for the AGEL CEO Tracker.

USER QUESTION: {query}

EXACT DATA FROM DATABASE (this is the absolute truth — use ONLY these numbers):
{data_result}

ADDITIONAL CONTEXT (for background only, NOT for numbers):
{context if context else "None"}

YOUR TASK:
1. Present the data result as a clear, professional answer.
2. Format numbers with commas (e.g., 8,267.3 MW).
3. Be concise — 2-4 sentences maximum for simple questions.
4. Use bullet points for tabular data.
5. NEVER compute, estimate, or add any numbers not present in the DATA above.
6. NEVER mention SQL, databases, or technical details.
7. NEVER say "based on the data" or "according to the database".
8. If the data says "No data found" or "0", say exactly that — do NOT guess.
9. Do NOT add any source attribution or traceability notes.

ANSWER:"""

    try:
        return generate(prompt)
    except Exception as e:
        print(f"[LLM Error] {e}")
        return data_result


# =================================================================
#  MAIN CHAT ENDPOINT
# =================================================================

@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):
    q = request.query.strip()

    if not q:
        return ChatResponse(answer="Please ask a question about the commissioning data.")

    # 1. CLASSIFY INTENT
    intent_info = _classify_intent(q)
    intent = intent_info["intent"]
    fy = intent_info["fy"]
    energy_type = intent_info.get("energy_type")

    print(f"[CHAT] Query: {q}")
    print(f"[CHAT] Intent: {intent} | FY: {fy} | Energy: {energy_type} | Params: {intent_info}")

    # 2. EXECUTE DETERMINISTIC SQL (based on intent)
    data_result = ""
    try:
        if intent == "greeting":
            return ChatResponse(
                answer="Hello! I am your AGEL CEO Tracker Data Assistant. "
                       "Ask me about targets, project capacities, quarterly breakdowns, "
                       "category splits, plan vs actual, or any specific project. How can I help?"
            )

        elif intent == "help":
            return ChatResponse(
                answer=(
                    "I can help you with:\n"
                    "• **Total Targets** — Overall, Solar, or Wind capacity targets\n"
                    "• **Project Details** — Capacity for a specific project\n"
                    "• **Category Breakdown** — Khavda Solar, Rajasthan Solar, Mundra Wind, etc.\n"
                    "• **Section Breakdown** — Section A, B, C, D targets\n"
                    "• **Quarterly Analysis** — Q1, Q2, Q3, Q4 capacity breakdowns\n"
                    "• **Plan vs Actual** — Variance between target and commissioned\n"
                    "• **Location Queries** — Capacity by location (Khavda, Rajasthan, etc.)\n"
                    "• **Project Listing** — All projects with their capacities\n\n"
                    "Just ask your question naturally!"
                )
            )

        elif intent == "total_target":
            section = intent_info.get("section")
            val = _total_target(fy, energy_type=energy_type, section=section)
            label = f"Section {section} " if section else ""
            type_label = f" {energy_type.title()}" if energy_type else " Overall"
            data_result = f"The {label}Total{type_label} Target Capacity for {fy} is {val} MW."

        elif intent == "solar_target":
            section = intent_info.get("section")
            val = _total_target(fy, energy_type="solar", section=section)
            label = f"Section {section} " if section else ""
            data_result = f"The {label}Total Solar Target for {fy} is {val} MW."

        elif intent == "wind_target":
            section = intent_info.get("section")
            val = _total_target(fy, energy_type="wind", section=section)
            label = f"Section {section} " if section else ""
            data_result = f"The {label}Total Wind Target for {fy} is {val} MW."

        elif intent == "project_detail":
            proj = intent_info.get("project_name", "")
            data_result = _project_detail(fy, proj)

        elif intent == "category_breakdown":
            data_result = _category_breakdown(fy, energy_type=energy_type)

        elif intent == "quarterly":
            sq = intent_info.get("specific_quarter")
            tm = intent_info.get("till_month")
            data_result = _quarterly(fy, energy_type=energy_type, specific_q=sq, till_month=tm)

        elif intent == "cumulative_actual":
            month = intent_info.get("as_of_month")
            data_result = _cumulative_actual(fy, as_of_month=month, energy_type=energy_type)

        elif intent == "plan_vs_actual":
            data_result = _plan_vs_actual(fy, energy_type=energy_type)

        elif intent == "project_list":
            data_result = _project_list(fy, energy_type=energy_type)

        elif intent == "location_target":
            loc = intent_info.get("location", "")
            data_result = _location_target(fy, loc, energy_type=energy_type)

        elif intent == "section_target":
            sec = intent_info.get("section", "A")
            data_result = _section_target(fy, sec, energy_type=energy_type)

        elif intent == "section_breakdown":
            data_result = _section_breakdown(fy, energy_type=energy_type)

        elif intent == "monthly":
            data_result = _monthly(fy, energy_type=energy_type)

        elif intent == "general":
            data_result = _retrieve_context(q, top_k=6)
            if not data_result.strip():
                data_result = "No relevant information found in the knowledge base."

    except FileNotFoundError as e:
        return ChatResponse(answer=f"Database error: {str(e)}")
    except Exception as e:
        print(f"[CHAT ERROR] {e}")
        import traceback
        traceback.print_exc()
        return ChatResponse(answer="I encountered an error processing your request. Please try again.")

    # 3. FORMAT WITH LLM (numbers already locked in from SQL)
    context = _retrieve_context(q, top_k=3)
    answer = _format_answer(q, data_result, context)

    print(f"[CHAT] Data Result: {data_result[:200]}")
    print(f"[CHAT] Final Answer: {answer[:200]}")

    return ChatResponse(answer=answer)
