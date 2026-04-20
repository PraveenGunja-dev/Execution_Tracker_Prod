"""Project milestones router."""
from fastapi import APIRouter, HTTPException, Request, Depends
from database import fetch_all, fetch_one, get_db, log_change
from auth_utils import get_current_user
from typing import Optional

router = APIRouter(prefix="/api", tags=["milestones"])

MONTHS = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"]


@router.get("/project-milestones")
async def get_milestones(projectId: int, fiscalYear: str = "FY_25-26"):
    rows = fetch_all(
        "SELECT * FROM project_milestones WHERE project_id = %s AND fiscal_year = %s ORDER BY id ASC",
        (projectId, fiscalYear),
    )

    result = {}
    for m in MONTHS:
        relevant = [r for r in rows if r["month"] == m]
        if relevant:
            result[m] = [
                {
                    "id": found["id"],
                    "projectId": found["project_id"],
                    "fiscalYear": found["fiscal_year"],
                    "month": found["month"],
                    "mw": found.get("mw", 0),
                    "priority": found.get("priority"),
                    "trialRun": found.get("trial_run"),
                    "chargingDate": found.get("charging_date"),
                    "codDate": found.get("cod_date"),
                }
                for found in relevant
            ]
        else:
            # Return a default single entry for the UI.
            result[m] = [
                {
                    "projectId": projectId,
                    "fiscalYear": fiscalYear,
                    "month": m,
                    "mw": 0,
                    "priority": None,
                    "trialRun": None,
                    "chargingDate": None,
                    "codDate": None,
                }
            ]
    return result


@router.post("/project-milestones")
async def save_milestones(request: Request, user: Optional[dict] = Depends(get_current_user)):
    body = await request.json()
    user_email = user.get("sub", "anonymous") if user else "anonymous"
    project_id = body.get("projectId")
    fiscal_year = body.get("fiscalYear")
    milestones = body.get("milestones") # Expected Record[string, list of MilestoneData]

    if not project_id or not fiscal_year or not milestones:
        raise HTTPException(400, "projectId, fiscalYear, and milestones are required")

    total_count = 0
    with get_db() as conn:
        # We replace EVERYTHING for this project/FY to handle multi-row changes easily
        conn.execute(
            "DELETE FROM project_milestones WHERE project_id = %s AND fiscal_year = %s",
            (int(project_id), fiscal_year),
        )

        for month, entries in milestones.items():
            if not entries or not isinstance(entries, list):
                continue

            for ms in entries:
                # Valid entry check
                if (ms.get("mw") is not None or ms.get("trialRun") or ms.get("chargingDate") or ms.get("codDate")):
                    conn.execute(
                        """INSERT INTO project_milestones
                        (project_id, fiscal_year, month, mw, priority, trial_run, charging_date, cod_date)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                        (int(project_id), fiscal_year, month,
                         ms.get("mw", 0), ms.get("priority"),
                         ms.get("trialRun"), ms.get("chargingDate"), ms.get("codDate")),
                    )
                    total_count += 1

    log_change(user_email, "UPDATE", "MILESTONES", project_id, f"Saved {total_count} tranches")
    return {"success": True, "message": f"Saved {total_count} milestone entries."}
