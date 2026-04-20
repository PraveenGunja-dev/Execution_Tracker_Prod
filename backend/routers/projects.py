"""Commissioning projects router."""
from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request, Depends
from database import fetch_all, fetch_one, get_db, log_change
from models import ProjectCreate
from auth_utils import get_current_user
from typing import Optional

router = APIRouter(prefix="/api", tags=["projects"])

MONTHS = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"]


def _enrich(proj: dict, milestones_map: dict = None) -> dict:
    """Add computed fields (totals, cumm, quarters)."""
    months = [proj.get(m) or 0 for m in MONTHS]
    monthly_sum = sum(months)
    # Priority: monthly sum if non-zero, otherwise stored total_capacity
    total_capacity = monthly_sum if monthly_sum > 0 else (proj.get("total_capacity") or 0)

    # Dynamic cumulative calculation based on current calendar date
    now = datetime.now()
    if now.month >= 4:
        months_passed = now.month - 3  # April=1, May=2, etc. (slice needs to be +1 of index, so April index=0, slice=0:1)
    else:
        months_passed = now.month + 9  # Jan=10, Feb=11, Mar=12
    
    cumm = sum(months[0:months_passed])
    q1 = sum(months[0:3])
    q2 = sum(months[3:6])
    q3 = sum(months[6:9])
    q4 = sum(months[9:12])

    # Convert snake_case DB columns to camelCase for frontend
    res = {
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
        "apr": proj["apr"], "may": proj["may"], "jun": proj["jun"],
        "jul": proj["jul"], "aug": proj["aug"], "sep": proj["sep"],
        "oct": proj["oct"], "nov": proj["nov"], "dec": proj["dec"],
        "jan": proj["jan"], "feb": proj["feb"], "mar": proj["mar"],
        "totalCapacity": total_capacity,
        "cummTillOct": cumm,
        "q1": q1, "q2": q2, "q3": q3, "q4": q4,
        "category": proj["category"],
        "section": proj.get("section") or "A",
        "includedInTotal": bool(proj.get("included_in_total", 1)),
        "isDeleted": bool(proj.get("is_deleted", 0)),
        "priority": proj.get("priority"),
        "trialRun": proj.get("trial_run_plan") or proj.get("trial_run"),
        "chargingPlan": proj.get("charging_plan") or proj.get("charging_date"),
        "codPlan": proj.get("cod_plan") or proj.get("cod_date"),
    }

    # Add milestones if provided
    if milestones_map and proj["id"] in milestones_map:
        res["milestones"] = milestones_map[proj["id"]]
    else:
        res["milestones"] = {}
    return res


@router.get("/commissioning-projects")
async def get_projects(fiscalYear: str = "FY_25-26", category: str | None = None):
    query = "SELECT * FROM commissioning_projects WHERE (is_deleted = 0 OR is_deleted IS NULL)"
    params: list = []

    if fiscalYear != "all":
        query += " AND fiscal_year = %s"
        params.append(fiscalYear)

    if category:
        query += " AND (category ILIKE %s OR project_name ILIKE %s)"
        params.extend([f"%{category}%", f"%{category}%"])

    query += " ORDER BY category ASC, sno ASC"
    rows = fetch_all(query, tuple(params))

    # Batch fetch milestones for these projects
    ms_map = {}
    ms_query = "SELECT project_id, month, mw, priority, trial_run, charging_date, cod_date FROM project_milestones"
    ms_params = []
    if fiscalYear != "all":
        ms_query += " WHERE fiscal_year = %s"
        ms_params.append(fiscalYear)
    
    ms_rows = fetch_all(ms_query, tuple(ms_params))
    for ms in ms_rows:
        pid = ms["project_id"]
        if pid not in ms_map:
            ms_map[pid] = {}
        
        month = ms["month"]
        if month not in ms_map[pid]:
            ms_map[pid][month] = []
            
        ms_map[pid][month].append({
            "mw": ms.get("mw", 0),
            "priority": ms.get("priority"),
            "trialRun": ms["trial_run"],
            "chargingDate": ms["charging_date"],
            "codDate": ms["cod_date"],
        })

    return [_enrich(r, ms_map) for r in rows]


