from app.db.sqlite_loader import load_rows
from app.embeddings.embedder import Embedder
from app.embeddings.vector_store import VectorStore
import os

os.makedirs("data/faiss_index", exist_ok=True)

df = load_rows()

def row_to_text(row):
    return f"""
Project Name: {row['project_name']}
SPV: {row['spv']}
Project Type: {row['project_type']}
Category: {row['category']}
Fiscal Year: {row['fiscal_year']}
Status: {row['plan_actual']}
Total Capacity: {row['capacity']} MW
Quarterly Capacity:
Q1: {row['q1']} MW
Q2: {row['q2']} MW
Q3: {row['q3']} MW
Q4: {row['q4']} MW
Section: {row['section']}
"""

texts = df.apply(row_to_text, axis=1).tolist()

embedder = Embedder()
vectors = embedder.embed(texts)

store = VectorStore(dim=len(vectors[0]))
store.add(vectors, df.to_dict(orient="records"))

store.save("data/faiss_index/store.pkl")

print("✅ Embeddings built successfully")
