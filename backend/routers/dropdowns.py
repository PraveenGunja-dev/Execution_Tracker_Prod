"""Dropdowns, distinct values, location relationships."""
from fastapi import APIRouter, Request
from database import fetch_all, get_db

router = APIRouter(prefix="/api", tags=["dropdowns"])


@router.get("/distinct-values")
async def distinct_values(fiscalYear: str = "FY_25-26"):
    """Get distinct field values from actual project data."""
    base = "SELECT DISTINCT {} FROM commissioning_projects WHERE (is_deleted = 0 OR is_deleted IS NULL) AND fiscal_year = %s AND {} IS NOT NULL AND {} != ''"

    def get_unique(col: str) -> list[str]:
        q = base.format(col, col, col)
        rows = fetch_all(q, (fiscalYear,))
        return sorted([r[col] for r in rows])

    cats = get_unique("category")
    sections = get_unique("section")
    types = get_unique("project_type")
    spvs = get_unique("spv")
    locations = get_unique("plot_location")

    return {
        "categories": cats if cats else ["Solar", "Wind"],
        "sections": sections if sections else ["A", "B", "C", "D"],
        "types": types if types else ["PPA", "Merchant"],
        "ppaMerchants": spvs,
        "locations": locations,
        "priorities": [],
        "groups": [],
    }


@router.get("/dropdown-options")
async def get_dropdown_options(fiscalYear: str = "FY_25-26"):
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


@router.post("/dropdown-options")
async def save_dropdown_options(request: Request, fiscalYear: str = "FY_25-26"):
    body = await request.json()
    inv_mapping = {
        "groups": "groups", "ppaMerchants": "ppa_merchants", "types": "types",
        "locationCodes": "location_codes", "locations": "locations",
        "connectivities": "connectivities", "sections": "sections",
        "categories": "categories", "priorities": "priorities",
    }
    with get_db() as conn:
        conn.execute("DELETE FROM dropdown_options WHERE fiscal_year = %s", (fiscalYear,))
        for key, values in body.items():
            db_key = inv_mapping.get(key, key)
            if isinstance(values, list):
                for val in values:
                    conn.execute(
                        "INSERT INTO dropdown_options (option_type, option_value, fiscal_year) VALUES (%s, %s, %s)",
                        (db_key, str(val), fiscalYear),
                    )
    return {"success": True}


@router.get("/location-relationships")
async def get_location_relationships(fiscalYear: str = "FY_25-26"):
    rows = fetch_all(
        "SELECT location, location_code FROM location_relationships WHERE fiscal_year = %s",
        (fiscalYear,),
    )
    return [{"location": r["location"], "locationCode": r["location_code"]} for r in rows]


@router.post("/location-relationships")
async def save_location_relationships(request: Request, fiscalYear: str = "FY_25-26"):
    data = await request.json()
    with get_db() as conn:
        conn.execute("DELETE FROM location_relationships WHERE fiscal_year = %s", (fiscalYear,))
        for rel in data:
            conn.execute(
                "INSERT INTO location_relationships (fiscal_year, location, location_code) VALUES (%s, %s, %s)",
                (fiscalYear, rel["location"], rel["locationCode"]),
            )
    return {"success": True}
