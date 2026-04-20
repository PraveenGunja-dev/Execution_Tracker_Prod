import sqlite3
import os
from datetime import datetime

db_path = r"d:\Execution-tracker\Praveen\backend\data\adani-excel.db"
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row

# FY 25-26
fy = "FY_25-26"
month_keys = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar']

# 1. Fetch Actual projects
projects = conn.execute("SELECT * FROM commissioning_projects WHERE fiscal_year = ? AND plan_actual = 'Actual' AND included_in_total = 1", (fy,)).fetchall()

# 2. Fetch Milestones
milestones = conn.execute("SELECT * FROM project_milestones WHERE fiscal_year = ?", (fy,)).fetchall()

ms_map = {}
for ms in milestones:
    pid = ms["project_id"]
    if pid not in ms_map:
        ms_map[pid] = {}
    m = ms["month"]
    if m not in ms_map[pid]:
        ms_map[pid][m] = []
    ms_map[pid][m].append(dict(ms))

def is_passed(date_str):
    if not date_str or date_str in ["—", "-", ""]: return False
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        return d.date() <= datetime.now().date()
    except:
        return False

agel_total = 0
group_total = 0
breakdown = []

month_keys = ['apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec', 'jan', 'feb', 'mar']

# Enforce logic similar to CEODashboard.tsx:330
# 1. actualProjsRaw = included.filter(p => p.planActual === 'Actual')
# 2. for each p in actualProjsRaw: ...

# First, get all raw projects to match milestones by sno
raw_projects = conn.execute("SELECT * FROM commissioning_projects WHERE fiscal_year = ?", (fy,)).fetchall()
raw_projects_list = [dict(r) for r in raw_projects]

# Load milestones map
milestones = conn.execute("SELECT * FROM project_milestones WHERE fiscal_year = ?", (fy,)).fetchall()
ms_map = {}
for ms in milestones:
    pid = ms["project_id"]
    if pid not in ms_map: ms_map[pid] = {}
    m = ms["month"]
    if m not in ms_map[pid]: ms_map[pid][m] = []
    ms_map[pid][m].append(dict(ms))

def is_passed(date_str):
    if not date_str or date_str in ["—", "-", ""]: return False
    try:
        # Expected format is YYYY-MM-DD
        d = datetime.strptime(date_str[:10], "%Y-%m-%d")
        return d.date() <= datetime.now().date()
    except Exception as e:
        return False

# Included projects (included_in_total=1, plan_actual='Actual')
included_actual = [p for p in raw_projects_list if p.get('included_in_total') == 1 and p.get('plan_actual') == 'Actual']

for p in included_actual:
    p_trial_run_sum = 0
    sno = p["sno"]
    project_type = p["project_type"]
    
    # Milestone gathering by SNO (like frontend CEODashboard.tsx:336)
    all_related_milestones = {}
    for rp in raw_projects_list:
        if rp["sno"] != sno: continue
        pid = rp["id"]
        # In reality, the backend router attaches milestones to the res[id]
        # and the frontend gathers them by sno.
        p_mss = ms_map.get(pid, {})
        for m, mss in p_mss.items():
            if m not in all_related_milestones: all_related_milestones[m] = []
            # In frontend, it merges everything: allRelatedMilestones[m].push(...mss)
            all_related_milestones[m].extend(mss)

    for idx, m in enumerate(month_keys):
        # CEODashboard.tsx:348 - Apr to Jan indices (0 to 9) enforceDateCheck = false
        enforce_date_check = (idx >= 10)
        
        val = 0
        if enforce_date_check:
            m_mss = all_related_milestones.get(m, [])
            if m_mss:
                val = sum(ms.get("mw", 0) for ms in m_mss if is_passed(ms.get("trial_run")))
            else:
                if is_passed(p.get("trial_run_plan")):
                    val = p.get(m) or 0
        else:
            val = p.get(m) or 0
        
        p_trial_run_sum += val

    if project_type in ['PPA', 'Merchant']:
        agel_total += p_trial_run_sum
    elif project_type == 'Group':
        group_total += p_trial_run_sum
    
    if p_trial_run_sum > 0:
        breakdown.append({
            "name": p["project_name"],
            "type": project_type,
            "trial_run": p_trial_run_sum,
            "category": p["category"],
            "section": p["section"]
        })

total_tr = agel_total + group_total
print(f"OVERALL TRIAL RUN: {total_tr:.1f}")
print(f"AGEL: {agel_total:.1f}")
print(f"GROUP: {group_total:.1f}")

# Projected Calculation (Sum of raw Actual monthly columns)
projected_total = 0
for p in included_actual:
    for m in month_keys:
        projected_total += p.get(m) or 0

print(f"\n--- KPI COMPARISON ---")
print(f"TRIAL RUN: {total_tr:.1f} MW")
print(f"PROJECTED: {projected_total:.1f} MW")
print(f"DIFFERENCE: {total_tr - projected_total:.1f} MW")

# Grouped results for clear justification
projects_by_name = {}
for item in breakdown:
    name = item['name']
    if name not in projects_by_name:
        projects_by_name[name] = {"type": item['type'], "mw": 0, "parts": [], "raw_mw": 0}
    projects_by_name[name]["mw"] += item['trial_run']
    projects_by_name[name]["parts"].append(item['trial_run'])

# Add raw values for projection comparison
for p in included_actual:
    name = p['project_name']
    if name in projects_by_name:
        for m in month_keys:
            projects_by_name[name]["raw_mw"] += p.get(m) or 0

sorted_projects = sorted(projects_by_name.items(), key=lambda x: x[1]['mw'], reverse=True)

print("\n--- COMPARISON BY PROJECT (Trial Run > Projected) ---")
for i, (name, data) in enumerate(sorted_projects):
    diff = data['mw'] - data.get('raw_mw', 0)
    if abs(diff) > 0.1:
        diff_str = f" (+{diff:.1f} MW)" if diff > 0 else f" ({diff:.1f} MW)"
        print(f"{i+1:2}. {name[:40]:<40} : Trial={data['mw']:>7.1f} | Projected={data.get('raw_mw', 0):>7.1f} | Diff={diff_str}")

conn.close()

conn.close()
