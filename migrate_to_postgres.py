import sqlite3
import psycopg2
import os
import sys
from dotenv import load_dotenv
load_dotenv()

# Tables ordered by dependency (Parents first)
TABLES = [
    'schools', 
    'students', 
    'invitations', 
    'password_resets', 
    'backup_codes', 
    'activities', 
    'live_classes', 
    'auth_logs', 
    'groups', 
    'group_members', 
    'group_materials', 
    'quizzes', 
    'quiz_attempts'
]

SQLITE_DB = "edtech_fastapi_enhanced.db"
POSTGRES_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/edtech_db")

def migrate():
    if not os.path.exists(SQLITE_DB):
        print(f"SQLite database {SQLITE_DB} not found.")
        return

    print(f"Connecting to SQLite: {SQLITE_DB}")
    sqlite_conn = sqlite3.connect(SQLITE_DB)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    print(f"Connecting to Postgres: {POSTGRES_URL}")
    try:
        pg_conn = psycopg2.connect(POSTGRES_URL)
        pg_cur = pg_conn.cursor()
    except Exception as e:
        print(f"Failed to connect to Postgres: {e}")
        print("Please ensure PostgreSQL is running and the DATABASE_URL environment variable is set correctly.")
        return

    # Disable constraints temporarily? No, just truncate in reverse order or use CASCADE.
    # Postgres TRUNCATE CASCADE works well.
    
    valid_school_ids = set()
    valid_student_ids = set()

    for table in TABLES:
        print(f"Processing table: {table}")
        
        # Fetch data from SQLite
        try:
            sqlite_cur.execute(f"SELECT * FROM {table}")
            rows = sqlite_cur.fetchall()
        except sqlite3.OperationalError as e:
            print(f"  Table {table} not found in SQLite: {e}. Skipping.")
            continue
            
        columns = [description[0] for description in sqlite_cur.description]
        col_str = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        
        # Clean Postgres table
        try:
            pg_cur.execute(f"TRUNCATE TABLE {table} CASCADE")
        except psycopg2.errors.UndefinedTable:
             print(f"  Table {table} does not exist in Postgres. Please run the backend app first to initialize tables.")
             pg_conn.rollback()
             return
        except Exception as e:
             print(f"  Error truncating {table}: {e}")
             pg_conn.rollback()
             return

        if not rows:
            print(f"  No data in SQLite for {table}.")
            continue

        # FILTERING ORPHAN RECORDS
        original_count = len(rows)
        if table == 'schools':
            valid_school_ids = {row['id'] for row in rows}
        
        elif table == 'students':
            # Filter invalid school_ids
            if valid_school_ids: # Only filter if we have known schools
                 rows = [r for r in rows if r['school_id'] in valid_school_ids or r['school_id'] is None]
            
            valid_student_ids = {row['id'] for row in rows}
            
        elif table in ['backup_codes', 'auth_logs']:
            if 'user_id' in columns:
                rows = [r for r in rows if r['user_id'] in valid_student_ids]

        elif table in ['activities', 'group_members', 'quiz_attempts', 'submissions']:
             if 'student_id' in columns:
                rows = [r for r in rows if r['student_id'] in valid_student_ids]
        
        if len(rows) < original_count:
            print(f"  Filtered {original_count - len(rows)} orphan rows from {table}.")

        # Convert to tuples
        data = [tuple(row) for row in rows]

        # FIX: Convert integer 0/1 to Boolean for Postgres
        if table == 'students' and 'is_super_admin' in columns:
            idx = columns.index('is_super_admin')
            data = [tuple((True if col == 1 else False) if i == idx else col for i, col in enumerate(row)) for row in data]
        
        if table == 'invitations' and 'is_used' in columns:
            idx = columns.index('is_used')
            data = [tuple((True if col == 1 else False) if i == idx else col for i, col in enumerate(row)) for row in data]

        # Insert into Postgres
        query = f"INSERT INTO {table} ({columns[0] if len(columns)==1 else col_str}) VALUES ({placeholders})"
        
        try:
            pg_cur.executemany(query, data)
            print(f"  Migrated {len(rows)} rows.")
        except Exception as e:
            print(f"  Error inserting into {table}: {e}")
            pg_conn.rollback()
            return

    pg_conn.commit()
    print("Migration completed successfully.")
    
    sqlite_conn.close()
    pg_conn.close()

if __name__ == "__main__":
    migrate()
