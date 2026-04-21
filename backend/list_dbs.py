import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv

# Load environment
load_dotenv(override=True)

# Try to connect to 'postgres' (the default DB) to list others
try:
    # Build connection string for the default 'postgres' DB
    # We'll use the same credentials but change the DB name to 'postgres'
    conn = psycopg2.connect(
        dbname="postgres",
        user="postgres",
        password="password",
        host="localhost",
        port=5432
    )
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT datname FROM pg_database WHERE datistemplate = false;")
    dbs = [row['datname'] for row in cur.fetchall()]
    print("\n--- Available Databases on Localhost ---")
    for db in dbs:
        print(f" - {db}")
    print("----------------------------------------\n")
    conn.close()
except Exception as e:
    print(f"\n[ERROR] Could not connect to list databases: {e}")
    print("Please make sure PostgreSQL is running and the credentials (postgres/password) are correct.\n")
