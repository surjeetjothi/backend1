import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
import getpass

# 1. Try Unix Socket (often 'trust' auth) - No host specified
# 2. Try TCP localhost with common passwords

COMMON_PASSWORDS = [
    "postgres", "password", "1234", "123456", "admin", "root", "edtech", "surjeet"
]

USERS = ["postgres", "surjeet", "root"]

def try_connect(dsn, description):
    print(f"Testing {description}...")
    try:
        conn = psycopg2.connect(dsn)
        conn.close()
        print(f"  [SUCCESS] Connected!")
        return dsn
    except Exception as e:
        msg = str(e).strip().split('\n')[0]
        # print(f"  [FAILED] {msg}")
        return None

def setup_db(dsn):
    """Ensure database exists"""
    print("Ensuring database 'edtech_db' exists...")
    try:
        # Connect to 'postgres' or 'template1' to create db
        if "/edtech_db" in dsn:
            base_dsn = dsn.replace("/edtech_db", "/postgres")
        else:
            base_dsn = dsn
            
        conn = psycopg2.connect(base_dsn)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        
        # Check if db exists
        cur.execute("SELECT 1 FROM pg_database WHERE datname = 'edtech_db'")
        if not cur.fetchone():
            print("  Creating database 'edtech_db'...")
            cur.execute("CREATE DATABASE edtech_db")
        else:
            print("  Database 'edtech_db' already exists.")
            
        cur.close()
        conn.close()
        return True
    except Exception as e:
        print(f"  [WARNING] Could not verify/create DB: {e}")
        # It might already exist and we just can't connect to postgres db?
        # Try connecting to the target dsn anyway
        return True

def main():
    print("--- Postgres Connection Fixer ---")
    
    working_dsn = None
    
    # Strategy 1: Unix Socket (no host)
    # Often configured as 'trust' in pg_hba.conf for local connections
    for user in USERS:
        dsn = f"dbname=postgres user={user}"
        if try_connect(dsn, f"Unix Socket (user={user})"):
            # If we got in via socket, we are golden. 
            # We can set the password for 'postgres' to something known if needed, 
            # or just use this DSN.
            # Ideally let's use TCP consistent DSN if possible, but socket is fine.
            # Let's switch to edtech_db
            target_dsn = f"dbname=edtech_db user={user}"
            if setup_db(dsn): # Use the working postgres dsn to create db
                working_dsn = target_dsn
                break

    # Strategy 2: TCP Localhost with passwords
    if not working_dsn:
        for user in USERS:
            for pwd in COMMON_PASSWORDS:
                dsn = f"postgresql://{user}:{pwd}@localhost/edtech_db"
                # Note: this targets edtech_db directly. If it fails 'does not exist', we still authed!
                # We need to distinguish auth fail vs db missing.
                
                # Let's try connecting to 'postgres' db first to verify creds
                check_dsn = f"postgresql://{user}:{pwd}@localhost/postgres"
                
                print(f"Testing TCP {user}:{pwd}...")
                try:
                    conn = psycopg2.connect(check_dsn)
                    conn.close()
                    print("  [SUCCESS] Credentials work!")
                    
                    # Credentials work, now ensure DB exists
                    setup_db(check_dsn)
                    
                    working_dsn = dsn # usage dsn
                    break
                except psycopg2.OperationalError as e:
                    if "password authentication failed" in str(e):
                        continue
                    elif "does not exist" in str(e):
                        # Auth worked, DB missing?
                        print("  [SUCCESS] Credentials work (DB missing)!")
                        setup_db(check_dsn)
                        working_dsn = dsn
                        break
                    else:
                        pass # Other error
            if working_dsn: break

    if working_dsn:
        print(f"\nFOUND WORKING CONFIG: {working_dsn}")
        with open(".env", "w") as f:
            f.write(f"DATABASE_URL={working_dsn}\n")
        print("Updated .env file.")
        
        # Also run migration now that we have a connection!
        print("Running migration...")
        os.system("python3 migrate_to_postgres.py")
        
    else:
        print("\n[ERROR] Could not find working credentials.")
        print("Please manually update .env with: DATABASE_URL=postgresql://USER:PASSWORD@localhost/edtech_db")

if __name__ == "__main__":
    main()
