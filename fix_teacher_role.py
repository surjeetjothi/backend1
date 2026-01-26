
import psycopg2

DATABASE_URL = "postgresql://postgres:admin@localhost/edtech_db"
try:
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    # 1. Get a Teacher role ID that definitely has permissions
    # We join role_permissions to ensure this role has at least one permission
    cur.execute("""
        SELECT r.id 
        FROM roles r
        JOIN role_permissions rp ON r.id = rp.role_id
        WHERE r.name = 'Teacher'
        LIMIT 1
    """)
    role_row = cur.fetchone()
    
    if role_row:
        role_id = role_row[0]
        print(f"Found valid Teacher Role ID: {role_id}")
        
        # 2. Assign this role to user 'teacher'
        # Check if exists first
        cur.execute("SELECT * FROM user_roles WHERE user_id = 'teacher'")
        if cur.fetchone():
            print("User 'teacher' already has a role. Updating it to be safe.")
            cur.execute("UPDATE user_roles SET role_id = %s WHERE user_id = 'teacher'", (role_id,))
        else:
            print("User 'teacher' has no role. inserting.")
            cur.execute("INSERT INTO user_roles (user_id, role_id) VALUES ('teacher', %s)", (role_id,))
            
        conn.commit()
        print("Successfully assigned Role to 'teacher'.")
    else:
        print("CRITICAL: No 'Teacher' role found with permissions. RBAC is broken.")

    conn.close()
except Exception as e:
    print(f"Error: {e}")
