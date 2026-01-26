
import sqlite3
import random
from datetime import datetime

DATABASE_URL = "edtech_fastapi_enhanced.db"

def seed_grades():
    conn = sqlite3.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # 1. Ensure Teachers Exist with specific grades
    # teacher_g1 -> Grade 1
    # teacher_g2 -> Grade 2
    
    # 0. Create Super Admin (The ONLY one who sees all)
    cursor.execute("DELETE FROM students WHERE id = 'superadmin'")
    cursor.execute("""
        INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score, role, school_id, is_super_admin)
        VALUES ('superadmin', 'Principal / Super Admin', 0, 'All', 100.0, 'English', 'admin123', 100.0, 100.0, 100.0, 'Admin', 1, 1)
    """)
    print("Created Super Admin: superadmin")

    # 1. Teachers & Students for Grades 1-5
    # Total Target: 50 Students (10 per grade)
    
    for grade in range(1, 6):
        # Create Teacher (NOT Super Admin)
        t_id = f"teacher_g{grade}"
        t_name = f"Teacher Grade {grade}"
        
        cursor.execute("DELETE FROM students WHERE id = ?", (t_id,))
        cursor.execute("""
            INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score, role, school_id, is_super_admin)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        """, (t_id, t_name, grade, 'All', 100.0, 'English', 'teacher123', 100.0, 100.0, 100.0, 'Teacher', 1))
        print(f"Created/Reset Teacher: {t_id} (Grade {grade})")

        # Create 10 Students for this Grade
        for i in range(1, 11):
            s_id = f"student_g{grade}_{i}"
            name = f"Student G{grade}-{i}"
            
            cursor.execute("DELETE FROM students WHERE id = ?", (s_id,))
            cursor.execute("""
                INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score, role, school_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (s_id, name, grade, 'General', 90.0 + (i%10), 'English', 'student123', 80.0, 80.0, 80.0, 'Student', 1))
            print(f"Created Student: {s_id} (Grade {grade})")

    # 4. Generate Backup Codes for all new users
    # Collect all IDs first
    all_new_ids = []
    for g in range(1, 6):
        all_new_ids.append(f"teacher_g{g}")
        for i in range(1, 11):
            all_new_ids.append(f"student_g{g}_{i}")
    now = datetime.now().isoformat()
    
    for uid in all_new_ids:
        # Clear old codes
        cursor.execute("DELETE FROM backup_codes WHERE user_id = ?", (uid,))
        # Add new default code
        cursor.execute("INSERT INTO backup_codes (user_id, code, created_at) VALUES (?, ?, ?)", (uid, '123456', now))

    conn.commit()
    conn.close()
    print("Seeding Complete!")

if __name__ == "__main__":
    seed_grades()
