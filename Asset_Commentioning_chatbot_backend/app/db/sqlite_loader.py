import sqlite3
import pandas as pd
from app.core.config import settings

TABLE_NAME = "commissioning_projects"

def load_rows() -> pd.DataFrame:
    conn = sqlite3.connect(settings.DB_PATH)
    df = pd.read_sql(f"SELECT * FROM {TABLE_NAME} WHERE is_deleted = 0", conn)
    conn.close()
    return df
