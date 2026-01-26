
import os
import psycopg2
from psycopg2.extras import DictCursor

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def create_parent_demo():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
        cursor = conn.cursor()
        
        print("Creating Parent Demo Account...")
        
        # 1. Ensure Student 'S001' exists
        cursor.execute("SELECT id FROM students WHERE id = 'S001'")
        if not cursor.fetchone():
            print("Error: Student S001 not found. Please run seed script or create S001 first.")
            conn.close()
            return
            
        student_id = 'S001'
        parent_id = 'parent_demo'
        parent_name = 'Demo Parent'
        
        # 2. Create/Update Parent User in `students` table (as Users)
        # Assuming school_id 7/1 issue is resolved to 1
        school_id = 1
        
        cursor.execute("SELECT id FROM students WHERE id = %s", (parent_id,))
        if cursor.fetchone():
            print(f"User {parent_id} exists. Updating Role to Parent.")
            cursor.execute("UPDATE students SET role = 'Parent', password = '123', name = %s, school_id = %s WHERE id = %s", 
                           (parent_name, school_id, parent_id))
        else:
            print(f"Creating new user {parent_id}...")
            cursor.execute("""
                INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, role, school_id, is_super_admin)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (parent_id, parent_name, 0, 'General', 0.0, 'English', '123', 'Parent', school_id, False))
            
        # 3. Create Link in `guardians` table
        # We delete existing to avoid duplicate conflicts if running multiple times
        cursor.execute("DELETE FROM guardians WHERE email = %s", (parent_id,))
        
        cursor.execute("""
            INSERT INTO guardians (student_id, name, relationship, email, phone, is_emergency_contact)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (student_id, parent_name, 'Parent', parent_id, '555-0101', True))
        
        # 4. Add 2FA Bypass (or set code) for testing convenience if needed
        # We can set a fixed code
        cursor.execute("DELETE FROM backup_codes WHERE user_id = %s", (parent_id,))
        cursor.execute("INSERT INTO backup_codes (user_id, code, created_at) VALUES (%s, %s, NOW())", (parent_id, '123456'))

        conn.commit()
        print("Success! Parent demo created.")
        print(f"Username: {parent_id}")
        print("Password: 123")
        print(f"Linked Student: {student_id}")
        
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_parent_demo()
