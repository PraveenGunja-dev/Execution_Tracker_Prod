from sentence_transformers import SentenceTransformer
from app.core.config import settings
import os

class Embedder:
    def __init__(self):
        model_path = settings.EMBEDDING_MODEL

        if not os.path.isdir(model_path):
            raise RuntimeError(
                f"Embedding model directory not found: {model_path}"
            )

        self.model = SentenceTransformer(
            model_path,
            local_files_only=True
        )

    def embed(self, texts: list[str]):
        return self.model.encode(
            texts,
            show_progress_bar=True,
            normalize_embeddings=True
        )
