from app.embeddings.embedder import Embedder
from app.embeddings.vector_store import VectorStore

class SemanticRetriever:
    def __init__(self, store_path: str):
        self.embedder = Embedder()
        self.store = VectorStore.load(store_path)

    def retrieve(self, query: str, top_k: int = 5):
        query_vec = self.embedder.embed([query])
        return self.store.search(query_vec, top_k)
