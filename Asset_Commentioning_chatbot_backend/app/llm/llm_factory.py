"""
LLM Factory – returns the correct generate() function based on LLM_PROVIDER.

Usage:
    from app.llm.llm_factory import generate
    answer = generate("Your prompt here")
"""

import os
from app.core.config import settings


def _build_generator():
    """
    Return a callable  generate(prompt:str) -> str
    based on the configured LLM_PROVIDER.
    """
    provider = (settings.LLM_PROVIDER or "groq").lower().strip()

    # ── Azure OpenAI ──────────────────────────────────────
    if provider == "azure":
        if not settings.AZURE_OPENAI_KEY or not settings.AZURE_OPENAI_ENDPOINT:
            raise RuntimeError(
                "LLM_PROVIDER is 'azure' but AZURE_OPENAI_KEY / AZURE_OPENAI_ENDPOINT "
                "are not set in .env"
            )
        import httpx
        from openai import AzureOpenAI

        http_client = httpx.Client(
            verify=False,
            trust_env=False,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                )
            },
        )
        client = AzureOpenAI(
            api_key=settings.AZURE_OPENAI_KEY,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
            api_version="2024-02-15-preview",
            http_client=http_client,
        )

        def _azure_generate(prompt: str) -> str:
            resp = client.chat.completions.create(
                model=settings.AZURE_DEPLOYMENT_NAME,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.05,
                
            )
            return resp.choices[0].message.content

        return _azure_generate

    # ── Groq (default) ────────────────────────────────────
    if not settings.GROQ_API_KEY:
        raise RuntimeError(
            "LLM_PROVIDER is 'groq' but GROQ_API_KEY is not set in .env"
        )
    from groq import Groq

    groq_client = Groq(api_key=settings.GROQ_API_KEY)
    model_name = os.getenv("GROQ_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")

    def _groq_generate(prompt: str) -> str:
        resp = groq_client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional CXO-level enterprise analytics assistant. "
                        "You MUST use ONLY the data provided in the prompt. "
                        "Do NOT invent, estimate, or guess any numbers. "
                        "If data is not provided, say 'Data not available'."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.05,
            max_tokens=1024,
        )
        return resp.choices[0].message.content

    return _groq_generate


# Module-level singleton – import this directly
generate = _build_generator()
