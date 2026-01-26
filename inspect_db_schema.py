
import os
import psycopg2

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/edtech_db")

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # Check announcements table
    cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'announcements';")
    columns = cur.fetchall()
    
    print("Columns in 'announcements':")
    for col in columns:
        print(col)
        
    cur.close()
    conn.close()
except Exception as e:
    print(e)
