
import os
import psycopg2
from psycopg2.extras import DictCursor

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def fix_school_data_v2():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
        cursor = conn.cursor()
        
        print("Fixing School Data linkage (Attempt 2)...")

        # 1. Identify IDs
        cursor.execute("SELECT id FROM schools WHERE name = 'Noble Nexus Academy'")
        rows = cursor.fetchall()
        noble_ids = [r['id'] for r in rows]
        print(f"Found existing 'Noble Nexus Academy' IDs: {noble_ids}")

        # 2. We want ID 1 to be the main one.
        # If ID 1 is NOT in noble_ids, it means ID 1 is currently named 'Demo School' (or something else).
        # We tried to rename ID 1 to 'Noble Nexus Academy' but failed because one already exists (likely ID 7).
        
        # Strategy: 
        # A. Delete the content-less Noble Nexus Academy (ID 7) first.
        # B. THEN Rename ID 1.
        
        for nid in noble_ids:
            if nid != 1:
                print(f"Deleting empty/duplicate School ID {nid}...")
                # Move any users just in case (though we expect none or few)
                cursor.execute("UPDATE students SET school_id = 1 WHERE school_id = %s", (nid,))
                cursor.execute("DELETE FROM schools WHERE id = %s", (nid,))
        
        # 3. Now rename ID 1 safely
        print("Renaming School ID 1 to 'Noble Nexus Academy'...")
        cursor.execute("UPDATE schools SET name = 'Noble Nexus Academy', address = '123 Main St', contact_email = 'contact@noblenexus.com' WHERE id = 1")

        # 4. Ensure Principal is in ID 1
        print("Ensuring 'principal_noble' is in School ID 1...")
        cursor.execute("UPDATE students SET school_id = 1 WHERE id = 'principal_noble'")

        conn.commit()
        print("Success! Data merged and linked to School ID 1.")
        
        conn.close()

    except Exception as e:
        print(f"Error: {e}")
        # Identify what ID 1 is currently
        try:
             conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
             cursor = conn.cursor()
             cursor.execute("SELECT * FROM schools WHERE id = 1")
             print("Current School ID 1:", dict(cursor.fetchone()))
             conn.close()
        except: pass

if __name__ == "__main__":
    fix_school_data_v2()
