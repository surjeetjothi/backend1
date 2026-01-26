
import os
import psycopg2
import random
from datetime import datetime, timedelta

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def seed_activities():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # 1. Fix Sequence
        try:
            print("Fixing activities_id_seq sequence...")
            cursor.execute("SELECT setval('activities_id_seq', (SELECT COALESCE(MAX(id), 0) FROM activities) + 1);")
            conn.commit()
        except Exception as e:
            print(f"Sequence fix warning (might not exist or be needed): {e}")
            conn.rollback()

        # 2. Get students
        cursor.execute("SELECT id FROM students WHERE role = 'Student'")
        students = cursor.fetchall()
        
        print(f"Seeding activities for {len(students)} students...")
        
        topics = ["Math Quiz", "Science Lab", "History Essay", "English Reading", "Physics Test"]
        difficulties = ["Easy", "Medium", "Hard"]
        
        for (student_id,) in students:
            # Check exist count
            cursor.execute("SELECT COUNT(*) FROM activities WHERE student_id = %s", (student_id,))
            count = cursor.fetchone()[0]
            
            if count < 3:
                num_to_add = random.randint(3, 6)
                for _ in range(num_to_add):
                    topic = random.choice(topics)
                    difficulty = random.choice(difficulties)
                    score = random.randint(35, 98) # Random score
                    time_spent = random.randint(15, 60)
                    days_ago = random.randint(0, 30)
                    date_str = (datetime.now() - timedelta(days=days_ago)).strftime("%Y-%m-%d")
                    
                    cursor.execute("""
                        INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min)
                        VALUES (%s, %s, %s, %s, %s, %s)
                    """, (student_id, date_str, topic, difficulty, score, time_spent))
                
        conn.commit()
        conn.close()
        print("Success! Activities seeded.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    seed_activities()
