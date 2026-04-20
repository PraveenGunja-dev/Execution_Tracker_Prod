"""Users router — /api/users"""
from fastapi import APIRouter, HTTPException
import bcrypt
from models import CreateUserRequest, UpdateUserRequest
from database import fetch_all, fetch_one, get_db

router = APIRouter(prefix="/api", tags=["users"])


@router.get("/users")
async def list_users():
    return fetch_all(
        "SELECT id, username, email, role, scope, created_at FROM users ORDER BY created_at DESC"
    )


@router.post("/users", status_code=201)
async def create_user(body: CreateUserRequest):
    if not body.username or not body.email or not body.password:
        raise HTTPException(400, "Missing required fields")

    existing = fetch_one(
        "SELECT id FROM users WHERE email = %s OR username = %s",
        (body.email, body.username),
    )
    if existing:
        raise HTTPException(409, "User with this email or username already exists")

    hashed = bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode()

    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO users (username, email, password, role, scope) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (body.username, body.email, hashed, body.role.upper(), body.scope),
        )
        new_id = cur.fetchone()["id"]

    return {
        "id": new_id,
        "username": body.username,
        "email": body.email,
        "role": body.role.upper(),
        "scope": body.scope,
    }


@router.put("/users")
async def update_user(body: UpdateUserRequest):
    if not body.id:
        raise HTTPException(400, "User ID is required")

    sets, params = [], []
    if body.role is not None:
        sets.append("role = %s")
        params.append(body.role.upper())
    if body.scope is not None:
        sets.append("scope = %s")
        params.append(body.scope)

    if not sets:
        raise HTTPException(400, "Nothing to update")

    params.append(body.id)
    with get_db() as conn:
        conn.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = %s", params)

    row = fetch_one("SELECT id, username, email, role, scope FROM users WHERE id = %s", (body.id,))
    return row


@router.delete("/users")
async def delete_user(id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM users WHERE id = %s", (id,))
    return {"success": True}
