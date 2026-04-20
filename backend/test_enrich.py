import sqlite3
import os

db_path = "d:/Adani_projects/Execution_Tracker/CEO-Tracker/backend/data/adani-excel.db"
conn = sqlite3.connect(db_path)
conn.row_factory = lambda cursor, row: {col[0]: row[idx] for idx, col in enumerate(cursor.description)}

fiscalYear = "FY_25-26"

# Get projects
rows = conn.execute("SELECT * FROM commissioning_projects WHERE (is_deleted = 0 OR is_deleted IS NULL) AND fiscal_year = ?", (fiscalYear,)).fetchall()

# Get milestones
ms_rows = conn.execute("SELECT project_id, month, trial_run, charging_date, cod_date FROM project_milestones WHERE fiscal_year = ?", (fiscalYear,)).fetchall()
ms_map = {}
for ms in ms_rows:
    pid = ms["project_id"]
    if pid not in ms_map: ms_map[pid] = {}
    ms_map[pid][ms["month"]] = {
        "trialRun": ms["trial_run"],
        "chargingDate": ms["charging_date"],
        "codDate": ms["cod_date"],
    }

# Check random project with milestones
for r in rows:
    if r["id"] in ms_map:
        print(f"Project ID {r['id']} ({r['project_name']}) has milestones:")
        print(ms_map[r["id"]])
        # Show what _enrich would do
        res = {
            "id": r["id"],
            "projectName": r["project_name"],
            "milestones": ms_map[r["id"]]
        }
        print("Enriched result:")
        print(res)
        break

conn.close()
