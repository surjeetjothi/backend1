
import os
import psycopg2
from psycopg2.extras import DictCursor
from datetime import datetime
import random

# Load correct DB URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def create_principal():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
        cursor = conn.cursor()
        
        # 1. Get Noble Nexus School ID
        cursor.execute("SELECT id FROM schools WHERE name = %s", ('Noble Nexus Academy',))
        school = cursor.fetchone()
        
        if not school:
            print("Error: Noble Nexus Academy not found. Creating it...")
            cursor.execute("INSERT INTO schools (name, address, contact_email, created_at) VALUES (%s, %s, %s, %s) RETURNING id", 
                           ('Noble Nexus Academy', '123 Main St', 'contact@noblenexus.com', datetime.now().isoformat()))
            school_id = cursor.fetchone()[0]
        else:
            school_id = school['id']
            print(f"Found Noble Nexus Academy (ID: {school_id})")

        # 2. Check/Create Principal User
        principal_id = "principal_noble"
        cursor.execute("SELECT * FROM students WHERE id = %s", (principal_id,))
        user = cursor.fetchone()
        
        if user:
            print(f"User '{principal_id}' already exists. Updating role to Principal.")
            cursor.execute("UPDATE students SET role = 'Principal', school_id = %s, password = 'principal123' WHERE id = %s", 
                           (school_id, principal_id))
        else:
            print(f"Creating new user '{principal_id}'...")
            cursor.execute("""
                INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, role, school_id, is_super_admin)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (principal_id, 'Noble Principal', 0, 'Administration', 100.0, 'English', 'principal123', 'Principal', school_id, False))

        # 3. Ensure 2FA Code
        code = "123456"
        cursor.execute("DELETE FROM backup_codes WHERE user_id = %s", (principal_id,))
        cursor.execute("INSERT INTO backup_codes (user_id, code, created_at) VALUES (%s, %s, %s)", 
                       (principal_id, code, datetime.now().isoformat()))
        
        conn.commit()
        print("Success! Principal created.")
        print(f"Username: {principal_id}")
        print("Password: principal123")
        print(f"2FA Code: {code}")
        
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_principal()
