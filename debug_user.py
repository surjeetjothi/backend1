import psycopg2

DATABASE_URL = "postgresql://postgres:admin@localhost/edtech_db"
try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    print("Connected.")
    cur.execute("SELECT id, name, role FROM students")
    rows = cur.fetchall()
    print(f"Found {len(rows)} students.")
    for row in rows:
        print(row)
    conn.close()
except Exception as e:
    print(f"Error: {e}")
