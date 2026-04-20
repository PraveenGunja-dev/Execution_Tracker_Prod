from fastapi import APIRouter, Depends
from database import fetch_all
from auth_utils import get_current_user, require_admin

router = APIRouter(prefix="/api/logs", tags=["logs"])

@router.get("")
async def get_logs(limit: int = 100, user: dict = Depends(get_current_user)):
    """Fetch the latest change logs (accessible to all authenticated users)."""
    # Note: Depending on sensitivity, you might want to restrict this to ADMIN.
    # But since the user asked for logs to appear "aside of admin", I'll make it readable by all logged-in users.
    return fetch_all(
        "SELECT * FROM change_logs ORDER BY created_at DESC LIMIT %s",
        (limit,)
    )
