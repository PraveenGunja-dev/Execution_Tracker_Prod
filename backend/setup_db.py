import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os

def create_execution_tracker_db():
    # Database connection parameters
    # We connect to the default 'postgres' database to create the new one
    dbname = "Execution_Tracker"
    user = "postgres"
    password = "password" # Change this if your postgres password is different
    host = "localhost"
    port = "5432"

    print(f"Connecting to PostgreSQL server at {host}:{port}...")
    
    try:
        # 1. Connect to the default 'postgres' database
        conn = psycopg2.connect(
            dbname="postgres",
            user=user,
            password=password,
            host=host,
            port=port
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        # 2. Check if the database already exists
        cur.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = %s", (dbname,))
        exists = cur.fetchone()

        if not exists:
            print(f"Creating database '{dbname}'...")
            cur.execute(f'CREATE DATABASE "{dbname}"')
            print(f"Database '{dbname}' created successfully.")
        else:
            print(f"Database '{dbname}' already exists.")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")
        print("\nNote: Make sure PostgreSQL is running and the password in this script matches your 'postgres' user password.")

if __name__ == "__main__":
    create_execution_tracker_db()
