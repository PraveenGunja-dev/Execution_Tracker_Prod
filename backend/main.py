"""
CEO-Tracker FastAPI Backend (PostgreSQL)
Run: uvicorn main:app --reload --port 8000
"""
import os
import sys

# Ensure the backend directory is in the Python path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from database import run_migrations

# Import all routers
from routers import auth, users, projects, summaries, dropdowns, milestones, admin, upload, chat, sso, logs
from routers import api_v1

# Define paths
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run DB migrations on startup."""
    run_migrations()
    print("[OK] Database migrations complete (PostgreSQL)")
    print(f"[DB] PostgreSQL: {os.environ.get('DATABASE_URL', 'postgresql://localhost:5432/adani_tracker')}")
    yield

app = FastAPI(
    title="CEO Execution Tracker API",
    version="2.0.0",
    description=(
        "FastAPI backend for the AGEL Commissioning Dashboard.\n\n"
        "## Authentication\n"
        "The `/api/v1/*` endpoints require JWT Bearer token authentication.\n\n"
        "1. **Get a token:** `POST /api/v1/auth/token` with `{email, password}`\n"
        "2. **Use the token:** Add `Authorization: Bearer <token>` header to all requests\n"
    ),
    lifespan=lifespan,
    root_path=os.getenv("FASTAPI_ROOT_PATH", ""),
)

# CORS — allow the React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register existing routers (backward compatible) ──────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(projects.router)
app.include_router(summaries.router)
app.include_router(dropdowns.router)
app.include_router(milestones.router)
app.include_router(admin.router)
app.include_router(upload.router)
app.include_router(chat.router)
app.include_router(sso.router)
app.include_router(logs.router)

# ── Register new versioned API router (JWT-protected) ────────────
app.include_router(api_v1.router)


@app.get("/")
async def root():
    """Serve index.html at root if frontend exists, else return API status."""
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "CEO Execution Tracker API is running", "version": "2.0.0", "database": "PostgreSQL"}


@app.get("/health")
async def health():
    return {"status": "ok", "database": "postgresql"}

# Serve FastAPI static files for frontend
# (frontend_dist defined above)

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        # Mount with the correct path prefix to ensure performance for asset loading
        app.mount("/execution-tracker/assets", StaticFiles(directory=assets_dir), name="assets")
        # Also mount root assets just in case
        app.mount("/assets", StaticFiles(directory=assets_dir), name="root_assets")

    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
    async def catch_all(path_name: str, request: Request):
        # 1. API routes should have been caught by routers above.
        # If they weren't, they are truly 404s.
        if path_name.startswith("api/"):
            return {"error": f"API route '{path_name}' not found"}

        # 2. Try to serve exact file from frontend_dist (for images, icons, robots.txt)
        file_path = os.path.join(frontend_dist, path_name)
        if path_name and os.path.isfile(file_path):
            return FileResponse(file_path)

        # 3. Fallback to index.html for React Router (Single Page Application)
        # We must support ALL methods here (like GET, OPTIONS) so React Router doesn't crash
        # on direct browser navigations with URL parameters.
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)

        return {"error": "Frontend build not found"}

if __name__ == "__main__":
    import uvicorn
    # Use PORT from env if available, else default to 3122
    # In earlier revisions it was set to 3121, switching to 3122 for testing
    port = int(os.environ.get("PORT", 3121))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
