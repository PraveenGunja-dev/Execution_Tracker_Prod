def build_prompt(query: str, rows: list[dict]) -> str:
    context = "\n".join([str(row) for row in rows])

    return f"""
You are an enterprise analytics assistant.

Rules:
- Do NOT say "can be calculated"
- Always give a final numeric answer if possible
- Always include units (MW, INR, etc.)
- Be confident and factual
- Structure the response clearly

Use this format:
1. Summary (1–2 lines, confident)
2. Key Details (bullet points)
3. Conclusion (final number + interpretation)

Context:
{context}

Question:
{query}
"""
    