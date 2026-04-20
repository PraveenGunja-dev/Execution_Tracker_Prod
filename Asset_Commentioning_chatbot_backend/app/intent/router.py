import re

def route_query(query: str):
    q = query.lower()

    # -------- PLAN VS ACTUAL --------
    if "plan" in q and "actual" in q:
        return {
            "type": "planned_vs_actual",
            "fiscal_year": extract_fy(q),
            "category": "Solar"
        }

    # -------- TOTAL PLANNED --------
    if "total" in q and "planned" in q and "solar" in q:
        return {
            "type": "total_planned",
            "fiscal_year": extract_fy(q),
            "category": "Solar"
        }

    # -------- QUARTERLY --------
    if "quarter" in q or "q1" in q or "q2" in q:
        return {
            "type": "quarterly",
            "fiscal_year": extract_fy(q),
            "category": "Solar"
        }

    # -------- PROJECT WISE --------
    if "project" in q and "planned" in q:
        return {
            "type": "project_wise",
            "fiscal_year": extract_fy(q),
            "plan_actual": "Plan"
        }

    return None


def extract_fy(q: str):
    match = re.search(r"fy\s*([0-9]{2}[-–][0-9]{2})", q)
    if match:
        return f"FY_{match.group(1)}"
    return "FY_25-26"  # default
