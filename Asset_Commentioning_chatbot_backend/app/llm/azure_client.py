import httpx
from openai import AzureOpenAI
from app.core.config import settings
# Create a custom HTTP client with SSL verification disabled
# And spoof User-Agent to avoid blocking by some firewalls
http_client = httpx.Client(
    verify=False,
    trust_env=False,  # Ignore system proxies, force direct connection (which we know works from diag)
    headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
)
client = AzureOpenAI(
    api_key=settings.AZURE_OPENAI_KEY,
    azure_endpoint=settings.AZURE_OPENAI_ENDPOINT,
    api_version="2024-02-15-preview",
    http_client=http_client
)
def generate(prompt: str) -> str:
    response = client.chat.completions.create(
        model=settings.AZURE_DEPLOYMENT_NAME,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.05
    )
    return response.choices[0].message.content
