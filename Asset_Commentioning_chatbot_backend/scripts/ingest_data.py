import sqlite3
import pandas as pd
import faiss
import pickle
import os
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
import json

# =========================
# Config
# =========================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# CRITICAL FIX: Disable SSL verification for Azure/Corporate VM downloads
os.environ["HF_HUB_DISABLE_SSL_VERIFY"] = "1"
os.environ["CURL_CA_BUNDLE"] = ""

DB_PATH = os.path.join(BASE_DIR, "data/adani-excel.db")
INDEX_PATH = os.path.join(BASE_DIR, "data/faiss_index/index.faiss")
METADATA_PATH = os.path.join(BASE_DIR, "data/faiss_index/metadata.pkl")

# Load Env
load_dotenv(os.path.join(BASE_DIR, ".env"))
MODEL_PATH = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)

# Prevent tokenizer parallelism warnings
os.environ["TOKENIZERS_PARALLELISM"] = "false"


def ingest():
    print(f"Base Dir: {BASE_DIR}")
    print(f"Reading DB from: {DB_PATH}")
    print(f"Writing Index to: {INDEX_PATH}")
    print(f"Loading Model from: {MODEL_PATH}")

    print("Loading embedding model...")
    if os.path.exists(MODEL_PATH):
        model = SentenceTransformer(MODEL_PATH)
    else:
        model = SentenceTransformer(MODEL_PATH)

    conn = sqlite3.connect(DB_PATH)

    try:
        texts = []

        # ======================================================
        # GLOBAL DOMAIN GUARD (VERY IMPORTANT)
        # ======================================================
        texts.append(
            "Domain Rule: Solar projects include Sections A, B, and C. "
            "Wind projects include Sections A and C only. "
            "Capacities must never be mixed across domains or sections. "
            "All values are retrieved directly from database records."
        )

        # ======================================================
        # LAYER 1: TABLE-LEVEL FACTUAL CONTEXT
        # ======================================================
        print("Indexing Layer 1: Table-level context...")
        texts.extend([
            "Table commissioning_projects stores project-level commissioning data including project name, capacity, category, section, and fiscal year.",
            "Table commissioning_summaries stores aggregated commissioning targets by fiscal year and category.",
            "Table location_relationships stores hierarchical mappings between project locations.",
            "Table variables stores configuration constants used across the system."
        ])

        # ======================================================
        # LAYER 2: COLUMN-LEVEL FACTUAL CONTEXT
        # ======================================================
        print("Indexing Layer 2: Column-level schema...")
        texts.extend([
            "Column total_capacity represents the megawatt capacity of a commissioning project.",
            "Column fiscal_year represents the reporting year such as FY_25-26.",
            "Column plan_actual indicates whether the data is Plan or Actual.",
            "Column category represents Solar or Wind.",
            "Column section represents commissioning section A, B, or C."
        ])

        # ======================================================
        # LAYER 3: PROJECT-LEVEL CONTEXT (STRICT, UI-ALIGNED)
        # ======================================================
        print("Indexing Layer 3: Project-level context...")
        project_query = """
            SELECT
                project_name,
                spv,
                total_capacity,
                category,
                section,
                fiscal_year
            FROM commissioning_projects
            WHERE
                is_deleted = 0
                AND plan_actual = 'Plan'
        """
        df_projects = pd.read_sql_query(project_query, conn)

        for _, row in df_projects.iterrows():
            texts.append(
                f"Project '{row['project_name']}' is a {row['category']} project "
                f"in Section {row['section']} under SPV '{row['spv']}' "
                f"with planned capacity {row['total_capacity']} MW "
                f"for fiscal year {row['fiscal_year']}."
            )

        # ======================================================
        # LAYER 4: BUSINESS AGGREGATES (NO DERIVED MATH)
        # ======================================================
        print("Indexing Layer 4: Business aggregates...")
        summary_query = """
            SELECT
                fiscal_year,
                category,
                SUM(total_capacity) AS total_capacity
            FROM commissioning_projects
            WHERE
                is_deleted = 0
                AND plan_actual = 'Plan'
                AND included_in_total = 1
            GROUP BY fiscal_year, category
        """
        df_summary = pd.read_sql_query(summary_query, conn)

        for _, row in df_summary.iterrows():
            texts.append(
                f"For fiscal year {row['fiscal_year']}, the total planned capacity "
                f"for {row['category']} projects is {row['total_capacity']} MW "
                f"as recorded in commissioning data."
            )

        # ======================================================
        # LAYER 5: DOMAIN KNOWLEDGE (NO CALCULATION RULES)
        # ======================================================
        print("Indexing Layer 5: Domain knowledge...")
        targets_path = os.path.join(BASE_DIR, "data/targets.json")
        if os.path.exists(targets_path):
            with open(targets_path, "r") as f:
                targets = json.load(f)
            for t in targets:
                if "metric" in t:
                    texts.append(
                        f"Metric '{t['metric']}' values are sourced directly "
                        f"from database summaries without chatbot-side calculation."
                    )

        knowledge_path = os.path.join(BASE_DIR, "data/domain_knowledge.txt")
        if os.path.exists(knowledge_path):
            with open(knowledge_path, "r", encoding="utf-8") as f:
                content = f.read()
            for section in content.split("🔹"):
                if section.strip():
                    texts.append(section.strip())

        conn.close()

        print(f"Total chunks to index: {len(texts)}")

        # ======================================================
        # EMBEDDING
        # ======================================================
        print("Embedding data...")
        embeddings = model.encode(texts)

        # ======================================================
        # FAISS INDEX
        # ======================================================
        print("Creating FAISS index...")
        dimension = embeddings.shape[1]
        index = faiss.IndexFlatL2(dimension)
        index.add(embeddings)

        print("Saving index and metadata...")
        faiss.write_index(index, INDEX_PATH)
        with open(METADATA_PATH, "wb") as f:
            pickle.dump(texts, f)

        print("Ingestion complete.")

    except Exception as e:
        print(f"Error during ingestion: {e}")


if __name__ == "__main__":
    ingest()