@router.post("/commissioning-projects")
async def save_projects(request: Request, fiscalYear: str = "FY_25-26", user: Optional[dict] = Depends(get_current_user)):
    data = await request.json()
    user_email = user.get("sub", "anonymous") if user else "anonymous"
    with get_db() as conn:
        conn.execute(
            "UPDATE commissioning_projects SET is_deleted = 1 WHERE fiscal_year = %s",
            (fiscalYear,),
        )
        for p in data:
            conn.execute(
                """INSERT INTO commissioning_projects
                (fiscal_year, sno, project_name, spv, project_type, plot_location, plot_no, capacity,
                 plan_actual, apr, may, jun, jul, aug, sep, oct, nov, dec, jan, feb, mar,
                 total_capacity, cumm_till_oct, q1, q2, q3, q4, category, section, included_in_total,
                 priority, charging_plan, trial_run_plan, cod_plan, is_deleted)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0)""",
                (
                    fiscalYear, p.get("sno", 0), p["projectName"], p.get("spv", ""),
                    p.get("projectType", ""), p.get("plotLocation", ""), p.get("plotNo", ""), p.get("capacity", 0),
                    p["planActual"],
                    p.get("apr", 0), p.get("may", 0), p.get("jun", 0),
                    p.get("jul", 0), p.get("aug", 0), p.get("sep", 0),
                    p.get("oct", 0), p.get("nov", 0), p.get("dec", 0),
                    p.get("jan", 0), p.get("feb", 0), p.get("mar", 0),
                    p.get("totalCapacity", 0), p.get("cummTillOct", 0),
                    p.get("q1", 0), p.get("q2", 0), p.get("q3", 0), p.get("q4", 0),
                    p.get("category", "Solar"), p.get("section", "A"),
                    1 if p.get("includedInTotal", True) else 0,
                    p.get("priority", ""), p.get("chargingPlan", ""), p.get("trialRun", ""), p.get("codPlan", ""),
                ),
            )
    log_change(user_email, "OVERWRITE_ALL", "PROJECT_SHEET", fiscalYear, f"Saved {len(data)} projects")
    return {"message": "Commissioning projects saved successfully", "count": len(data)}


@router.delete("/commissioning-projects")
async def delete_project(id: int, user: Optional[dict] = Depends(get_current_user)):
    user_email = user.get("sub", "anonymous") if user else "anonymous"
    with get_db() as conn:
        conn.execute("UPDATE commissioning_projects SET is_deleted = 1 WHERE id = %s", (id,))
    log_change(user_email, "DELETE", "PROJECT", id)
    return {"message": "Project deleted successfully"}


@router.patch("/commissioning-projects/{project_id}")
@router.put("/commissioning-projects/{project_id}")
async def update_project(project_id: int, request: Request, user: Optional[dict] = Depends(get_current_user)):
    data = await request.json()
    user_email = user.get("sub", "anonymous") if user else "anonymous"
    sets, params = [], []

    col_map = {
        "sno": "sno",
        "projectName": "project_name", "spv": "spv",
        "projectType": "project_type", "plotLocation": "plot_location",
        "plotNo": "plot_no", "capacity": "capacity", "planActual": "plan_actual",
        "category": "category", "section": "section", "priority": "priority",
        "includedInTotal": "included_in_total", "totalCapacity": "total_capacity",
        "cummTillOct": "cumm_till_oct",
        "trialRun": "trial_run_plan", "chargingPlan": "charging_plan", "codPlan": "cod_plan",
    }
    # Monthly fields
    for m in MONTHS:
        col_map[m] = m
    for q in ["q1", "q2", "q3", "q4"]:
        col_map[q] = q

    for js_key, db_col in col_map.items():
        if js_key in data:
            val = data[js_key]
            if js_key == "includedInTotal":
                val = 1 if val else 0
            sets.append(f"{db_col} = %s")
            params.append(val)

    if not sets:
        raise HTTPException(400, "No fields to update")

    # Important: append the WHERE clause value last
    params.append(project_id)

    with get_db() as conn:
        query = f"UPDATE commissioning_projects SET {', '.join(sets)}, updated_at = CURRENT_TIMESTAMP WHERE id = %s"
        conn.execute(query, params)
    
    log_change(user_email, "UPDATE", "PROJECT", project_id, f"Fields: {', '.join(data.keys())}")
    return {"success": True, "message": "Project updated successfully"}


@router.post("/manual-add-project")
async def manual_add_project(request: Request, user: Optional[dict] = Depends(get_current_user)):
    body = await request.json()
    user_email = user.get("sub", "anonymous") if user else "anonymous"
    fy = body.get("fiscalYear", "FY_25-26")

    row = fetch_one(
        "SELECT MAX(sno) as max_sno FROM commissioning_projects WHERE fiscal_year = %s",
        (fy,),
    )
    next_sno = (row["max_sno"] or 0) + 1 if row else 1

    statuses = ["Plan", "Actual"]
    with get_db() as conn:
        for status in statuses:
            conn.execute(
                """INSERT INTO commissioning_projects
                (fiscal_year, sno, project_name, spv, project_type, plot_location, plot_no,
                 capacity, plan_actual, category, section, included_in_total, total_capacity,
                 is_deleted, priority, charging_plan, trial_run_plan, cod_plan)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,%s,%s,%s,%s)""",
                (
                    fy, next_sno, body["projectName"], body.get("spv", ""),
                    body.get("projectType", ""), body.get("plotLocation", ""),
                    body.get("plotNo", ""), body.get("capacity", 0), status,
                    body.get("category", "Solar"), body.get("section", "A"),
                    1, body.get("capacity", 0), body.get("priority"),
                    body.get("chargingPlan", ""), body.get("trialRun", ""),
                    body.get("codPlan", ""),
                ),
            )
    log_change(user_email, "INSERT", "PROJECT", body.get("projectName"), f"Manual addition")
    return {"success": True, "message": f"Project '{body['projectName']}' added successfully with Plan and Actual rows."}
