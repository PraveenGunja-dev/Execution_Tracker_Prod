"""Summaries + dashboard router."""
from fastapi import APIRouter, Request
from database import fetch_all, get_db

router = APIRouter(prefix="/api", tags=["summaries"])

MONTHS = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"]


def _map_summary(row: dict) -> dict:
    return {
        "id": row["id"],
        "fiscalYear": row["fiscal_year"],
        "category": row["category"],
        "summaryType": row["summary_type"],
        **{m: row.get(m) for m in MONTHS},
        "total": row.get("total"),
        "cummTillOct": row.get("cumm_till_oct"),
        "q1": row.get("q1"), "q2": row.get("q2"),
        "q3": row.get("q3"), "q4": row.get("q4"),
    }


@router.get("/commissioning-summaries")
async def get_summaries(fiscalYear: str = "FY_25-26"):
    rows = fetch_all(
        "SELECT * FROM commissioning_summaries WHERE fiscal_year = %s AND (is_deleted = 0 OR is_deleted IS NULL)",
        (fiscalYear,),
    )
    return [_map_summary(r) for r in rows]


@router.post("/commissioning-summaries")
async def save_summaries(request: Request, fiscalYear: str = "FY_25-26"):
    data = await request.json()
    with get_db() as conn:
        conn.execute(
            "UPDATE commissioning_summaries SET is_deleted = 1 WHERE fiscal_year = %s",
            (fiscalYear,),
        )
        for s in data:
            conn.execute(
                """INSERT INTO commissioning_summaries
                (fiscal_year, category, summary_type,
                 apr, may, jun, jul, aug, sep, oct, nov, dec, jan, feb, mar,
                 total, cumm_till_oct, q1, q2, q3, q4)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (
                    fiscalYear, s["category"], s["summaryType"],
                    s.get("apr", 0), s.get("may", 0), s.get("jun", 0),
                    s.get("jul", 0), s.get("aug", 0), s.get("sep", 0),
                    s.get("oct", 0), s.get("nov", 0), s.get("dec", 0),
                    s.get("jan", 0), s.get("feb", 0), s.get("mar", 0),
                    s.get("total", 0), s.get("cummTillOct", 0),
                    s.get("q1", 0), s.get("q2", 0), s.get("q3", 0), s.get("q4", 0),
                ),
            )
    return {"message": "Summaries saved", "count": len(data)}


@router.get("/dashboard-summary")
async def dashboard_summary(fiscalYear: str = "FY_25-26"):
    total = fetch_all(
        "SELECT COUNT(*) as cnt FROM commissioning_projects WHERE fiscal_year = %s AND (is_deleted = 0 OR is_deleted IS NULL)",
        (fiscalYear,),
    )
    status_counts = fetch_all(
        "SELECT plan_actual, COUNT(*) as cnt FROM commissioning_projects WHERE fiscal_year = %s AND (is_deleted = 0 OR is_deleted IS NULL) GROUP BY plan_actual",
        (fiscalYear,),
    )
    last_update = fetch_all(
        "SELECT MAX(updated_at) as last_update FROM commissioning_projects WHERE fiscal_year = %s",
        (fiscalYear,),
    )

    counts = {"Plan": 0, "Actual": 0}
    for sc in status_counts:
        counts[sc["plan_actual"]] = sc["cnt"]

    return {
        "fiscal_year": fiscalYear,
        "total_projects": total[0]["cnt"] if total else 0,
        "plan_count": counts.get("Plan", 0),
        "actual_count": counts.get("Actual", 0),
        "last_update": last_update[0]["last_update"] if last_update else None,
    }
