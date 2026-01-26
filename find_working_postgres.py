import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
import sys

# Common credentials to test
# Format: (user, password, dbname)
CREDENTIALS = [
    (None, None, "edtech_db"),             # Current user, no password
    ("postgres", None, "edtech_db"),       # Postgres user, no password
    ("postgres", "postgres", "edtech_db"), # Standard default
    ("postgres", "password", "edtech_db"), # Another default
    ("surjeet", None, "edtech_db"),        # Explicit system user
]

def try_connect(user, password, dbname):
    try:
        if user and password:
            dsn = f"postgresql://{user}:{password}@localhost/{dbname}"
        elif user:
            dsn = f"postgresql://{user}@localhost/{dbname}"
        else:
            dsn = f"postgresql://localhost/{dbname}"
            
        print(f"Testing: {dsn} ...", end=" ")
        conn = psycopg2.connect(dsn)
        conn.close()
        print("SUCCESS!")
        return dsn
    except psycopg2.OperationalError as e:
        msg = str(e).strip()
        print(f"FAILED ({msg.splitlines()[0]})")
        
        # Check if error is specifically "database does not exist"
        if 'database "edtech_db" does not exist' in msg:
            print(f"  -> Database missing. Attempting to create it using maintenance DB...")
            if create_database(user, password):
                return try_connect(user, password, dbname) # Retry
        return None
    except Exception as e:
        print(f"ERROR: {e}")
        return None

def create_database(user, password):
    # Connect to default 'postgres' db to create new db
    try:
        if user and password:
            dsn = f"postgresql://{user}:{password}@localhost/postgres"
        elif user:
            dsn = f"postgresql://{user}@localhost/postgres"
        else:
            dsn = f"postgresql://localhost/postgres"
            
        conn = psycopg2.connect(dsn)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
        cur.execute("CREATE DATABASE edtech_db")
        cur.close()
        conn.close()
        print("  -> Database 'edtech_db' created successfully.")
        return True
    except Exception as e:
        print(f"  -> Failed to create database: {e}")
        return False

def main():
    print("--- Searching for valid PostgreSQL connection ---")
    
    valid_url = None
    
    for user, pwd, db in CREDENTIALS:
        url = try_connect(user, pwd, db)
        if url:
            valid_url = url
            break
            
    if valid_url:
        print(f"\nFOUND WORKING URL: {valid_url}")
        
        # Update .env file
        env_path = ".env"
        if os.path.exists(env_path):
            with open(env_path, "r") as f:
                content = f.read()
            
            if "DATABASE_URL=" in content:
                # Replace existing
                lines = content.splitlines()
                new_lines = [l if not l.startswith("DATABASE_URL=") else f"DATABASE_URL={valid_url}" for l in lines]
                with open(env_path, "w") as f:
                    f.write("\n".join(new_lines))
            else:
                # Append
                with open(env_path, "a") as f:
                    f.write(f"\nDATABASE_URL={valid_url}\n")
        else:
            with open(env_path, "w") as f:
                f.write(f"DATABASE_URL={valid_url}\n")
                
        print(f"Updated {env_path} with DATABASE_URL.")
    else:
        print("\nCould not find a working PostgreSQL connection.")
        print("Please ensure PostgreSQL is running and you know your credentials.")

if __name__ == "__main__":
    main()
