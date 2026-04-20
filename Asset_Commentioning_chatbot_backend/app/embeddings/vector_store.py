import faiss
import pickle
from typing import List

class VectorStore:
    def __init__(self, dim: int):
        self.index = faiss.IndexFlatL2(dim)
        self.metadata: List[dict] = []

    def add(self, vectors, metadata):
        self.index.add(vectors)
        self.metadata.extend(metadata)

    def search(self, vector, top_k: int = 5):
        distances, indices = self.index.search(vector, top_k)
        return [self.metadata[i] for i in indices[0]]

    def save(self, path: str):
        with open(path, "wb") as f:
            pickle.dump(self, f)

    @staticmethod
    def load(path: str):
        with open(path, "rb") as f:
            return pickle.load(f)
