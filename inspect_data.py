
import os
import psycopg2
from psycopg2.extras import DictCursor
import pandas as pd

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def inspect_db():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
        cursor = conn.cursor()
        
        print("--- SCHOOLS ---")
        cursor.execute("SELECT id, name FROM schools")
        schools = cursor.fetchall()
        for s in schools:
            print(f"ID: {s['id']}, Name: {s['name']}")
            
        print("\n--- PRINCIPAL USER ---")
        cursor.execute("SELECT id, role, school_id, grade, is_super_admin FROM students WHERE id = 'principal_noble'")
        p = cursor.fetchone()
        if p:
            print(f"ID: {p['id']}, Role: {p['role']}, School ID: {p['school_id']}, Grade: {p['grade']}, Super Admin: {p['is_super_admin']}")
        else:
            print("Principal not found.")

        print("\n--- STUDENT COUNTS PER SCHOOL ---")
        cursor.execute("SELECT school_id, COUNT(*) as count FROM students WHERE role = 'Student' GROUP BY school_id")
        counts = cursor.fetchall()
        for c in counts:
            print(f"School ID: {c['school_id']}, Student Count: {c['count']}")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_db()
