
import sqlite3
import os

f = "data/adani-excel.db"
conn = sqlite3.connect(f)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
for row in cursor.fetchall():
    tableName = row['name']
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {tableName}")
        count = cursor.fetchone()[0]
        print(f"Table: {tableName} - Rows: {count}")
    except:
        print(f"Table: {tableName} - COULD NOT COUNT")
conn.close()
