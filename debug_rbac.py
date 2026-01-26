
import os
import psycopg2

DATABASE_URL = "postgresql://postgres:admin@localhost/edtech_db"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("\n--- ROLES ---")
    cur.execute("SELECT * FROM roles;")
    for row in cur.fetchall():
        print(row)

    print("\n--- PERMISSIONS ---")
    cur.execute("SELECT * FROM permissions;")
    for row in cur.fetchall():
        print(row)

    print("\n--- ROLE PERMISSIONS ---")
    cur.execute("SELECT * FROM role_permissions;")
    for row in cur.fetchall():
        print(row)

    print("\n--- USER ROLES (teacher) ---")
    cur.execute("SELECT * FROM user_roles WHERE user_id = 'teacher';")
    for row in cur.fetchall():
        print(row)

    print("\n--- PERMISSIONS FOR TEACHER USER ---")
    cur.execute("""
        SELECT DISTINCT p.code 
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN user_roles ur ON rp.role_id = ur.role_id
        WHERE ur.user_id = 'teacher'
    """)
    for row in cur.fetchall():
        print(row)
        
    cur.close()
    conn.close()
except Exception as e:
    print(e)
