"""
SQLite → PostgreSQL migration script.

Reads all data from the SQLite database and inserts it into PostgreSQL.
Run this ONCE after setting up the PostgreSQL database.

Usage:
    python migrate_sqlite_to_pg.py

Prerequisites:
    1. PostgreSQL is running (docker-compose up -d)
    2. .env has the correct DATABASE_URL
    3. pip install psycopg2-binary python-dotenv
"""
import os
import sys
import sqlite3
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Load environment
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# Configuration
SQLITE_PATH = os.path.join(os.path.dirname(__file__), "data", "adani-excel.db")
PG_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/adani_tracker",
)

# Tables to migrate (order matters for foreign keys)
TABLES = [
    "users",
    "table_data",
    "variables",
    "dropdown_options",
    "location_relationships",
    "commissioning_projects",
    "commissioning_summaries",
    "project_milestones",
]


def get_sqlite_columns(cur, table_name: str) -> list[str]:
    """Get column names for a SQLite table."""
    cur.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cur.fetchall()]


def get_pg_columns(cur, table_name: str) -> list[str]:
    """Get column names for a PostgreSQL table (excluding serial PKs)."""
    cur.execute(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name = %s ORDER BY ordinal_position",
        (table_name,),
    )
    return [row[0] for row in cur.fetchall()]


