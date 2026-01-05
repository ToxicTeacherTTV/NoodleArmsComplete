import sqlite3
import os

db_path = 'c:/Users/trist/Documents/NickyGit/NoodleArmsComplete/server/db.sqlite'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# List all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print("Tables in Database:")
for table in tables:
    print(f"- {table[0]}")

# Try to find conversations or messages
for table_name in [t[0] for t in tables]:
    if 'conv' in table_name.lower() or 'msg' in table_name.lower() or 'message' in table_name.lower():
        print(f"\nSample from {table_name}:")
        try:
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 5")
            rows = cursor.fetchall()
            for row in rows:
                print(row)
        except Exception as e:
            print(f"Error reading {table_name}: {e}")

conn.close()
