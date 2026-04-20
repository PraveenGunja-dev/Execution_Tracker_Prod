import sqlite3
import os

db_path = os.path.join("data", "adani-excel.db")
conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("--- Tables ---")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
for row in cursor.fetchall():
    print(row['name'])

print("\n--- project_milestones schema ---")
try:
    cursor.execute("PRAGMA table_info(project_milestones);")
    for row in cursor.fetchall():
        print(f"{row['name']} ({row['type']})")
except Exception as e:
    print(f"Error: {e}")

conn.close()
