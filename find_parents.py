
import os
import psycopg2
from psycopg2.extras import DictCursor

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def find_parents():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
        cursor = conn.cursor()
        
        print("--- Searching for Parents ---")
        cursor.execute("SELECT id, name, role, school_id FROM students WHERE role = 'Parent'")
        parents = cursor.fetchall()
        
        if parents:
            print(f"Found {len(parents)} parents:")
            for p in parents:
                print(dict(p))
                
                # Check linked student (via guardians table usually, but let's see if simple linkage exists)
                # In this system, parents might login with the STUDENT'S ID in a 'Parent' mode, OR have their own ID.
                # Let's check guardians table too.
                cursor.execute("SELECT * FROM guardians WHERE email = %s OR phone = %s", (p['id'], p['id']))
                guardian_entry = cursor.fetchall()
                if guardian_entry:
                    print(f"  -> Linked Guardian Records: {len(guardian_entry)}")
        else:
            print("No users with role 'Parent' found in 'students' table.")

        print("\n--- Guardians Table Check ---")
        cursor.execute("SELECT * FROM guardians LIMIT 5")
        guardians = cursor.fetchall()
        for g in guardians:
            print(dict(g))

        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    find_parents()
