import psycopg2
# Use credentials from .env
DATABASE_URL = "postgresql://postgres:admin@localhost/edtech_db"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) FROM activities")
    count = cursor.fetchone()[0]
    print(f"Total activities in Postgres: {count}")
    conn.close()
except Exception as e:
    print(f"Error connecting to Postgres: {e}")
