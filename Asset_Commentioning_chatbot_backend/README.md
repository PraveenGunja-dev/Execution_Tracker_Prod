Production RAG Chatbot Backend

This repository contains a production-ready Retrieval-Augmented Generation (RAG) chatbot backend built using FastAPI, SQLite, FAISS, and Large Language Models (LLMs).

The system is designed to answer exact, database-backed analytical questions (planned vs actual, quarterly totals, project-wise metrics) while also providing clear natural-language explanations for business users such as CEOs, CFOs, managers, and analysts.

##Key Features

Accurate, SQL-based numeric calculations (no hallucinations)

Planned vs Actual analysis

Fiscal year, quarterly, and project-wise aggregations

Row-wise embeddings using MiniLM

FAISS vector search

LLM-powered explanations (Groq for local, Azure OpenAI for production)

FastAPI backend running on port 9005

Designed for real-world, messy enterprise data

###Tech Stack

Backend Framework: FastAPI

Database: SQLite

Vector Store: FAISS

Embeddings: all-MiniLM-L6-v2 (local model)

LLMs:

Groq (local testing)

Azure OpenAI (production)

Python Version: 3.9+

Environment Variables

Create a .env file in the project root.

DB_PATH=./data/adani_tracker_fresh.db
EMBEDDING_MODEL=/absolute/path/to/all-MiniLM-L6-v2
GROQ_API_KEY=your_groq_api_key
AZURE_OPENAI_KEY=your_azure_key
AZURE_OPENAI_ENDPOINT=your_azure_endpoint
AZURE_OPENAI_DEPLOYMENT=your_deployment_name

###Installation

Create virtual environment
python -m venv venv

Activate environment
source venv/bin/activate

Install dependencies
pip install -r requirements.txt

Build Embeddings (One Time)

This step creates row-wise embeddings and stores them in FAISS.

python build_embeddings_v2.py

Run this only when:

Database changes

New rows are added

Run the Server

uvicorn app.main:app --host 0.0.0.0 --port 9005

Open Swagger UI in browser:
http://127.0.0.1:9005/docs

Example API Usage

POST /chat

Request body:
{
"query": "Planned vs actual solar capacity for FY 25-26"
}