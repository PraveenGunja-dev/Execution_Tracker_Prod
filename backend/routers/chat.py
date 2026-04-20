import os
import httpx
from fastapi import APIRouter, Request

router = APIRouter(prefix="/api", tags=["chat"])

# Configure the AI Service address (other laptop's IP or localhost)
# Defaulting to 127.0.0.1 for local but allowing env var override
CHATBOT_HOST = os.getenv("CHATBOT_HOST", "127.0.0.1")
CHATBOT_URL = f"http://{CHATBOT_HOST}:9005/chat"


@router.post("/chat")
async def chat(request: Request):
    body = await request.json()
    message = body.get("message", "")

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                CHATBOT_URL,
                json={"query": message},
            )
            resp.raise_for_status()
            data = resp.json()
            return {"response": data.get("answer", "")}
    except Exception as e:
        print(f"Chat error connecting to {CHATBOT_URL}: {e}")
        return {
            "response": f"The AI Service at {CHATBOT_URL} is currently offline. Please ensure the backend is running on the other laptop."
        }
