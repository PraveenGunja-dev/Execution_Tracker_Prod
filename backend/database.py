"""
Database module — PostgreSQL via psycopg2, connection-pooled.
Drop-in replacement for the previous SQLite module.
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool as pg_pool
from contextlib import contextmanager

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:password@localhost:5432/Execution_Tracker",
)

_pool: pg_pool.ThreadedConnectionPool | None = None


def _get_pool() -> pg_pool.ThreadedConnectionPool:
    """Lazily create and return the shared connection pool."""
    global _pool
    if _pool is None:
        _pool = pg_pool.ThreadedConnectionPool(1, 20, DATABASE_URL)
    return _pool


# ---------------------------------------------------------------------------
# Connection wrapper — provides a sqlite3-compatible interface
# ---------------------------------------------------------------------------

class PgConnection:
    """Thin wrapper that lets existing router code call conn.execute() / conn.cursor()."""

    def __init__(self, raw_conn):
        self._conn = raw_conn

    def execute(self, query: str, params=None):
        """Create a RealDictCursor, execute the query, and return the cursor."""
        cur = self._conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(query, params or ())
        return cur

    def cursor(self):
        """Return a fresh RealDictCursor."""
        return self._conn.cursor(cursor_factory=RealDictCursor)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()


@contextmanager
def get_db():
    """Yield a PgConnection; auto-commit on success, rollback on error."""
    p = _get_pool()
    raw = p.getconn()
    try:
        yield PgConnection(raw)
        raw.commit()
    except Exception:
        raw.rollback()
        raise
    finally:
        p.putconn(raw)


# ---------------------------------------------------------------------------
# Schema migrations — executed once on startup
# ---------------------------------------------------------------------------

def run_migrations():
    """Ensure all required tables and indexes exist (idempotent)."""
    with get_db() as conn:
        cur = conn.cursor()

        # ── users ────────────────────────────────────────────────
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

        # ── table_data ───────────────────────────────────────────
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

        # ── variables ────────────────────────────────────────────
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

        # ── dropdown_options ─────────────────────────────────────
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

        # ── location_relationships ───────────────────────────────
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

        # ── commissioning_projects ───────────────────────────────
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

        # ── commissioning_summaries ──────────────────────────────
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

        # ── project_milestones ───────────────────────────────────
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

        # ── change_logs ──────────────────────────────────────────
        cur.execute("""
            CREATE TABLE IF NOT EXISTS change_logs (
                id            SERIAL PRIMARY KEY,
                user_email    TEXT,
                action        TEXT,
                entity_type   TEXT,
                entity_id     TEXT,
                details       TEXT,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Performance indexes ──────────────────────────────────
        cur.execute("CREATE INDEX IF NOT EXISTS idx_milestones_project ON project_milestones(project_id, fiscal_year)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_projects_fy ON commissioning_projects(fiscal_year)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_projects_category ON commissioning_projects(category)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_projects_deleted ON commissioning_projects(is_deleted)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_dropdown_fy ON dropdown_options(fiscal_year)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_location_fy ON location_relationships(fiscal_year)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_summaries_fy ON commissioning_summaries(fiscal_year)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_logs_user ON change_logs(user_email)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_logs_created ON change_logs(created_at)")

        conn.commit()


# ---------------------------------------------------------------------------
# Convenience helpers
# ---------------------------------------------------------------------------

def log_change(user_email: str, action: str, entity_type: str, entity_id: str | int, details: str = ""):
    """Record a change in the audit log."""
    execute(
        "INSERT INTO change_logs (user_email, action, entity_type, entity_id, details) VALUES (%s, %s, %s, %s, %s)",
        (user_email, action, entity_type, str(entity_id), details)
    )

def fetch_all(query: str, params: tuple = ()) -> list[dict]:
    with get_db() as conn:
        cur = conn.execute(query, params)
        return cur.fetchall()


def fetch_one(query: str, params: tuple = ()) -> dict | None:
    with get_db() as conn:
        cur = conn.execute(query, params)
        return cur.fetchone()


def execute(query: str, params: tuple = ()):
    """Execute a write query. Returns the first column of RETURNING row, or rowcount."""
    with get_db() as conn:
        cur = conn.execute(query, params)
        if "returning" in query.lower():
            row = cur.fetchone()
            if row:
                return row[list(row.keys())[0]]
            return None
        return cur.rowcount


def execute_many(query: str, params_list: list[tuple]) -> int:
    """Execute many and return total rows affected."""
    with get_db() as conn:
        cur = conn.cursor()
        total = 0
        for params in params_list:
            cur.execute(query, params)
            total += cur.rowcount
        return total
