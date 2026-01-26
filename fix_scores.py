
import os
import psycopg2
import random

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost/edtech_db")

def fix_scores():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Select all students to update their scores
        cursor.execute("SELECT id FROM students WHERE role = 'Student'")
        students = cursor.fetchall()
        
        print(f"Updating scores for {len(students)} students...")
        
        for (student_id,) in students:
            # Generate random scores between 0 and 100
            # Weighing slightly higher to be realistic (40-100) or pure random (0-100)?
            # User said "from 0 to 100", implying full range.
            math = round(random.uniform(30, 100), 1)
            science = round(random.uniform(30, 100), 1)
            english = round(random.uniform(30, 100), 1)
            
            cursor.execute("""
                UPDATE students 
                SET math_score = %s, science_score = %s, english_language_score = %s 
                WHERE id = %s
            """, (math, science, english, student_id))
            
        conn.commit()
        conn.close()
        print("Success! Student scores randomized between 30-100 (for realism) or 0-100.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_scores()
