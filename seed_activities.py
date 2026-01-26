
import os
import psycopg2
import random
from datetime import datetime, timedelta

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def seed_activities():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # 1. Get all students
        cursor.execute("SELECT id FROM students WHERE role = 'Student'")
        students = cursor.fetchall()
        
        print(f"Seeding activities for {len(students)} students...")
        
        topics = ["Math Quiz", "Science Lab", "History Essay", "English Reading", "Physics Test"]
        difficulties = ["Easy", "Medium", "Hard"]
        
        for (student_id,) in students:
            # Check if student already has activities
            cursor.execute("SELECT COUNT(*) FROM activities WHERE student_id = %s", (student_id,))
            count = cursor.fetchone()[0]
            
            # If student has less than 3 activities, add more
            if count < 3:
                num_to_add = random.randint(3, 6)
                for _ in range(num_to_add):
                    topic = random.choice(topics)
                    difficulty = random.choice(difficulties)
                    score = random.randint(40, 100) # Random score 40-100 for realism, avoiding 0
                    time_spent = random.randint(15, 60)
                    # Random date in last 30 days
                    days_ago = random.randint(0, 30)
                    date_str = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
                    
                    cursor.execute("""
                        INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (student_id, date_str, topic, difficulty, score, time_spent))
                
        conn.commit()
        conn.close()
        print("Success! All students now have activity data.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    seed_activities()