def create_pg_tables(pg_conn):
    """Create all PostgreSQL tables (idempotent)."""
    cur = pg_conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            SERIAL PRIMARY KEY,
            username      TEXT NOT NULL,
            email         TEXT UNIQUE NOT NULL,
            password      TEXT NOT NULL,
            role          TEXT DEFAULT 'USER',
            scope         TEXT DEFAULT 'all',
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS table_data (
            id            SERIAL PRIMARY KEY,
            fiscal_year   TEXT,
            data          TEXT,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            version       INTEGER DEFAULT 1,
            is_deleted    SMALLINT DEFAULT 0
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS variables (
            id            SERIAL PRIMARY KEY,
            "key"         TEXT,
            value         TEXT,
            user_id       TEXT,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS dropdown_options (
            id            SERIAL PRIMARY KEY,
            option_type   TEXT,
            option_value  TEXT,
            version       INTEGER DEFAULT 1,
            is_deleted    SMALLINT DEFAULT 0,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            fiscal_year   TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS location_relationships (
            id            SERIAL PRIMARY KEY,
            fiscal_year   TEXT,
            location      TEXT,
            location_code TEXT,
            version       INTEGER DEFAULT 1,
            is_deleted    SMALLINT DEFAULT 0,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS commissioning_projects (
            id              SERIAL PRIMARY KEY,
            fiscal_year     TEXT,
            sno             TEXT,
            project_name    TEXT,
            spv             TEXT,
            project_type    TEXT,
            plot_location   TEXT,
            capacity        REAL,
            plan_actual     TEXT,
            apr  REAL, may  REAL, jun  REAL,
            jul  REAL, aug  REAL, sep  REAL,
            oct  REAL, nov  REAL, dec  REAL,
            jan  REAL, feb  REAL, mar  REAL,
            total_capacity  REAL,
            cumm_till_oct   REAL,
            q1 REAL, q2 REAL, q3 REAL, q4 REAL,
            category        TEXT,
            is_deleted      SMALLINT DEFAULT 0,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            section         TEXT DEFAULT 'A',
            included_in_total SMALLINT DEFAULT 1,
            plot_no         TEXT,
            priority        TEXT,
            trial_run       TEXT,
            charging_date   TEXT,
            cod_date        TEXT,
            trial_run_plan  TEXT,
            trial_run_actual TEXT,
            charging_plan   TEXT,
            charging_actual TEXT,
            cod_plan        TEXT,
            cod_actual      TEXT
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS commissioning_summaries (
            id            SERIAL PRIMARY KEY,
            fiscal_year   TEXT,
            category      TEXT,
            summary_type  TEXT,
            apr REAL, may REAL, jun REAL,
            jul REAL, aug REAL, sep REAL,
            oct REAL, nov REAL, dec REAL,
            jan REAL, feb REAL, mar REAL,
            total         REAL,
            cumm_till_oct REAL,
            q1 REAL, q2 REAL, q3 REAL, q4 REAL,
            is_deleted    SMALLINT DEFAULT 0,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS project_milestones (
            id            SERIAL PRIMARY KEY,
            project_id    INTEGER NOT NULL,
            fiscal_year   TEXT NOT NULL,
            month         TEXT NOT NULL,
            mw            REAL DEFAULT 0,
            priority      TEXT,
            trial_run     TEXT,
            charging_date TEXT,
            cod_date      TEXT,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Indexes
    cur.execute("CREATE INDEX IF NOT EXISTS idx_milestones_project ON project_milestones(project_id, fiscal_year)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_projects_fy ON commissioning_projects(fiscal_year)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_projects_category ON commissioning_projects(category)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_projects_deleted ON commissioning_projects(is_deleted)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_dropdown_fy ON dropdown_options(fiscal_year)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_location_fy ON location_relationships(fiscal_year)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_summaries_fy ON commissioning_summaries(fiscal_year)")

    pg_conn.commit()
    print("[OK] PostgreSQL tables created")


def migrate_table(sqlite_cur, pg_conn, table_name: str) -> int:
    """Migrate a single table from SQLite to PostgreSQL. Returns row count."""
    pg_cur = pg_conn.cursor()

    # Get SQLite columns
    sqlite_cols = get_sqlite_columns(sqlite_cur, table_name)
    if not sqlite_cols:
        print(f"  [SKIP] {table_name} - no columns found in SQLite")
        return 0

    # Get PostgreSQL columns  
    pg_cols = get_pg_columns(pg_cur, table_name)
    if not pg_cols:
        print(f"  [SKIP] {table_name} - table not found in PostgreSQL")
        return 0

    # Find common columns (excluding 'id' since PostgreSQL uses SERIAL)
    common_cols = [c for c in sqlite_cols if c in pg_cols and c != "id"]
    if not common_cols:
        print(f"  [SKIP] {table_name} - no common columns")
        return 0

    # Handle the 'key' column quoting for PostgreSQL
    pg_col_names = []
    for c in common_cols:
        if c == "key":
            pg_col_names.append('"key"')
        else:
            pg_col_names.append(c)

    # Read all data from SQLite
    sqlite_cur.execute(f"SELECT {', '.join(common_cols)} FROM {table_name}")
    rows = sqlite_cur.fetchall()

    if not rows:
        print(f"  [SKIP] {table_name} - no data to migrate")
        return 0

    # Clear target table first
    pg_cur.execute(f"DELETE FROM {table_name}")

    # Build INSERT query with placeholders
    placeholders = ", ".join(["%s"] * len(common_cols))
    insert_sql = f"INSERT INTO {table_name} ({', '.join(pg_col_names)}) VALUES ({placeholders})"

    # Insert in batches
    batch_size = 500
    total = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        for row in batch:
            # Convert SQLite values for PostgreSQL compatibility
            cleaned = []
            for val in row:
                if isinstance(val, bytes):
                    cleaned.append(val.decode("utf-8", errors="replace"))
                else:
                    cleaned.append(val)
            pg_cur.execute(insert_sql, cleaned)
            total += 1

    # Reset the serial sequence to continue after the max ID
    try:
        pg_cur.execute(
            f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), "
            f"COALESCE((SELECT MAX(id) FROM {table_name}), 0) + 1, false)"
        )
    except Exception as e:
        # Not all tables may have serial columns, that's ok
        print(f"  [WARN] Could not reset sequence for {table_name}: {e}")
        pg_conn.rollback()
        # Re-run the migration for this table since we rolled back
        return total

    pg_conn.commit()
    return total


def migrate_table_with_ids(sqlite_cur, pg_conn, table_name: str) -> int:
    """Migrate a table preserving original IDs (important for foreign key relationships)."""
    pg_cur = pg_conn.cursor()

    # Get SQLite columns
    sqlite_cols = get_sqlite_columns(sqlite_cur, table_name)
    pg_cols = get_pg_columns(pg_cur, table_name)
    
    # Include 'id' for preserving relationships
    common_cols = [c for c in sqlite_cols if c in pg_cols]
    if not common_cols:
        return 0

    # Handle the 'key' column quoting
    pg_col_names = []
    for c in common_cols:
        if c == "key":
            pg_col_names.append('"key"')
        else:
            pg_col_names.append(c)

    # Read from SQLite
    sqlite_cur.execute(f"SELECT {', '.join(common_cols)} FROM {table_name}")
    rows = sqlite_cur.fetchall()
    if not rows:
        return 0

    # Clear and insert
    pg_cur.execute(f"DELETE FROM {table_name}")
    
    placeholders = ", ".join(["%s"] * len(common_cols))
    insert_sql = f"INSERT INTO {table_name} ({', '.join(pg_col_names)}) VALUES ({placeholders})"

    total = 0
    for row in rows:
        cleaned = []
        for val in row:
            if isinstance(val, bytes):
                cleaned.append(val.decode("utf-8", errors="replace"))
            else:
                cleaned.append(val)
        pg_cur.execute(insert_sql, cleaned)
        total += 1

    # Reset serial sequence
    try:
        pg_cur.execute(
            f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), "
            f"COALESCE((SELECT MAX(id) FROM {table_name}), 0) + 1, false)"
        )
    except Exception:
        pass

    pg_conn.commit()
    return total


def main():
    print("=" * 60)
    print("  SQLite -> PostgreSQL Migration")
    print("=" * 60)
    print(f"  Source: {SQLITE_PATH}")
    print(f"  Target: {PG_URL}")
    print()

    # Verify SQLite file exists
    if not os.path.exists(SQLITE_PATH):
        print(f"[ERROR] SQLite database not found: {SQLITE_PATH}")
        sys.exit(1)

    # Connect to SQLite
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_cur = sqlite_conn.cursor()

    # Get table list from SQLite
    sqlite_cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence'")
    sqlite_tables = [r[0] for r in sqlite_cur.fetchall()]
    print(f"[INFO] SQLite tables found: {sqlite_tables}")

    # Connect to PostgreSQL
    try:
        pg_conn = psycopg2.connect(PG_URL)
        print("[OK] Connected to PostgreSQL")
    except Exception as e:
        print(f"[ERROR] Cannot connect to PostgreSQL: {e}")
        print("       Make sure PostgreSQL is running: docker-compose up -d")
        sys.exit(1)

    # Create tables
    create_pg_tables(pg_conn)

    # Migrate each table
    total_rows = 0
    for table in TABLES:
        if table not in sqlite_tables:
            print(f"  [SKIP] {table} - not in SQLite")
            continue

        try:
            count = migrate_table_with_ids(sqlite_cur, pg_conn, table)
            total_rows += count
            print(f"  [OK] {table:30s} -> {count:>6d} rows migrated")
        except Exception as e:
            print(f"  [ERROR] {table}: {e}")
            pg_conn.rollback()

    print()
    print("=" * 60)
    print(f"  Migration complete! {total_rows} total rows migrated.")
    print("=" * 60)

    # Verify
    print()
    print("Verification - PostgreSQL row counts:")
    pg_cur = pg_conn.cursor()
    for table in TABLES:
        try:
            pg_cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = pg_cur.fetchone()[0]
            print(f"  {table:30s} -> {count:>6d} rows")
        except Exception as e:
            print(f"  {table:30s} -> ERROR: {e}")
            pg_conn.rollback()

    sqlite_conn.close()
    pg_conn.close()
    print()
    print("[DONE] You can now start the backend with: uvicorn main:app --reload --port 3121")


if __name__ == "__main__":
    main()
