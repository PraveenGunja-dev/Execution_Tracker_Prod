
import sqlite3
import os

files = ["data/adani-excel.db", "database.db"]

for f in files:
    print(f"\n--- FILE: {f} ---")
    if not os.path.exists(f):
        print("Does not exist!")
        continue
    conn = sqlite3.connect(f)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    for row in cursor.fetchall():
        print(f"Table: {row['name']}")
    conn.close()
