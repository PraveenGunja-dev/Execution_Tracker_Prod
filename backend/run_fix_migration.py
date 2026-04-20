from database import run_migrations
import os

print(f"Current working directory: {os.getcwd()}")
try:
    run_migrations()
    print("Migrations completed successfully.")
except Exception as e:
    print(f"Migration failed: {e}")
