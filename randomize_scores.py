
import os
import psycopg2
import random
from datetime import datetime, timedelta
from psycopg2.extras import DictCursor
import json

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def randomize_scores_and_activities():
    try:
        conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)
        cursor = conn.cursor()
        
        print("Starting Randomization Process...")

        # 1. Get all students
        cursor.execute("SELECT id FROM students WHERE role = 'Student'")
        students = cursor.fetchall()
        print(f"Found {len(students)} students.")

        subjects = ['Math', 'Science', 'English', 'History', 'Geography', 'Physics', 'Chemistry']
        difficulties = ['Easy', 'Medium', 'Hard']

        updated_count = 0
        
        for s in students:
            sid = s['id']
            
            # --- A. Randomize Base Stats ---
            # Generate somewhat realistic looking grades (skewed towards passing)
            math = round(random.uniform(45, 99), 1)
            science = round(random.uniform(45, 99), 1)
            english = round(random.uniform(45, 99), 1)
            attendance = round(random.uniform(60, 100), 1)
            
            cursor.execute("""
                UPDATE students 
                SET math_score = %s, 
                    science_score = %s, 
                    english_language_score = %s,
                    attendance_rate = %s
                WHERE id = %s
            """, (math, science, english, attendance, sid))
            
            # --- B. Randomize Activities (for Avg Activity Score) ---
            # Check existing count
            cursor.execute("SELECT COUNT(*) FROM activities WHERE student_id = %s", (sid,))
            count = cursor.fetchone()[0]
            
            # Ensure every student has at least 5-10 activities for a good average
            target_count = random.randint(5, 12)
            
            if count < target_count:
                needed = target_count - count
                for _ in range(needed):
                    # Random date in last 2 months
                    days_ago = random.randint(0, 60)
                    date_str = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
                    
                    topic = random.choice(subjects)
                    difficulty = random.choice(difficulties)
                    
                    # Score correlated with difficulty slightly
                    if difficulty == 'Easy':
                        score = round(random.uniform(70, 100), 1)
                    elif difficulty == 'Medium':
                        score = round(random.uniform(50, 95), 1)
                    else:
                        score = round(random.uniform(30, 90), 1)
                        
                    time_spent = random.randint(15, 60)
                    
                    cursor.execute("""
                        INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (sid, date_str, topic, difficulty, score, time_spent))
            
            updated_count += 1

        conn.commit()
        print(f"Successfully updated scores and activities for {updated_count} students.")
        
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    randomize_scores_and_activities()
