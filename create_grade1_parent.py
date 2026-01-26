
import os
import psycopg2
from psycopg2.extras import DictCursor
import random
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def create_grade1_parent():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
        cursor = conn.cursor()
        
        print("--- Setting up Grade 1 Parent Demo ---")
        
        # 1. Find a Grade 1 Student
        cursor.execute("SELECT id, name FROM students WHERE role = 'Student' AND grade = 1 LIMIT 1")
        student = cursor.fetchone()
        
        if student:
            student_id = student['id']
            student_name = student['name']
            print(f"Found existing Grade 1 student: {student_name} ({student_id})")
        else:
            # Create Grade 1 Student
            student_id = "student_g1_demo"
            student_name = "Tiny Tim"
            print(f"No Grade 1 student found. Creating {student_name}...")
            
            cursor.execute("""
                INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, role, school_id, is_super_admin, math_score, science_score, english_language_score)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 95.0, 92.0, 88.0)
            """, (student_id, student_name, 1, 'Math', 95.0, 'English', '123', 'Student', 1, False))
            
            # Add some dummy activity for stats
            cursor.execute("""
                INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min)
                VALUES (%s, %s, 'Counting', 'Easy', 100, 15)
            """, (student_id, datetime.now().strftime('%Y-%m-%d')))
            
        
        # 2. Create Parent Account
        parent_id = "parent_g1"
        parent_name = f"Parent of {student_name}"
        
        # Upsert User
        cursor.execute("SELECT id FROM students WHERE id = %s", (parent_id,))
        if cursor.fetchone():
            cursor.execute("UPDATE students SET role = 'Parent', password = '123', name = %s, school_id = 1 WHERE id = %s", 
                           (parent_name, parent_id))
        else:
            cursor.execute("""
                INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, role, school_id, is_super_admin)
                VALUES (%s, %s, 0, 'General', 0.0, 'English', '123', 'Parent', 1, False)
            """, (parent_id, parent_name))
            
        # 3. Link via Guardians Table
        cursor.execute("DELETE FROM guardians WHERE email = %s", (parent_id,))
        cursor.execute("""
            INSERT INTO guardians (student_id, name, relationship, email, phone, is_emergency_contact)
            VALUES (%s, %s, 'Parent', %s, '555-0102', True)
        """, (student_id, parent_name, parent_id))
        
        # 4. 2FA Code
        cursor.execute("DELETE FROM backup_codes WHERE user_id = %s", (parent_id,))
        cursor.execute("INSERT INTO backup_codes (user_id, code, created_at) VALUES (%s, %s, NOW())", (parent_id, '123456'))

        conn.commit()
        
        print("\nSUCCESS! Grade 1 Parent Account Ready.")
        print(f"Username: {parent_id}")
        print("Password: 123")
        print(f"Child: {student_name} (Grade 1)")
        
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_grade1_parent()
