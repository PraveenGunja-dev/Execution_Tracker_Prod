import sqlite3
import os

db_path = os.path.join(os.getcwd(), "backend", "data", "adani-excel.db")
conn = sqlite3.connect(db_path)
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
print([r[0] for r in cur.fetchall()])
conn.close()
