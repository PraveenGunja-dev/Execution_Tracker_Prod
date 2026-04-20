#!/usr/bin/env python3
"""
diagnose_q1.py — Find why Q1 for FY_26-27 is 1,817 in SQL but 1,558 in UI.
Run: python scripts/diagnose_q1.py
"""

import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "data", "adani-excel.db")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

fy = "FY_26-27"

print(f"=== Q1 Diagnostic for {fy} ===\n")

# 1. Overall Q1 (our current query)
cursor.execute("""
    SELECT ROUND(SUM(COALESCE(q1, 0)), 1) as Q1
    FROM commissioning_projects
    WHERE is_deleted = 0 AND plan_actual = 'Plan'
      AND included_in_total = 1 AND fiscal_year = ?
""", (fy,))
print(f"1. Q1 ALL (included_in_total=1): {cursor.fetchone()[0]} MW")

# 2. Q1 by section
cursor.execute("""
    SELECT section, ROUND(SUM(COALESCE(q1, 0)), 1) as Q1
    FROM commissioning_projects
    WHERE is_deleted = 0 AND plan_actual = 'Plan'
      AND included_in_total = 1 AND fiscal_year = ?
    GROUP BY section ORDER BY section
""", (fy,))
print("\n2. Q1 by Section:")
for row in cursor.fetchall():
    print(f"   Section {row[0]:5s}: {row[1]} MW")

# 3. Q1 by category
cursor.execute("""
    SELECT category, ROUND(SUM(COALESCE(q1, 0)), 1) as Q1
    FROM commissioning_projects
    WHERE is_deleted = 0 AND plan_actual = 'Plan'
      AND included_in_total = 1 AND fiscal_year = ?
    GROUP BY category ORDER BY Q1 DESC
""", (fy,))
print("\n3. Q1 by Category:")
for row in cursor.fetchall():
    print(f"   {row[0]:45s}: {row[1]} MW")

# 4. Q1 Section A only (likely what UI shows)
cursor.execute("""
    SELECT ROUND(SUM(COALESCE(q1, 0)), 1) as Q1
    FROM commissioning_projects
    WHERE is_deleted = 0 AND plan_actual = 'Plan'
      AND included_in_total = 1 AND fiscal_year = ?
      AND section = 'A'
""", (fy,))
print(f"\n4. Q1 Section A only: {cursor.fetchone()[0]} MW")

# 5. Q1 by project_type (PPA, Merchant, Group)
cursor.execute("""
    SELECT project_type, ROUND(SUM(COALESCE(q1, 0)), 1) as Q1
    FROM commissioning_projects
    WHERE is_deleted = 0 AND plan_actual = 'Plan'
      AND included_in_total = 1 AND fiscal_year = ?
    GROUP BY project_type ORDER BY Q1 DESC
""", (fy,))
print("\n5. Q1 by project_type (PPA/Merchant/Group):")
total = 0
for row in cursor.fetchall():
    print(f"   {row[0]:15s}: {row[1]} MW")
    total += row[1]
print(f"   {'TOTAL':15s}: {total} MW")

# 6. Q1 Section A by project_type
cursor.execute("""
    SELECT project_type, ROUND(SUM(COALESCE(q1, 0)), 1) as Q1
    FROM commissioning_projects
    WHERE is_deleted = 0 AND plan_actual = 'Plan'
      AND included_in_total = 1 AND fiscal_year = ?
      AND section = 'A'
    GROUP BY project_type ORDER BY Q1 DESC
""", (fy,))
print("\n6. Q1 Section A by project_type:")
total = 0
for row in cursor.fetchall():
    print(f"   {row[0]:15s}: {row[1]} MW")
    total += row[1]
print(f"   {'TOTAL':15s}: {total} MW")

# 7. Check distinct sections for FY 26-27
cursor.execute("""
    SELECT DISTINCT section FROM commissioning_projects
    WHERE fiscal_year = ? AND plan_actual = 'Plan' AND included_in_total = 1
    ORDER BY section
""", (fy,))
print(f"\n7. Sections in {fy}: {[r[0] for r in cursor.fetchall()]}")

# 8. Also check: Q1 computed from monthly vs stored
cursor.execute("""
    SELECT 
        ROUND(SUM(COALESCE(q1, 0)), 1) as stored_Q1,
        ROUND(SUM(COALESCE(apr,0) + COALESCE(may,0) + COALESCE(jun,0)), 1) as calc_Q1
    FROM commissioning_projects
    WHERE is_deleted = 0 AND plan_actual = 'Plan'
      AND included_in_total = 1 AND fiscal_year = ?
""", (fy,))
row = cursor.fetchone()
print(f"\n8. Stored Q1={row[0]} MW vs Calculated (apr+may+jun)={row[1]} MW")

conn.close()
print("\n=== UI shows Q1 = 1,558.0 MW. Match one of the above! ===")
