import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    APP_NAME = "Chatbot Backend"
    ENV = os.getenv("ENV", "local")

    # ── Database ──────────────────────────────────────────────
    DB_PATH = os.getenv("DB_PATH", "data/adani-excel.db")
    EMBEDDINGS_DB_PATH = os.getenv("EMBEDDINGS_DB_PATH", "data/embeddings.db")

    # ── Embedding Model ───────────────────────────────────────
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

    # ── LLM Provider: "groq" or "azure" ──────────────────────
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "azure")

    # ── Groq ──────────────────────────────────────────────────
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")

    # ── Azure OpenAI ──────────────────────────────────────────
    AZURE_OPENAI_KEY = os.getenv("AZURE_OPENAI_KEY") or os.getenv("LLM_API_KEY")
    AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT") or os.getenv("LLM_ENDPOINT")
    AZURE_DEPLOYMENT_NAME = os.getenv("AZURE_DEPLOYMENT_NAME") or os.getenv("LLM_DEPLOYMENT")

    # ── Default Fiscal Year ───────────────────────────────────
    DEFAULT_FY = os.getenv("DEFAULT_FY", "FY_25-26")

settings = Settings()
