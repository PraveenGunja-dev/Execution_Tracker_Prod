"""Authentication router — /api/login + /api/v1/auth/token"""
from fastapi import APIRouter, HTTPException
import bcrypt
from models import LoginRequest, LoginResponse, UserOut
from database import fetch_one
from auth_utils import create_access_token

router = APIRouter(prefix="/api", tags=["auth"])

# Hardcoded demo accounts (same as original Next.js)
_DEMO_ACCOUNTS = {
    "superadmin@adani.com": {
        "password": "adani123",
        "user": UserOut(username="Super Admin", email="superadmin@adani.com", role="SUPER_ADMIN", scope="all"),
    },
    "admin@adani.com": {
        "password": "adani123456",
        "user": UserOut(username="Admin", email="admin@adani.com", role="ADMIN", scope="all"),
    },
    "user@adani.com": {
        "password": "adani123",
        "user": UserOut(username="Standard User", email="user@adani.com", role="VIEWER", scope="all"),
    },
}


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest):
    if not body.email or not body.password:
        raise HTTPException(400, "Email and password are required")

    # Check demo accounts first
    demo = _DEMO_ACCOUNTS.get(body.email)
    if demo and demo["password"] == body.password:
        user = demo["user"]
        token = create_access_token({
            "sub": user.email,
            "username": user.username,
            "role": user.role,
            "scope": user.scope,
        })
        return LoginResponse(access_token=token, user=user)

    # Check DB
    row = fetch_one("SELECT * FROM users WHERE email = %s", (body.email,))
    if not row:
        raise HTTPException(401, "Invalid email or password")

    if not bcrypt.checkpw(body.password.encode(), row["password"].encode()):
        raise HTTPException(401, "Invalid email or password")

    user_out = UserOut(
        id=row["id"],
        username=row["username"],
        email=row["email"],
        role=(row.get("role") or "USER").upper(),
        scope=row.get("scope") or "all",
    )

    token = create_access_token({
        "sub": user_out.email,
        "user_id": user_out.id,
        "username": user_out.username,
        "role": user_out.role,
        "scope": user_out.scope,
    })

    return LoginResponse(access_token=token, user=user_out)
