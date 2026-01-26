
import os
import psycopg2
from psycopg2.extras import DictCursor

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def unify_data():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # 1. Get Noble Nexus School ID
        cursor.execute("SELECT id FROM schools WHERE name = 'Noble Nexus Academy'")
        school_res = cursor.fetchone()
        if not school_res:
             print("Noble Nexus Academy not found.")
             return
        noble_id = school_res[0]

        print(f"Unifying all users under Noble Nexus Academy (ID: {noble_id})...")

        # 2. Move ALL students (including 'teacher', 'admin', 'principal') to Noble Nexus
        cursor.execute("UPDATE students SET school_id = %s", (noble_id,))
        print(f"Updated {cursor.rowcount} users/students to School ID {noble_id}.")

        # 3. Ensure 'teacher' user has grade = 0 (view all)
        cursor.execute("UPDATE students SET grade = 0 WHERE id = 'teacher'")
        
        # 4. Ensure Principal has grade = 0
        cursor.execute("UPDATE students SET grade = 0 WHERE id LIKE 'principal%'")

        conn.commit()
        conn.close()
        print("Success! All students and teachers are now in Noble Nexus Academy and can view all grades.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    unify_data()
