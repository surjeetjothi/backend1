
import os
import psycopg2
import random
from datetime import datetime, timedelta
import uuid

from dotenv import load_dotenv

load_dotenv()

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/edtech_db")

NEW_SCHOOL_NAME = "Green Valley High"
NEW_SCHOOL_ADDRESS = "456 Education Lane, Springfield"
NEW_SCHOOL_EMAIL = "contact@greenvalley.edu"

STUDENT_NAMES = [
    "Alice Johnson", "Bob Smith", "Charlie Brown", "Diana Prince", "Ethan Hunt",
    "Fiona Gallagher", "George Martin", "Hannah Montana", "Ian Somerhalder", "Julia Roberts"
]

TEACHER_NAMES = [
    "Mr. Anderson", "Mrs. McGonagall"
]

def create_dummy_institution():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("Connected to database.")

        # 1. Create the new School
        print(f"Creating school: {NEW_SCHOOL_NAME}...")
        try:
            cursor.execute("""
                INSERT INTO schools (name, address, contact_email, created_at)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (NEW_SCHOOL_NAME, NEW_SCHOOL_ADDRESS, NEW_SCHOOL_EMAIL, datetime.now().strftime("%Y-%m-%d")))
            school_id = cursor.fetchone()[0]
            print(f"School created with ID: {school_id}")
        except psycopg2.errors.UniqueViolation:
            conn.rollback()
            print(f"School '{NEW_SCHOOL_NAME}' already exists. Fetching ID...")
            cursor.execute("SELECT id FROM schools WHERE name = %s", (NEW_SCHOOL_NAME,))
            school_id = cursor.fetchone()[0]
            print(f"Found existing School ID: {school_id}")

        # 2. Create Dummy Students
        print("Creating dummy students...")
        for name in STUDENT_NAMES:
            student_id = f"S{random.randint(10000, 99999)}"
            # Check if ID exists (simple retry logic could be better but sufficient for script)
            while True:
                cursor.execute("SELECT 1 FROM students WHERE id = %s", (student_id,))
                if not cursor.fetchone():
                    break
                student_id = f"S{random.randint(10000, 99999)}"

            grade = random.randint(9, 12)
            preferred_subject = random.choice(["Math", "Science", "History", "English"])
            attendance = round(random.uniform(70.0, 100.0), 1)
            math_score = round(random.uniform(50.0, 100.0), 1)
            science_score = round(random.uniform(50.0, 100.0), 1)
            english_score = round(random.uniform(50.0, 100.0), 1)

            cursor.execute("""
                INSERT INTO students (
                    id, name, grade, preferred_subject, attendance_rate, 
                    home_language, password, math_score, science_score, 
                    english_language_score, role, school_id
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Student', %s)
            """, (
                student_id, name, grade, preferred_subject, attendance, 
                "English", "Student@123", math_score, science_score, 
                english_score, school_id
            ))
            
            # 3. Seed Activities for each student
            seed_activities_for_student(cursor, student_id)

        # 4. Create Dummy Teachers
        print("Creating dummy teachers...")
        for name in TEACHER_NAMES:
            teacher_id = f"T{random.randint(1000, 9999)}"
            while True:
                cursor.execute("SELECT 1 FROM students WHERE id = %s", (teacher_id,))
                if not cursor.fetchone():
                    break
                teacher_id = f"T{random.randint(1000, 9999)}"
                
            cursor.execute("""
                 INSERT INTO students (
                    id, name, role, school_id, password
                ) VALUES (%s, %s, 'Teacher', %s, 'Teacher@123')
            """, (teacher_id, name, school_id))

        conn.commit()
        print("Dummy institution created successfully!")
        
    except Exception as e:
        print(f"Error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

def seed_activities_for_student(cursor, student_id):
    topics = ["Math Quiz", "Science Lab", "History Essay", "English Reading", "Physics Test"]
    difficulties = ["Easy", "Medium", "Hard"]
    
    num_to_add = random.randint(5, 10)
    for _ in range(num_to_add):
        topic = random.choice(topics)
        difficulty = random.choice(difficulties)
        score = random.randint(40, 100)
        time_spent = random.randint(15, 60)
        days_ago = random.randint(0, 30)
        date_str = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        
        cursor.execute("""
            INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (student_id, date_str, topic, difficulty, score, time_spent))

if __name__ == "__main__":
    create_dummy_institution()
