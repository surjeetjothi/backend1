import os
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/edtech_db")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) FROM students")
    count = cursor.fetchone()[0]
    print(f"Total students in Postgres: {count}")
    conn.close()
except Exception as e:
    print(f"Error connecting to Postgres: {e}")

try:
    import sqlite3
    conn = sqlite3.connect("edtech_fastapi_enhanced.db")
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) FROM students")
    count = cursor.fetchone()[0]
    print(f"Total students in SQLite (edtech_fastapi_enhanced.db): {count}")
    conn.close()
except Exception as e:
    print(f"Error connecting to SQLite: {e}")
