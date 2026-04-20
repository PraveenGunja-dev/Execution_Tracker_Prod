import sqlite3
from typing import Optional
from app.core.config import settings

DB_PATH = settings.DB_PATH


def _connect():
    return sqlite3.connect(DB_PATH)


# =========================================================
# INTERNAL HELPERS (NORMALIZATION)
# =========================================================

def _fy_condition(fiscal_year: Optional[str]):
    """
    Strict fiscal year normalization.
    Matches ONLY FY 25-26 variants, not substrings.
    """
    if not fiscal_year:
        return "1=1", []

    # Normalize input FY_25-26 -> 25-26
    fy = fiscal_year.upper().replace("FY", "").replace("_", "").replace(" ", "")

    return (
        """
        (
            UPPER(fiscal_year) = ?
            OR UPPER(fiscal_year) = ?
            OR UPPER(fiscal_year) = ?
            OR UPPER(fiscal_year) = ?
        )
        """,
        [
            f"FY_{fy}",
            f"FY{fy}",
            f"FY {fy}",
            fy
        ]
    )

    return "REPLACE(LOWER(fiscal_year), ' ', '') LIKE ?", [f"%{fy}%"]


def _solar_condition():
    """
    Normalized solar detection.
    Includes Solar, Solar-MLP, Solar Utility, etc.
    """
    return "LOWER(category) LIKE '%solar%'"


def _plan_condition():
    """
    Normalized plan detection.
    Matches Plan, Planned, PLAN, etc.
    """
    return "LOWER(plan_actual) LIKE 'plan%'"


def _actual_condition():
    """
    Normalized actual detection.
    Matches Actual, ACTUAL, actual, etc.
    """
    return "LOWER(plan_actual) LIKE 'actual%'"


# =========================================================
# TOTAL PLANNED SOLAR CAPACITY
# =========================================================
def total_planned_solar(fiscal_year: Optional[str]) -> float:
    conn = _connect()
    cur = conn.cursor()

    fy_cond, fy_params = _fy_condition(fiscal_year)

    query = f"""
        SELECT SUM(capacity)
        FROM commissioning_projects
        WHERE is_deleted = 0
          AND {_plan_condition()}
          AND {_solar_condition()}
          AND {fy_cond}
    """

    value = cur.execute(query, fy_params).fetchone()[0] or 0
    conn.close()
    return round(value, 2)


# =========================================================
# TOTAL ACTUAL SOLAR CAPACITY
# =========================================================
def total_actual_solar(fiscal_year: Optional[str]) -> float:
    conn = _connect()
    cur = conn.cursor()

    fy_cond, fy_params = _fy_condition(fiscal_year)

    query = f"""
        SELECT SUM(
            COALESCE(q1,0) +
            COALESCE(q2,0) +
            COALESCE(q3,0) +
            COALESCE(q4,0)
        )
        FROM commissioning_projects
        WHERE is_deleted = 0
          AND {_actual_condition()}
          AND {_solar_condition()}
          AND {fy_cond}
    """

    value = cur.execute(query, fy_params).fetchone()[0] or 0
    conn.close()
    return round(value, 2)


# =========================================================
# PLANNED VS ACTUAL SOLAR
# =========================================================
def planned_vs_actual_solar(fiscal_year: Optional[str]):
    planned = total_planned_solar(fiscal_year)
    actual = total_actual_solar(fiscal_year)

    return {
        "planned": planned,
        "actual": actual,
        "gap": round(planned - actual, 2)
    }


# =========================================================
# QUARTER-WISE ACTUAL SOLAR
# =========================================================
def quarterly_actual_solar(fiscal_year: Optional[str]):
    conn = _connect()
    cur = conn.cursor()

    fy_cond, fy_params = _fy_condition(fiscal_year)

    query = f"""
        SELECT
            SUM(COALESCE(q1,0)),
            SUM(COALESCE(q2,0)),
            SUM(COALESCE(q3,0)),
            SUM(COALESCE(q4,0))
        FROM commissioning_projects
        WHERE is_deleted = 0
          AND {_actual_condition()}
          AND {_solar_condition()}
          AND {fy_cond}
    """

    q1, q2, q3, q4 = cur.execute(query, fy_params).fetchone()
    conn.close()

    q1 = q1 or 0
    q2 = q2 or 0
    q3 = q3 or 0
    q4 = q4 or 0

    return {
        "Q1": round(q1, 2),
        "Q2": round(q2, 2),
        "Q3": round(q3, 2),
        "Q4": round(q4, 2),
        "Total": round(q1 + q2 + q3 + q4, 2)
    }


# =========================================================
# PROJECT-WISE PLANNED SOLAR
# =========================================================
def project_wise_planned_solar(fiscal_year: Optional[str]):
    conn = _connect()
    cur = conn.cursor()

    fy_cond, fy_params = _fy_condition(fiscal_year)

    query = f"""
        SELECT project_name, SUM(capacity)
        FROM commissioning_projects
        WHERE is_deleted = 0
          AND {_plan_condition()}
          AND {_solar_condition()}
          AND {fy_cond}
        GROUP BY project_name
        ORDER BY SUM(capacity) DESC
    """

    rows = cur.execute(query, fy_params).fetchall()
    conn.close()

    return {name: round(cap, 2) for name, cap in rows}
