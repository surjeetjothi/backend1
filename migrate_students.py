
import os
import psycopg2
from psycopg2.extras import DictCursor

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def move_students_to_noble_nexus():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
        cursor = conn.cursor()
        
        # 1. Get Noble Nexus School ID
        cursor.execute("SELECT id FROM schools WHERE name = 'Noble Nexus Academy'")
        school = cursor.fetchone()
        if not school:
            print("Noble Nexus Academy not found!")
            return
        
        noble_id = school['id']
        print(f"Noble Nexus Academy ID: {noble_id}")

        # 2. Move Named Students + top 20 others to Noble Nexus
        # Named students: 'S001', 'S002', 'SURJEET', 'DEVA', 'HARISH'
        
        # Update named students
        named_ids = ['S001', 'S002', 'SURJEET', 'DEVA', 'HARISH']
        placeholders = ','.join(['%s'] * len(named_ids))
        cursor.execute(f"UPDATE students SET school_id = %s WHERE id IN ({placeholders})", [noble_id] + named_ids)
        print(f"Moved {cursor.rowcount} named students to Noble Nexus.")

        # Move 20 random other students who are currently in School 1
        cursor.execute("""
            UPDATE students 
            SET school_id = %s 
            WHERE id IN (
                SELECT id FROM students 
                WHERE school_id = 1 AND role = 'Student' 
                AND id NOT IN ('S001', 'S002', 'SURJEET', 'DEVA', 'HARISH')
                LIMIT 20
            )
        """, (noble_id,))
        print(f"Moved {cursor.rowcount} other students to Noble Nexus.")
        
        # Also ensure 'teacher' account is in School 1 (or make a teacher for School 5?)
        # Let's create a teacher for Noble Nexus too so the Principal has staff
        teacher_id = "teacher_noble"
        cursor.execute("SELECT 1 FROM students WHERE id = %s", (teacher_id,))
        if not cursor.fetchone():
             cursor.execute("""
                INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, role, school_id, is_super_admin)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (teacher_id, 'Noble Teacher', 0, 'All', 100.0, 'English', 'teacher123', 'Teacher', noble_id, False))
             print("Created Noble Teacher.")
        else:
             cursor.execute("UPDATE students SET school_id = %s WHERE id = %s", (noble_id, teacher_id))
             print("Updated Noble Teacher school.")

        conn.commit()
        conn.close()
        print("Data migration complete.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    move_students_to_noble_nexus()
