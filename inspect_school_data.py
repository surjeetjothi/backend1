
import os
import psycopg2
from psycopg2.extras import DictCursor
import json

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def inspect_data():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
        cursor = conn.cursor()

        print("--- SCHOOLS ---")
        cursor.execute("SELECT * FROM schools")
        schools = cursor.fetchall()
        for s in schools:
            print(dict(s))

        print("\n--- STUDENTS (Sample) ---")
        cursor.execute("SELECT id, name, role, school_id FROM students LIMIT 10")
        students = cursor.fetchall()
        for s in students:
            print(dict(s))
            
        print("\n--- PRINCIPAL ---")
        cursor.execute("SELECT id, name, role, school_id FROM students WHERE role = 'Principal'")
        principal = cursor.fetchall()
        for p in principal:
            print(dict(p))

        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_data()
