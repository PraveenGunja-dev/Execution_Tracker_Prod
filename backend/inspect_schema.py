import sqlite3

conn = sqlite3.connect("data/adani-excel.db")
cur = conn.cursor()

# Get all tables
tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
print("Tables:", [t[0] for t in tables])

for t in tables:
    name = t[0]
    print(f"\n=== {name} ===")
    cols = cur.execute(f"PRAGMA table_info({name})").fetchall()
    for c in cols:
        print(f"  {c[1]:30s} {c[2]:20s} pk={c[5]}")
    
    # Count rows
    cnt = cur.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
    print(f"  >> {cnt} rows")

conn.close()
