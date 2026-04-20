"""Admin operations: clone fiscal year, reset data."""
from fastapi import APIRouter, HTTPException, Request
from database import fetch_all, get_db
from models import CloneFYRequest

router = APIRouter(prefix="/api", tags=["admin"])


@router.post("/clone-fiscal-year")
async def clone_fiscal_year(body: CloneFYRequest):
    if not body.fromFY or not body.toFY:
        raise HTTPException(400, "Missing fromFY or toFY")

    with get_db() as conn:
        # 1. Clone Dropdown Options
        opts = conn.execute(
            "SELECT option_type, option_value FROM dropdown_options WHERE fiscal_year = %s",
            (body.fromFY,),
        ).fetchall()
        if opts:
            conn.execute("DELETE FROM dropdown_options WHERE fiscal_year = %s", (body.toFY,))
            for o in opts:
                conn.execute(
                    "INSERT INTO dropdown_options (option_type, option_value, fiscal_year) VALUES (%s, %s, %s)",
                    (o["option_type"], o["option_value"], body.toFY),
                )

        # 2. Clone Project Definitions (reset monthly values)
        existing = conn.execute(
            "SELECT * FROM commissioning_projects WHERE fiscal_year = %s AND (is_deleted = 0 OR is_deleted IS NULL)",
            (body.fromFY,),
        ).fetchall()

        if existing:
            target_cnt = conn.execute(
                "SELECT COUNT(*) as cnt FROM commissioning_projects WHERE fiscal_year = %s AND (is_deleted = 0 OR is_deleted IS NULL)",
                (body.toFY,),
            ).fetchone()

            if (target_cnt or {}).get("cnt", 0) == 0:
                for p in existing:
                    conn.execute(
                        """INSERT INTO commissioning_projects
                        (fiscal_year, sno, project_name, spv, project_type, plot_location, capacity,
                         plan_actual, category, section, included_in_total,
                         apr,may,jun,jul,aug,sep,oct,nov,dec,jan,feb,mar,
                         total_capacity, cumm_till_oct, q1,q2,q3,q4)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0)""",
                        (
                            body.toFY, p["sno"], p["project_name"], p["spv"],
                            p["project_type"], p["plot_location"], p["capacity"],
                            p["plan_actual"], p["category"], p.get("section", "A"),
                            p.get("included_in_total", 1),
                        ),
                    )

    return {"success": True, "message": f"Successfully carried over project definitions to {body.toFY}"}


@router.post("/reset-commissioning-data")
async def reset_commissioning_data(request: Request):
    body = await request.json()
    fy = body.get("fiscalYear", "FY_25-26")

    with get_db() as conn:
        conn.execute(
            """UPDATE commissioning_projects SET
               apr=NULL, may=NULL, jun=NULL, jul=NULL, aug=NULL, sep=NULL,
               oct=NULL, nov=NULL, dec=NULL, jan=NULL, feb=NULL, mar=NULL,
               total_capacity=0, cumm_till_oct=0, q1=0, q2=0, q3=0, q4=0
            WHERE fiscal_year = %s""",
            (fy,),
        )
    return {"success": True, "message": "Data reset successfully"}
