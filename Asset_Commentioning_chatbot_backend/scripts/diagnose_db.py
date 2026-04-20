#!/usr/bin/env python3
"""
diagnose_db.py — Quick diagnostic to see actual DB structure and values.
Run: python scripts/diagnose_db.py
"""

import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "adani-excel.db")

print(f"DB Path: {DB_PATH}")
print(f"Exists: {os.path.exists(DB_PATH)}")

if not os.path.exists(DB_PATH):
    print("ERROR: DB not found!")
    exit(1)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# 1. List all tables
print("\n" + "=" * 60)
print("TABLES:")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cursor.fetchall()]
print(tables)

# 2. Schema for commissioning_projects
print("\n" + "=" * 60)
print("SCHEMA: commissioning_projects")
cursor.execute("PRAGMA table_info('commissioning_projects')")
cols = cursor.fetchall()
for c in cols:
    print(f"  {c[1]:25s} type={c[2]:10s} notnull={c[3]} default={c[4]}")

col_names = [c[1] for c in cols]
print(f"\nAll columns: {col_names}")

# 3. Sample rows
print("\n" + "=" * 60)
print("FIRST 3 ROWS:")
cursor.execute("SELECT * FROM commissioning_projects LIMIT 3")
rows = cursor.fetchall()
for row in rows:
    for name, val in zip(col_names, row):
        print(f"  {name:25s} = {val!r}")
    print("  ---")

# 4. Check distinct values for key filter columns
print("\n" + "=" * 60)
for col in ["plan_actual", "fiscal_year", "project_type", "section",
            "included_in_total", "is_deleted", "category"]:
    if col in col_names:
        cursor.execute(f"SELECT DISTINCT \"{col}\" FROM commissioning_projects")
        vals = [r[0] for r in cursor.fetchall()]
        print(f"DISTINCT {col:25s} = {vals}")
    else:
        print(f"COLUMN NOT FOUND: {col}")

# 5. Key counts
print("\n" + "=" * 60)
print("COUNTS:")
cursor.execute("SELECT COUNT(*) FROM commissioning_projects")
print(f"  Total rows:          {cursor.fetchone()[0]}")

# Try different boolean representations
for del_val in [0, False, "false", "0"]:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM commissioning_projects WHERE is_deleted = ?", (del_val,))
        print(f"  is_deleted = {del_val!r:10s}  → {cursor.fetchone()[0]} rows")
    except Exception as e:
        print(f"  is_deleted = {del_val!r:10s}  → ERROR: {e}")

for inc_val in [1, True, "true", "1"]:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM commissioning_projects WHERE included_in_total = ?", (inc_val,))
        print(f"  included_in_total = {inc_val!r:10s}  → {cursor.fetchone()[0]} rows")
    except Exception as e:
        print(f"  included_in_total = {inc_val!r:10s}  → ERROR: {e}")

# 6. Test the solar capacity query with different filter combos
print("\n" + "=" * 60)
print("SOLAR CAPACITY TESTS:")

# Check if monthly columns exist
monthly = ["apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "jan", "feb", "mar"]
existing_monthly = [m for m in monthly if m in col_names]
print(f"  Monthly columns found: {existing_monthly}")

if existing_monthly:
    cap_expr = " + ".join(f'COALESCE("{m}", 0)' for m in existing_monthly)

    # Test 1: No filters
    cursor.execute(f"SELECT SUM({cap_expr}) FROM commissioning_projects")
    print(f"  SUM(monthly) ALL rows: {cursor.fetchone()[0]}")

    # Test 2: plan_actual filter
    for pa in ["Plan", "Planned", "plan", "PLAN"]:
        cursor.execute(f"SELECT SUM({cap_expr}) FROM commissioning_projects WHERE plan_actual = ?", (pa,))
        val = cursor.fetchone()[0]
        if val and val > 0:
            print(f"  SUM(monthly) plan_actual='{pa}': {val}")

    # Test 3: project_type filter
    for pt in ["Solar", "solar", "SOLAR"]:
        cursor.execute(f"SELECT SUM({cap_expr}) FROM commissioning_projects WHERE project_type = ?", (pt,))
        val = cursor.fetchone()[0]
        if val and val > 0:
            print(f"  SUM(monthly) project_type='{pt}': {val}")

    # Test 4: Combined (the query we use in chat.py)
    cursor.execute(f"""
        SELECT SUM({cap_expr})
        FROM commissioning_projects
        WHERE is_deleted = 0
          AND plan_actual = 'Plan'
          AND included_in_total = 1
          AND project_type = 'Solar'
    """)
    print(f"\n  CHAT.PY QUERY (is_deleted=0, plan_actual='Plan', included_in_total=1, project_type='Solar'):")
    print(f"    Result: {cursor.fetchone()[0]}")

    # Test 5: Relaxed
    cursor.execute(f"""
        SELECT SUM({cap_expr})
        FROM commissioning_projects
        WHERE plan_actual = 'Plan'
          AND project_type = 'Solar'
    """)
    print(f"  RELAXED (plan_actual='Plan', project_type='Solar' only):")
    print(f"    Result: {cursor.fetchone()[0]}")

    # Test 6: Use total_capacity column instead
    if "total_capacity" in col_names:
        cursor.execute(f"""
            SELECT SUM(total_capacity)
            FROM commissioning_projects
            WHERE plan_actual = 'Plan'
              AND project_type = 'Solar'
        """)
        print(f"  SUM(total_capacity) plan='Plan' type='Solar': {cursor.fetchone()[0]}")

conn.close()
print("\n" + "=" * 60)
print("DIAGNOSTIC COMPLETE")
