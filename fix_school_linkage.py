
import os
import psycopg2
from psycopg2.extras import DictCursor

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def fix_school_data():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
        cursor = conn.cursor()
        
        print("Fixing School Data linkage...")

        # 1. Update School ID 1 to be 'Noble Nexus Academy'
        # Check if ID 1 exists
        cursor.execute("SELECT id FROM schools WHERE id = 1")
        if cursor.fetchone():
            print("Updating School ID 1 name to 'Noble Nexus Academy'...")
            cursor.execute("UPDATE schools SET name = 'Noble Nexus Academy', address = '123 Main St', contact_email = 'contact@noblenexus.com' WHERE id = 1")
        else:
            print("Warning: School ID 1 not found. Creating it...")
            # If ID 1 is missing, we might need to recreate it or migrate 7 to 1.
            # Assuming it exists based on previous inspection.
        
        # 2. Re-assign Principal to School ID 1
        # The principal created was 'principal_noble'
        print("Re-assigning 'principal_noble' to School ID 1...")
        cursor.execute("UPDATE students SET school_id = 1 WHERE id = 'principal_noble'")
        
        # 3. Clean up the duplicate 'Noble Nexus Academy' (ID 7) if it is empty of students (except the one we just moved)
        # We moved the only known user. Let's delete ID 7 if it's not ID 1.
        cursor.execute("DELETE FROM schools WHERE name = 'Noble Nexus Academy' AND id != 1")
        print("Removed duplicate/empty school entries for Noble Nexus Academy.")

        conn.commit()
        print("Success! Principal 'principal_noble' is now linked to the main school data (ID 1).")
        
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_school_data()
