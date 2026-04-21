"""
CEO-Tracker FastAPI Backend (PostgreSQL)
Run: uvicorn main:app --reload --port 3121
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

# Force load .env from the absolute path to prevent config issues
current_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(current_dir, ".env")
load_dotenv(dotenv_path=env_path, override=True)

from database import run_migrations

# Import all routers
from routers import auth, users, projects, summaries, dropdowns, milestones, admin, upload, chat, sso, logs

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run DB migrations on startup."""
    run_migrations()
    print("[OK] PostgreSQL migrations complete")
    yield

app = FastAPI(
    title="CEO Execution Tracker API",
    version="2.0.0",
    description="FastAPI backend for the AGEL Commissioning Dashboard (PostgreSQL)",
    lifespan=lifespan,
    root_path=os.environ.get("FASTAPI_ROOT_PATH", ""),
)

# CORS — allow the React dev server and production domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- REGISTER ROUTERS TWICE (For maximum subpath stability) ---
# 1. Root level
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

# 2. Subpath level (/execution-tracker)
prefix = "/execution-tracker"
app.include_router(auth.router, prefix=prefix)
app.include_router(users.router, prefix=prefix)
app.include_router(projects.router, prefix=prefix)
app.include_router(summaries.router, prefix=prefix)
app.include_router(dropdowns.router, prefix=prefix)
app.include_router(milestones.router, prefix=prefix)
app.include_router(admin.router, prefix=prefix)
app.include_router(upload.router, prefix=prefix)
app.include_router(chat.router, prefix=prefix)
app.include_router(sso.router, prefix=prefix)
app.include_router(logs.router, prefix=prefix)


@app.get("/")
async def root():
    """Serve index.html at root if frontend exists, else return API status."""
    index_path = os.path.join(frontend_dist, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "CEO Execution Tracker API is running", "version": "2.0.0"}


@app.get("/health")
async def health():
    return {"status": "ok", "database": "postgresql"}

frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")

if os.path.exists(frontend_dist):
    # Mount assets for the /execution-tracker/ prefix
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/execution-tracker/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.api_route("/{path_name:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"])
    async def catch_all(path_name: str, request: Request):
        # 1. 404 for missing API routes
        if path_name.startswith("api/"):
            return {"error": f"API route '{path_name}' not found"}

        # 2. Try to serve exact file from frontend_dist
        file_path = os.path.join(frontend_dist, path_name)
        if path_name and os.path.isfile(file_path):
            return FileResponse(file_path)

        # 3. Fallback to index.html for React Router
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)

        return {"error": "Frontend build not found"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=3121, reload=True)
