import sqlite3, psycopg2

tables = ['users', 'table_data', 'variables', 'dropdown_options', 'location_relationships', 'commissioning_projects', 'commissioning_summaries', 'project_milestones']
conn_sqlite = sqlite3.connect('data/adani-excel.db')
cur_sqlite = conn_sqlite.cursor()

conn_pg = psycopg2.connect('postgresql://postgres:password@localhost:5432/adani_tracker')
cur_pg = conn_pg.cursor()

print(f"{'TABLE':<25} | {'SQLITE':<8} | {'POSTGRES':<8} | {'MATCH':<5}")
print('-'*56)

for t in tables:
    cur_sqlite.execute(f"SELECT COUNT(*) FROM {t}")
    count_sq = cur_sqlite.fetchone()[0]
    
    cur_pg.execute(f"SELECT COUNT(*) FROM {t}")
    count_pg = cur_pg.fetchone()[0]
    
    match = 'OK' if count_sq == count_pg else 'ERR'
    print(f"{t:<25} | {count_sq:<8} | {count_pg:<8} | {match}")
