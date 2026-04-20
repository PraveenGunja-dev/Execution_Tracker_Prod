"""
Versioned REST API — /api/v1/*
All endpoints require JWT Bearer token authentication.

Usage:
  1. POST /api/v1/auth/token   → get a JWT
  2. Use the JWT in the Authorization header for all other requests:
     Authorization: Bearer <token>
"""
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, Query
import bcrypt

from auth_utils import (
    create_access_token,
    get_current_user,
    require_admin,
    JWT_EXPIRY_HOURS,
)
from database import fetch_all, fetch_one, get_db
from models import LoginRequest

router = APIRouter(prefix="/api/v1", tags=["v1-api"])

MONTHS = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"]

# Hardcoded demo accounts (shared with auth.py)
_DEMO_ACCOUNTS = {
    "superadmin@adani.com": {"password": "adani123", "role": "SUPER_ADMIN", "username": "Super Admin"},
    "admin@adani.com": {"password": "adani123456", "role": "ADMIN", "username": "Admin"},
    "user@adani.com": {"password": "adani123", "role": "VIEWER", "username": "Standard User"},
}


# ═══════════════════════════════════════════════════════════════════
# AUTH — Token Generation
# ═══════════════════════════════════════════════════════════════════

@router.post("/auth/token")
async def generate_token(body: LoginRequest):
    """
    Generate a JWT access token.

    Request body:
      { "email": "...", "password": "..." }

    Returns:
      { "access_token": "...", "token_type": "bearer", "expires_in": 86400 }
    """
    if not body.email or not body.password:
        raise HTTPException(400, "Email and password are required")

    # Demo accounts
    demo = _DEMO_ACCOUNTS.get(body.email)
    if demo and demo["password"] == body.password:
        token = create_access_token({
            "sub": body.email,
            "username": demo["username"],
            "role": demo["role"],
            "scope": "all",
        })
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in": JWT_EXPIRY_HOURS * 3600,
            "user": {
                "email": body.email,
                "username": demo["username"],
                "role": demo["role"],
                "scope": "all",
            },
        }

    # DB users
    row = fetch_one("SELECT * FROM users WHERE email = %s", (body.email,))
    if not row:
        raise HTTPException(401, "Invalid email or password")

    if not bcrypt.checkpw(body.password.encode(), row["password"].encode()):
        raise HTTPException(401, "Invalid email or password")

    role = (row.get("role") or "USER").upper()
    scope = row.get("scope") or "all"

    token = create_access_token({
        "sub": row["email"],
        "user_id": row["id"],
        "username": row["username"],
        "role": role,
        "scope": scope,
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": JWT_EXPIRY_HOURS * 3600,
        "user": {
            "id": row["id"],
            "email": row["email"],
            "username": row["username"],
            "role": role,
            "scope": scope,
        },
    }


# ═══════════════════════════════════════════════════════════════════
# RESOURCES — Projects
# ═══════════════════════════════════════════════════════════════════

def _enrich(proj: dict) -> dict:
    """Add computed fields (totals, cumm, quarters)."""
    months = [proj.get(m) or 0 for m in MONTHS]
    monthly_sum = sum(months)
    total_capacity = monthly_sum if monthly_sum > 0 else (proj.get("total_capacity") or 0)

    now = datetime.now()
    if now.month >= 4:
        months_passed = now.month - 3
    else:
        months_passed = now.month + 9

    return {
        "id": proj["id"],
        "fiscalYear": proj["fiscal_year"],
        "sno": proj["sno"],
        "projectName": proj["project_name"],
        "spv": proj["spv"],
        "projectType": proj["project_type"],
        "plotLocation": proj["plot_location"],
        "plotNo": proj.get("plot_no") or "",
        "capacity": proj["capacity"],
        "planActual": proj["plan_actual"],
        **{m: proj.get(m) for m in MONTHS},
        "totalCapacity": total_capacity,
        "cummTillOct": sum(months[0:months_passed]),
        "q1": sum(months[0:3]),
        "q2": sum(months[3:6]),
        "q3": sum(months[6:9]),
        "q4": sum(months[9:12]),
        "category": proj["category"],
        "section": proj.get("section") or "A",
        "priority": proj.get("priority"),
    }


@router.get("/projects")
async def list_projects(
    fiscalYear: str = Query("FY_25-26", description="Fiscal year filter"),
    category: str | None = Query(None, description="Category filter (e.g. Solar, Wind)"),
    user: dict = Depends(get_current_user),
):
    """List all commissioning projects (authenticated)."""
    query = "SELECT * FROM commissioning_projects WHERE (is_deleted = 0 OR is_deleted IS NULL)"
    params: list = []

    if fiscalYear != "all":
        query += " AND fiscal_year = %s"
        params.append(fiscalYear)
    if category:
        query += " AND (category ILIKE %s)"
        params.append(f"%{category}%")

    query += " ORDER BY category ASC, sno ASC"
    rows = fetch_all(query, tuple(params))
    return {"count": len(rows), "data": [_enrich(r) for r in rows]}


@router.get("/projects/{project_id}")
async def get_project(
    project_id: int,
    user: dict = Depends(get_current_user),
):
    """Get a single project by ID (authenticated)."""
    row = fetch_one(
        "SELECT * FROM commissioning_projects WHERE id = %s AND (is_deleted = 0 OR is_deleted IS NULL)",
        (project_id,),
    )
    if not row:
        raise HTTPException(404, "Project not found")
    return _enrich(row)


# ═══════════════════════════════════════════════════════════════════
# RESOURCES — Milestones
# ═══════════════════════════════════════════════════════════════════

@router.get("/milestones")
async def list_milestones(
    projectId: int = Query(..., description="Project ID"),
    fiscalYear: str = Query("FY_25-26"),
    user: dict = Depends(get_current_user),
):
    """Get milestones for a project (authenticated)."""
    rows = fetch_all(
        "SELECT * FROM project_milestones WHERE project_id = %s AND fiscal_year = %s ORDER BY id ASC",
        (projectId, fiscalYear),
    )
    result = {}
    for m in MONTHS:
        relevant = [r for r in rows if r["month"] == m]
        result[m] = [
            {
                "id": found["id"],
                "mw": found.get("mw", 0),
                "priority": found.get("priority"),
                "trialRun": found.get("trial_run"),
                "chargingDate": found.get("charging_date"),
                "codDate": found.get("cod_date"),
            }
            for found in relevant
        ] if relevant else []
    return result


# ═══════════════════════════════════════════════════════════════════
# RESOURCES — Summaries / Dashboard
# ═══════════════════════════════════════════════════════════════════

@router.get("/summaries")
async def list_summaries(
    fiscalYear: str = Query("FY_25-26"),
    user: dict = Depends(get_current_user),
):
    """Get commissioning summaries (authenticated)."""
    rows = fetch_all(
        "SELECT * FROM commissioning_summaries WHERE fiscal_year = %s AND (is_deleted = 0 OR is_deleted IS NULL)",
        (fiscalYear,),
    )
    return {
        "count": len(rows),
        "data": [
            {
                "id": r["id"],
                "fiscalYear": r["fiscal_year"],
                "category": r["category"],
                "summaryType": r["summary_type"],
                **{m: r.get(m) for m in MONTHS},
                "total": r.get("total"),
            }
            for r in rows
        ],
    }


@router.get("/dashboard")
async def dashboard(
    fiscalYear: str = Query("FY_25-26"),
    user: dict = Depends(get_current_user),
):
    """Dashboard summary statistics (authenticated)."""
    total = fetch_all(
        "SELECT COUNT(*) as cnt FROM commissioning_projects WHERE fiscal_year = %s AND (is_deleted = 0 OR is_deleted IS NULL)",
        (fiscalYear,),
    )
    status_counts = fetch_all(
        "SELECT plan_actual, COUNT(*) as cnt FROM commissioning_projects WHERE fiscal_year = %s AND (is_deleted = 0 OR is_deleted IS NULL) GROUP BY plan_actual",
        (fiscalYear,),
    )
    counts = {"Plan": 0, "Actual": 0}
    for sc in status_counts:
        counts[sc["plan_actual"]] = sc["cnt"]

    return {
        "fiscalYear": fiscalYear,
        "totalProjects": total[0]["cnt"] if total else 0,
        "planCount": counts.get("Plan", 0),
        "actualCount": counts.get("Actual", 0),
    }


# ═══════════════════════════════════════════════════════════════════
# RESOURCES — Users (Admin only)
# ═══════════════════════════════════════════════════════════════════

@router.get("/users")
async def list_users(user: dict = Depends(require_admin)):
    """List all users (admin only, authenticated)."""
    rows = fetch_all(
        "SELECT id, username, email, role, scope, created_at FROM users ORDER BY created_at DESC"
    )
    return {"count": len(rows), "data": rows}


# ═══════════════════════════════════════════════════════════════════
# RESOURCES — Dropdown & Config Data
# ═══════════════════════════════════════════════════════════════════

@router.get("/dropdown-options")
async def get_dropdowns(
    fiscalYear: str = Query("FY_25-26"),
    user: dict = Depends(get_current_user),
):
    """Get dropdown options (authenticated)."""
    rows = fetch_all(
        "SELECT option_type, option_value FROM dropdown_options WHERE fiscal_year = %s",
        (fiscalYear,),
    )
    mapping = {
        "groups": "groups", "ppa_merchants": "ppaMerchants", "types": "types",
        "location_codes": "locationCodes", "locations": "locations",
        "connectivities": "connectivities", "sections": "sections",
        "categories": "categories", "priorities": "priorities",
    }
    options: dict[str, list] = {v: [] for v in mapping.values()}
    for row in rows:
        key = mapping.get(row["option_type"], row["option_type"])
        if key in options:
            options[key].append(row["option_value"])
    return options


@router.get("/locations")
async def get_locations(
    fiscalYear: str = Query("FY_25-26"),
    user: dict = Depends(get_current_user),
):
    """Get location relationships (authenticated)."""
    rows = fetch_all(
        "SELECT location, location_code FROM location_relationships WHERE fiscal_year = %s",
        (fiscalYear,),
    )
    return {
        "count": len(rows),
        "data": [{"location": r["location"], "locationCode": r["location_code"]} for r in rows],
    }


# ═══════════════════════════════════════════════════════════════════
# UTILITY — Token info
# ═══════════════════════════════════════════════════════════════════

@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    """Return the currently authenticated user's token claims."""
    return {
        "email": user.get("sub"),
        "username": user.get("username"),
        "role": user.get("role"),
        "scope": user.get("scope"),
        "token_issued_at": user.get("iat"),
        "token_expires_at": user.get("exp"),
    }
