from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import sqlite3
import pandas as pd
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestClassifier
import numpy as np
import warnings 
import os # NEW: Import os for environment variables
from groq import Groq # NEW: Import Groq client


try:
    # Initialize the Groq Client. It automatically looks for the GROQ_API_KEY environment variable.
    GROQ_CLIENT = Groq(api_key="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")
    GROQ_MODEL = "llama-3.1-8b-instant" # The requested Llama 3.1 instance model
    AI_ENABLED = True
except Exception as e:
    # Handle cases where Groq library is not installed or other initialization errors
    print(f"ERROR: Failed to initialize Groq client. AI Chat disabled. Error: {e}")
    AI_ENABLED = False
# NOTE: Groq key handling and AI chat functionality are simplified/simulated
# to focus on the core dashboard logic and stability.

# --- 1. CONFIGURATION AND SETUP ---
app = FastAPI(title="EdTech AI Portal API - Enhanced")

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 2. Pydantic Models ---
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    success: bool = True
    user_id: str
    role: str

# ENHANCEMENT: Student Profile includes initial subject scores
class AddStudentRequest(BaseModel):
    id: str
    name: str
    grade: int
    preferred_subject: str
    attendance_rate: float
    home_language: str
    math_score: float # NEW
    science_score: float # NEW
    english_language_score: float # NEW
    password: str = "Student@123" # Default password for new students

class StudentHistory(BaseModel):
    date: str
    topic: str
    difficulty: str
    score: float
    time_spent_min: int

class StudentSummary(BaseModel):
    avg_score: float
    total_activities: int
    recommendation: Optional[str] = None
    # NEW: Include initial scores in summary response
    math_score: float
    science_score: float
    english_language_score: float

class StudentDataResponse(BaseModel):
    summary: StudentSummary
    history: List[StudentHistory]

class TeacherOverviewResponse(BaseModel):
    total_students: int
    class_attendance_avg: float
    class_score_avg: float
    roster: List[Dict[str, Any]] 

class AIChatRequest(BaseModel):
    prompt: str

class AIChatResponse(BaseModel):
    reply: str
    
    
# NEW: Model for manually adding an activity
class AddActivityRequest(BaseModel):
    student_id: str
    date: str
    topic: str
    difficulty: str
    score: float
    time_spent_min: int

# NEW: Model for updating student
class UpdateStudentRequest(BaseModel):
    name: str
    grade: int
    preferred_subject: str
    attendance_rate: float
    home_language: str
    math_score: float
    science_score: float
    english_language_score: float
    password: Optional[str] = None # NEW: Optional password update


# NEW: Models for Live Classes
class ClassScheduleRequest(BaseModel):
    teacher_id: str
    topic: str
    date: str # Format: YYYY-MM-DD HH:MM
    meet_link: str
    target_students: List[str] # NEW: List of student IDs

class ClassResponse(BaseModel):
    id: int
    teacher_id: str
    topic: str
    date: str
    meet_link: str
    target_students: List[str] # NEW
    
# NEW: Models for Class Groups
class GroupCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    subject: str # NEW

class MaterialCreateRequest(BaseModel):
    title: str
    type: str # 'Note', 'Quiz', 'Announcement'
    content: str # Link or text

class GroupMemberUpdateRequest(BaseModel):
    student_ids: List[str]

class GroupResponse(BaseModel):
    id: int
    name: str
    description: str
    subject: Optional[str] = "General" # NEW
    member_count: int

class MaterialResponse(BaseModel):
    id: int
    title: str
    type: str
    content: str
    date: str

class GenericSocialRequest(BaseModel):
    provider: str
    token: str


class LogoutRequest(BaseModel):
    user_id: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class InvitationRequest(BaseModel):
    role: str
    expiry_hours: int = 24

class InvitationResponse(BaseModel):
    link: str
    token: str
    expires_at: str


    
# --- 3. DATABASE (SQLite) Functions and Initialization ---

DATABASE_URL = "edtech_fastapi_enhanced.db" # New file for enhanced schema
MIN_ACTIVITIES = 5 

def get_db_connection():
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row
    return conn

def fetch_data_df(query, params=()):
    conn = get_db_connection()
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    return df

def initialize_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT,
        grade INTEGER,
        preferred_subject TEXT,
        attendance_rate REAL,
        home_language TEXT,
        password TEXT,
        math_score REAL,          -- ENHANCED
        science_score REAL,       -- ENHANCED
        english_language_score REAL, -- ENHANCED
        role TEXT DEFAULT 'Student', -- FR-3: Role-Based Registration
        failed_login_attempts INTEGER DEFAULT 0, -- FR-13: Account Lockout
        locked_until TEXT -- FR-13: Account Lockout
    )
    """)

    # Invitations Table (FR-4)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS invitations (
        token TEXT PRIMARY KEY,
        role TEXT,
        expires_at TEXT,
        is_used BOOLEAN DEFAULT 0
    )
    """)

    # Password Resets Table (New)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS password_resets (
        token TEXT PRIMARY KEY,
        user_id TEXT,
        expires_at TEXT
    )
    """)
    
    
    # MIGRATION: Add role column
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN role TEXT DEFAULT 'Student'")
    except sqlite3.OperationalError:
        pass # Column exists

    # MIGRATION: Add lockout columns (FR-13)
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN failed_login_attempts INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE students ADD COLUMN locked_until TEXT")
    except sqlite3.OperationalError:
        pass 

    # MIGRATION: Add score columns if missing (Fix for existing DBs)
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN math_score REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN science_score REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN english_language_score REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass 
    
    # Ensure Teacher has correct role
    cursor.execute("UPDATE students SET role = 'Teacher' WHERE id = 'teacher'")
    conn.commit()
    
    # Activities Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id TEXT,
        date TEXT,
        topic TEXT,
        difficulty TEXT,
        score REAL,
        time_spent_min INTEGER,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
    """)
    
    # IMPORTANT: Enable foreign key constraints for CASCADE DELETE
    cursor.execute("PRAGMA foreign_keys = ON")

    # Live Classes Table (NEW)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS live_classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id TEXT,
        topic TEXT,
        date TEXT,
        meet_link TEXT,
        target_students TEXT -- NEW: Comma-separated IDs, or 'ALL'
    )
    """)
    
    # Auth Logs Table (FR-14)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS auth_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        event_type TEXT, -- Login, Logout, Register, Failure
        timestamp TEXT,
        details TEXT
    )
    """)
    
    # MIGRATION LOADER (for existing DBs)
    try:
        cursor.execute("ALTER TABLE live_classes ADD COLUMN target_students TEXT")
    except sqlite3.OperationalError:
        pass # Column likely already exists



    cursor.execute("""
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        description TEXT,
        subject TEXT DEFAULT 'General'
    )
    """)
    
    # MIGRATION: Add subject column if missing
    try:
        cursor.execute("ALTER TABLE groups ADD COLUMN subject TEXT DEFAULT 'General'")
    except sqlite3.OperationalError:
        pass

    # Group Members Table (New)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER,
        student_id TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        PRIMARY KEY (group_id, student_id)
    )
    """)

    # Group Materials Table (NEW)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS group_materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        title TEXT,
        type TEXT,
        content TEXT,
        date TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    )
    """)

    # Seed data only if tables are empty
    if cursor.execute("SELECT COUNT(*) FROM students").fetchone()[0] == 0:
        students_data = [
            # ID, Name, Grade, Subject, Attend %, Language, Password, Math, Science, English, Role, FailedLogin, LockedUntil
            ('S001', 'Alice Smith', 9, 'Math', 92.5, 'English', '123', 85.0, 78.5, 90.0, 'Student', 0, None),
            ('S002', 'Bob Johnson', 10, 'Science', 85.0, 'Spanish', '123', 60.0, 95.0, 75.0, 'Student', 0, None),
            ('SURJEET', 'Surjeet J', 11, 'Physics', 77.0, 'Punjabi', '123', 70.0, 65.0, 80.0, 'Student', 0, None),
            ('DEVA', 'Deva Krishnan', 11, 'Chemistry', 90.0, 'Tamil', '123', 95.0, 88.0, 92.0, 'Student', 0, None),
            ('HARISH', 'Harish Boy', 5, 'English', 7.0, 'Hindi', '123', 50.0, 50.0, 45.0, 'Student', 0, None),
            # Teacher user
            ('teacher', 'Teacher Admin', 0, 'All', 100.0, 'English', 'teacher', 100.0, 100.0, 100.0, 'Teacher', 0, None), 
        ]
        cursor.executemany("INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score, role, failed_login_attempts, locked_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", students_data)

        activities_data = [
            # S001 Activities (Avg: 80)
            ('S001', '2025-11-01', 'Algebra', 'Medium', 95, 10),
            ('S001', '2025-11-03', 'Geometry', 'Medium', 65, 25), 
            ('S002', '2025-11-01', 'Physics', 'Medium', 40, 45),
            ('S002', '2025-11-02', 'Chemistry', 'Easy', 55, 30),
            # Harish Activity (Avg: 80)
            ('HARISH', '2025-11-10', 'Reading', 'Easy', 80, 15),
        ]
        for a in activities_data:
             cursor.execute("INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min) VALUES (?, ?, ?, ?, ?, ?)", a)
        
        conn.commit()
        
    # Ensure Teacher and Admin exist
    if not cursor.execute("SELECT id FROM students WHERE id = 'teacher'").fetchone():
         cursor.execute("INSERT INTO students VALUES ('teacher', 'Teacher Admin', 0, 'All', 100.0, 'English', 'teacher', 100.0, 100.0, 100.0, 'Teacher', 0, NULL)")
    
    if not cursor.execute("SELECT id FROM students WHERE id = 'admin'").fetchone():
         # Create Super Admin
         cursor.execute("INSERT INTO students VALUES ('admin', 'System Admin', 0, 'All', 100.0, 'English', 'admin', 100.0, 100.0, 100.0, 'Admin', 0, NULL)")


    conn.commit()
    conn.close()

initialize_db()

# --- 4. ML Engine Functions (Simplified for stability) ---

ML_MODEL = None
DIFF_LABEL_MAP = {0: 'Easy', 1: 'Medium', 2: 'Hard'}
DIFFICULTY_MAP = {'Easy': 0, 'Medium': 1, 'Hard': 2}

def train_recommendation_model():
    global ML_MODEL
    df = fetch_data_df("SELECT score, time_spent_min, difficulty FROM activities")
    
    if len(df) < MIN_ACTIVITIES:
        ML_MODEL = None
        return

    X = df[['score', 'time_spent_min']]
    y = [DIFFICULTY_MAP.get(d, 1) for d in df['difficulty']] 
    
    # Train the model
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        clf = RandomForestClassifier(n_estimators=50, random_state=42)
        clf.fit(X, y)
    
    ML_MODEL = clf

def get_recommendation(student_id: str) -> Optional[str]:
    # Re-train model (simplified)
    train_recommendation_model() 
    if not ML_MODEL:
        return "Not enough data (minimum 5 activities) to generate an ML-based recommendation."

    # Fetch last activity for prediction
    df_history = fetch_data_df("SELECT score, time_spent_min FROM activities WHERE student_id = ? ORDER BY date DESC LIMIT 1", (student_id,))
    
    if df_history.empty:
        return "No activity history available to base a recommendation on."

    last_activity = df_history.iloc[0]
    
    X_pred = np.array([[last_activity['score'], last_activity['time_spent_min']]])
    
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pred_idx = ML_MODEL.predict(X_pred)[0]
    
    rec_diff = DIFF_LABEL_MAP.get(pred_idx, 'Medium')
    return f"Based on your last score of {last_activity['score']}%, we recommend trying a **{rec_diff}** difficulty topic next!"

# Train on startup
train_recommendation_model()

# --- 5. API Endpoints ---

@app.get("/")
def read_root():
    return {"message": "EdTech AI Portal API (Enhanced) is running."}

# --- CONFIGURATION AND SETUP ---
import logging

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# --- HELPERS ---
def log_auth_event(user_id: str, event_type: str, details: str = ""):
    try:
        conn = get_db_connection()
        timestamp = datetime.now().isoformat()
        conn.execute("INSERT INTO auth_logs (user_id, event_type, timestamp, details) VALUES (?, ?, ?, ?)",
                     (user_id, event_type, timestamp, details))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to write auth log: {e}")

# --- AUTHENTICATION ---

@app.post("/api/auth/login", response_model=LoginResponse)
async def login_user(request: LoginRequest):
    logger.info(f"Login attempt for user: {request.username}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Fetch user data including security fields
    user = cursor.execute("SELECT id, name, password, role, failed_login_attempts, locked_until FROM students WHERE id = ?", 
                        (request.username,)).fetchone()
    
    if not user:
        conn.close()
        # To prevent user enumeration, we generic error, but for this MVP we stick to "Invalid credentials"
        logger.warning(f"Login failed for user: {request.username} - User not found")
        log_auth_event(request.username, "Login Failed", "User not found")
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    # FR-13: Check Account Lockout
    if user['locked_until']:
        lock_time = datetime.fromisoformat(user['locked_until'])
        if datetime.now() < lock_time:
            conn.close()
            remaining_min = int((lock_time - datetime.now()).total_seconds() / 60)
            log_auth_event(request.username, "Login Failed", "Account locked")
            raise HTTPException(status_code=403, detail=f"Account locked due to too many failed attempts. Try again in {remaining_min + 1} minutes.")
        else:
            # Lock expired, reset
            cursor.execute("UPDATE students SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", (request.username,))
            conn.commit()

    # Password Verification
    if user['password'] == request.password:
        # Success: Reset counters
        cursor.execute("UPDATE students SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", (request.username,))
        conn.commit()
        conn.close()
        
        role = user['role'] 
        logger.info(f"Login successful for user: {request.username} (Role: {role})")
        log_auth_event(request.username, "Login Success", f"Role: {role}")
        return LoginResponse(user_id=user['id'], role=role)
    else:
        # Failure: Increment counter
        new_attempts = (user['failed_login_attempts'] or 0) + 1
        
        if new_attempts >= 5: # Lockout Threshold
            lockout_duration = datetime.now() + timedelta(minutes=15)
            cursor.execute("UPDATE students SET failed_login_attempts = ?, locked_until = ? WHERE id = ?", 
                           (new_attempts, lockout_duration.isoformat(), request.username))
            conn.commit()
            conn.close()
            logger.warning(f"Account locked for user: {request.username}")
            log_auth_event(request.username, "Account Locked", "Too many failed attempts")
            raise HTTPException(status_code=403, detail="Account locked. Too many failed attempts. Try again in 15 minutes.")
        else:
            cursor.execute("UPDATE students SET failed_login_attempts = ? WHERE id = ?", (new_attempts, request.username))
            conn.commit()
            conn.close()
            remaining = 5 - new_attempts
            logger.warning(f"Login failed for user: {request.username} - Invalid password. Attempts: {new_attempts}")
            log_auth_event(request.username, "Login Failed", f"Invalid password. Attempts: {new_attempts}")
            raise HTTPException(status_code=401, detail=f"Invalid credentials. You have {remaining} attempts remaining.")

def validate_password_strength(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")
    if not any(char.isdigit() for char in password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number.")
    if not any(char.isalpha() for char in password):
        raise HTTPException(status_code=400, detail="Password must contain at least one letter.")
    if not any(not char.isalnum() for char in password):
        raise HTTPException(status_code=400, detail="Password must contain at least one special character.")
    return True

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    grade: Optional[int] = 9
    preferred_subject: Optional[str] = "General"
    role: str = "Student" # FR-3
    invitation_token: Optional[str] = None # FR-4

@app.post("/api/auth/register", status_code=201)
async def register_user(request: RegisterRequest):
    # FR-12: Password Policy
    validate_password_strength(request.password)

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # FR-4: Validate Invitation for Teachers or restricted roles
        if request.role == 'Teacher' or request.role == 'Admin':
             if not request.invitation_token:
                 raise HTTPException(status_code=403, detail="Invitation required for this role.")
             
             # Check token
             invite = cursor.execute("SELECT * FROM invitations WHERE token = ? AND is_used = 0", (request.invitation_token,)).fetchone()
             if not invite:
                 raise HTTPException(status_code=400, detail="Invalid or used invitation token.")
             
             if datetime.now() > datetime.fromisoformat(invite['expires_at']):
                 raise HTTPException(status_code=400, detail="Invitation expired.")
                 
             if invite['role'] != request.role:
                 raise HTTPException(status_code=400, detail="Token does not match the requested role.")
             
             # Consumed
             cursor.execute("UPDATE invitations SET is_used = 1 WHERE token = ?", (request.invitation_token,))
             
        # Basic duplication check
        if cursor.execute("SELECT id FROM students WHERE id = ?", (request.email,)).fetchone():
             raise HTTPException(status_code=400, detail="User ID/Email already exists.")
             
        cursor.execute(
            """
            INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score, role)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request.email, request.name, request.grade, request.preferred_subject, 
                100.0, 'English', request.password, 
                0.0, 0.0, 0.0, request.role
            )
        )
        conn.commit()
        log_auth_event(request.email, "Register Success", f"Role: {request.role}")
        return {"message": "Registration successful", "user_id": request.email}
    except sqlite3.IntegrityError:
         log_auth_event(request.email, "Register Failed", "User ID already exists")
         raise HTTPException(status_code=400, detail="User ID already exists.")
    except Exception as e:
        conn.rollback()
        log_auth_event(request.email, "Register Failed", f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")
    finally:
        conn.close()

# --- RBAC CONFIGURATION ---
ROLE_PERMISSIONS = {
    "Admin": [
        "view_dashboard", "manage_users", "manage_invitations", 
        "view_all_grades", "edit_all_grades", 
        "schedule_active_class", "manage_groups"
    ],
    "Teacher": [
        "view_dashboard", "invite_students", 
        "view_all_grades", "edit_all_grades", 
        "schedule_active_class", "manage_groups"
    ],
    "Student": [
        "view_dashboard", "view_own_grades", "join_active_class"
    ],
    "Parent": [
        "view_dashboard", "view_child_grades"
    ]
}

def check_permission(user_role: str, required_permission: str) -> bool:
    if user_role not in ROLE_PERMISSIONS:
        return False
    return required_permission in ROLE_PERMISSIONS[user_role]



from fastapi import Depends, Header

async def verify_permission(permission: str, x_user_role: str = Header(None, alias="X-User-Role"), x_user_id: str = Header(None, alias="X-User-Id")):
    """
    Dependency to verify if the user has the required permission.
    Expects X-User-Role and X-User-Id headers for simplicity in this MVP.
    In a real app, this would decode a JWT or check the session.
    """
    if not x_user_role:
        # Fallback: try to fetch from DB if only ID is provided (less performant but safer)
        if x_user_id:
            conn = get_db_connection()
            user = conn.execute("SELECT role FROM students WHERE id = ?", (x_user_id,)).fetchone()
            conn.close()
            if user:
                x_user_role = user['role']
            else:
                raise HTTPException(status_code=401, detail="User not found")
        else:
             raise HTTPException(status_code=401, detail="Authentication required")

    if not check_permission(x_user_role, permission):
        log_auth_event(x_user_id or "unknown", "Unauthorized Access", f"Missing permission: {permission}")
        raise HTTPException(status_code=403, detail=f"Permission denied: {permission} required.")
    
    return True

# --- LOGOUT ENDPOINT ---
@app.post("/api/auth/logout")
async def logout_user(request: LogoutRequest):
    logger.info(f"Logout for user: {request.user_id}")
    log_auth_event(request.user_id, "Logout", "User logged out")
    return {"message": "Logged out successfully"}

@app.get("/api/auth/permissions")
async def get_role_permissions():
    """Returns the Role-Permission mapping table."""
    return ROLE_PERMISSIONS


# --- SOCIAL LOGIN ENDPOINTS (FR-2) ---

class SocialTokenRequest(BaseModel):
    token: str

@app.post("/api/auth/google-login", response_model=LoginResponse)
async def google_login(request: SocialTokenRequest):
    # In a real app, verify the Google Token here
    # For now, we simulate a successful login/signup for a Google user
    logger.info("Processing Google Login")
    user_email = "google_user@example.com" # Simulated extraction from token
    
    # Check/Create user
    conn = get_db_connection()
    user = conn.execute("SELECT id FROM students WHERE id = ?", (user_email,)).fetchone()
    
    if not user:
        # Auto-register
        conn.execute("INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                     (user_email, "Google User", 9, "Science", 100.0, "English", "social_login", 0.0, 0.0, 0.0))
        conn.commit()
        log_auth_event(user_email, "Register Success", "Google Auto-Register")
    
    conn.close()
    
    log_auth_event(user_email, "Login Success", "Google Login")
    return LoginResponse(user_id=user_email, role='Student')

@app.post("/api/auth/microsoft-login", response_model=LoginResponse)
async def microsoft_login(request: SocialTokenRequest):
    logger.info("Processing Microsoft Login")
    user_email = "ms_user@example.com"
    
    conn = get_db_connection()
    user = conn.execute("SELECT id FROM students WHERE id = ?", (user_email,)).fetchone()
    
    if not user:
        conn.execute("INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                     (user_email, "Microsoft User", 9, "Math", 100.0, "English", "social_login", 0.0, 0.0, 0.0))
        conn.commit()
        log_auth_event(user_email, "Register Success", "Microsoft Auto-Register")

    conn.close()
    
    log_auth_event(user_email, "Login Success", "Microsoft Login")
    return LoginResponse(user_id=user_email, role='Student')

@app.post("/api/auth/social-login", response_model=LoginResponse)
async def generic_social_login(request: GenericSocialRequest):
    logger.info(f"Processing {request.provider} Login")
    user_id = f"{request.provider.lower()}_user"
    
    conn = get_db_connection()
    user = conn.execute("SELECT id FROM students WHERE id = ?", (user_id,)).fetchone()
    
    if not user:
        conn.execute("INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                     (user_id, f"{request.provider} User", 9, "General", 100.0, "English", "social_login", 0.0, 0.0, 0.0))
        conn.commit()
        log_auth_event(user_id, "Register Success", f"{request.provider} Auto-Register")

    conn.close()
    
    log_auth_event(user_id, "Login Success", f"{request.provider} Login")
    return LoginResponse(user_id=user_id, role='Student')

class ForgotPasswordRequest(BaseModel):
    email: str

@app.post("/api/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    logger.info(f"Password reset requested for: {request.email}")
    
    conn = get_db_connection()
    user = conn.execute("SELECT id FROM students WHERE id = ?", (request.email,)).fetchone()
    
    if user:
        # Generate Token
        import uuid
        token = str(uuid.uuid4())
        expires_at = (datetime.now() + timedelta(minutes=15)).isoformat()
        
        conn.execute("INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)", 
                     (token, request.email, expires_at))
        conn.commit()
        conn.close()
        
        link = f"http://127.0.0.1:8000/?reset_token={token}"
        log_auth_event(request.email, "Password Reset Requested", f"Token generated (Dev Link: {link})")
        
        # DEV MODE: Returning the link directly so user can click it
        return {
            "message": "Reset link generated (DEV MODE).", 
            "dev_link": link 
        }
    else:
        conn.close()
        log_auth_event(request.email, "Password Reset Requested", "User not found")
        return {"message": "If an account exists, a reset link has been sent."}

@app.post("/api/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    conn = get_db_connection()
    try:
        # Verify Token
        reset_entry = conn.execute("SELECT user_id, expires_at FROM password_resets WHERE token = ?", (request.token,)).fetchone()
        
        if not reset_entry:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
            
        if datetime.now() > datetime.fromisoformat(reset_entry['expires_at']):
            conn.execute("DELETE FROM password_resets WHERE token = ?", (request.token,))
            conn.commit()
            raise HTTPException(status_code=400, detail="Reset token has expired.")
            
        # Update Password
        validate_password_strength(request.new_password)
        conn.execute("UPDATE students SET password = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?", (request.new_password, reset_entry['user_id']))
        
        # Invalidate Token
        conn.execute("DELETE FROM password_resets WHERE token = ?", (request.token,))
        conn.commit()
        
        log_auth_event(reset_entry['user_id'], "Password Reset Success", "Password updated via token & Account unlocked")
        return {"message": "Password reset successfully. You can now login."}
        
    finally:
        conn.close()

# --- TEACHER DASHBOARD ---

@app.get("/api/teacher/overview", response_model=TeacherOverviewResponse)
async def get_teacher_overview(
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    if not check_permission(x_user_role, "view_all_grades"):
        # Log strictly
        log_auth_event(x_user_id or "unknown", "Unauthorized Access", "Attempted to view teacher overview")
        raise HTTPException(status_code=403, detail="Permission denied.")

    # Fetch all students including their initial scores
    students_df = fetch_data_df("SELECT id, name, grade, preferred_subject, attendance_rate, home_language, math_score, science_score, english_language_score FROM students WHERE role = 'Student'")
    
    if students_df.empty:
        return TeacherOverviewResponse(total_students=0, class_attendance_avg=0.0, class_score_avg=0.0, roster=[])

    activities_df = fetch_data_df("SELECT student_id, score FROM activities")
    
    # Calculate average scores from activities
    avg_scores = activities_df.groupby('student_id')['score'].mean().reset_index()
    avg_scores.columns = ['id', 'Avg Score']
    
    # Merge student and score data, filling NaN (students with no activities) with 0
    teacher_df = students_df.merge(avg_scores, on='id', how='left').fillna({'Avg Score': 0})
    
    # Calculate an overall Initial Score for roster display (simple average of the three)
    teacher_df['Overall Initial Score'] = teacher_df[['math_score', 'science_score', 'english_language_score']].mean(axis=1)

    # Format for the frontend roster table
    roster_list = teacher_df.apply(lambda row: {
        "ID": row['id'],
        "Name": row['name'],
        "Grade": row['grade'],
        "Attendance %": round(row['attendance_rate'], 1),
        "Avg Activity Score": round(row['Avg Score'], 1), # Renamed for clarity
        "Initial Score": round(row['Overall Initial Score'], 1), # NEW
        "Subject": row['preferred_subject'],
        "Home Language": row['home_language'],
    }, axis=1).to_list()
    
    # Calculate class averages only from actual student data
    class_avg_score = teacher_df['Avg Score'].mean() if not teacher_df.empty else 0.0
    class_avg_attendance = teacher_df['attendance_rate'].mean() if not teacher_df.empty else 0.0


    return TeacherOverviewResponse(
        total_students=len(teacher_df),
        class_attendance_avg=round(class_avg_attendance, 1),
        class_score_avg=round(class_avg_score, 1),
        roster=roster_list
    )

# --- STUDENT MANAGEMENT (NEW CRUD ENDPOINTS) ---

@app.post("/api/students/add", status_code=201)
async def add_new_student(
    request: AddStudentRequest, 
    x_user_role: str = Header(None, alias="X-User-Role"), 
    x_user_id: str = Header(None, alias="X-User-Id")
):
    # RBAC Check: manage_users
    if not check_permission(x_user_role, "manage_users") and not check_permission(x_user_role, "invite_students"):
         # Allow teachers to add students too if they have 'invite_students' or similar, 
         # but strict RBAC says 'manage_users'. Let's allow 'manage_users' (Admin) OR 'invite_students' (Teacher)
         log_auth_event(x_user_id or "unknown", "Unauthorized Access", "Attempted to add student without permission")
         raise HTTPException(status_code=403, detail="Permission denied. You cannot add students.")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request.id, request.name, request.grade, request.preferred_subject, 
                request.attendance_rate, request.home_language, request.password,
                request.math_score, request.science_score, request.english_language_score
            )
        )
        conn.commit()
        return {"message": f"Student {request.id} ({request.name}) added successfully."}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail=f"Student ID '{request.id}' already exists.")
    finally:
        conn.close()


@app.post("/api/invitations/generate", response_model=InvitationResponse)
async def generate_invitation(request: InvitationRequest):
    import uuid, datetime
    token = str(uuid.uuid4())[:8]
    expires_at = (datetime.datetime.now() + datetime.timedelta(hours=request.expiry_hours)).isoformat()
    
    conn = get_db_connection()
    conn.execute("INSERT INTO invitations (token, role, expires_at) VALUES (?, ?, ?)", 
                 (token, request.role, expires_at))
    conn.commit()
    conn.close()
    
    # In a real app, this would be a full URL
    return InvitationResponse(link=f"?invite={token}", token=token, expires_at=expires_at)

@app.put("/api/students/{student_id}")
async def update_student(
    student_id: str, 
    request: UpdateStudentRequest,
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    if not check_permission(x_user_role, "edit_all_grades"):
        log_auth_event(x_user_id or "unknown", "Unauthorized Access", "Attempted to edit student without permission")
        raise HTTPException(status_code=403, detail="Permission denied.")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Check if student exists
        result = cursor.execute("SELECT id FROM students WHERE id = ?", (student_id,)).fetchone()
        if result is None:
            raise HTTPException(status_code=404, detail=f"Student ID '{student_id}' not found.")
            
        cursor.execute(
            """
            UPDATE students 
            SET name = ?, grade = ?, preferred_subject = ?, attendance_rate = ?, home_language = ?,
                math_score = ?, science_score = ?, english_language_score = ?
            WHERE id = ?
            """,
            (
                request.name, request.grade, request.preferred_subject, 
                request.attendance_rate, request.home_language,
                request.math_score, request.science_score, request.english_language_score,
                student_id
            )
        )
        
        # Password Update logic
        if request.password and request.password.strip():
            validate_password_strength(request.password)
            cursor.execute("UPDATE students SET password = ? WHERE id = ?", (request.password, student_id))
            log_auth_event(student_id, "Password Changed", f"Admin/Teacher ({x_user_id}) updated password")

        conn.commit()
        return {"message": f"Student {student_id} updated successfully."}
    finally:
        conn.close()


@app.delete("/api/students/{student_id}")
async def delete_student(student_id: str):
    if student_id == 'teacher':
        raise HTTPException(status_code=403, detail="Cannot delete the teacher user.")
        
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Check if student exists
        result = cursor.execute("SELECT id FROM students WHERE id = ?", (student_id,)).fetchone()
        if result is None:
            raise HTTPException(status_code=404, detail=f"Student ID '{student_id}' not found.")
            
        # Delete student (Activities are CASCADE deleted by the foreign key constraint)
        cursor.execute("DELETE FROM students WHERE id = ?", (student_id,))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Student ID '{student_id}' not found.")
            
        conn.commit()
        return {"message": f"Student {student_id} and all related activities deleted successfully."}
    finally:
        conn.close()
        







# --- ACTIVITY MANAGEMENT (NEW ENDPOINT) ---

@app.post("/api/activities/add", status_code=201)
async def add_new_activity(
    request: AddActivityRequest,
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    if not check_permission(x_user_role, "edit_all_grades"):
         log_auth_event(x_user_id or "unknown", "Unauthorized Access", "Attempted to add activity without permission")
         raise HTTPException(status_code=403, detail="Permission denied.")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Check if student exists
        student_check = cursor.execute("SELECT id FROM students WHERE id = ?", (request.student_id,)).fetchone()
        if student_check is None:
            raise HTTPException(status_code=404, detail=f"Student ID '{request.student_id}' not found.")
            
        cursor.execute(
            """
            INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                request.student_id, request.date, request.topic, request.difficulty, 
                request.score, request.time_spent_min
            )
        )
        conn.commit()
        
        # Re-train model after new data insertion
        train_recommendation_model()
        
        return {"message": f"Activity for student {request.student_id} added successfully."}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException) and e.status_code == 404:
             raise e
        raise HTTPException(status_code=500, detail=f"An error occurred during DB operation: {e}")
    finally:
        conn.close()


# --- AI CHAT ---

@app.post("/api/ai/chat/{student_id}", response_model=AIChatResponse)
async def chat_with_ai_tutor(student_id: str, request: AIChatRequest):
    # Check if Groq client was successfully initialized
    if not AI_ENABLED:
        reply = "The live AI service is currently disabled. Please ensure the 'groq' library is installed and the GROQ_API_KEY environment variable is set."
        return AIChatResponse(reply=reply)
        
    # Define the AI's persona and instructions using a system message
    system_prompt = (
        "You are an expert Academic Advisor and AI Tutor running on the Groq Llama 3.1 instant model. "
        "Your goal is to answer ANY questions related to education, subjects (Math, Science, History, etc.), "
        "study strategies, and academic topics. "
        "CRITICAL: Keep your answers CONCISE, FRIENDLY, and 'SWEET'. "
        "Avoid long paragraphs. Use bullet points and short sentences significantly. "
        "Do not overwhelm the student with text. Get straight to the point with a supportive tone. "
        "If the query is clearly not related to education (e.g. entertainment, sports), politely steer back to learning. "
        "The student's ID is {student_id}."
    ).format(student_id=student_id)
    
    # ENHANCEMENT: Inject Student Context (In-Context Learning)
    try:
        # Fetch detailed performance data
        df_history = fetch_data_df("SELECT topic, difficulty, score FROM activities WHERE student_id = ? ORDER BY date DESC LIMIT 5", (student_id,))
        
        if not df_history.empty:
            # Convert to string format for the LLM
            history_text = "\n".join([f"- {row['topic']} ({row['difficulty']}): {row['score']}%" for _, row in df_history.iterrows()])
            system_prompt += f"\n\nContext - Recent Student Activity:\n{history_text}\n\nUse this data to provide specific compliments or improvement tips."
            
        # Also fetch their profile/initial scores
        df_profile = fetch_data_df("SELECT grade, preferred_subject, math_score, science_score FROM students WHERE id = ?", (student_id,))
        if not df_profile.empty:
            prof = df_profile.iloc[0]
            system_prompt += f"\n\nStudent Profile: Grade {prof['grade']}, Prefers {prof['preferred_subject']}. Initial Scores: Math={prof['math_score']}, Science={prof['science_score']}."
            
    except Exception as e:
        print(f"Error fetching context for AI: {e}")
        # Continue without context if DB fails


    try:
        # Call the Groq Chat Completion API
        chat_completion = GROQ_CLIENT.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.7, # Adjust for creativity/factual balance
            max_tokens=500
        )
        
        # Extract the repl
        reply = chat_completion.choices[0].message.content
        
    except Exception as e:
        print(f"Groq API Error for student {student_id}: {e}")
        # Return a polite error message instead of crashing
        reply = "I'm sorry, I encountered an error while connecting to the Groq AI service. Please try again later or contact support."
        
    return AIChatResponse(reply=reply)

# --- STUDENT DATA (UPDATED) ---

@app.get("/api/students/all")
async def get_all_students_list():
    df = fetch_data_df("SELECT id, name, attendance_rate, grade FROM students WHERE role = 'Student'")
    return df.to_dict('records') 

@app.get("/api/students/{student_id}/data", response_model=StudentDataResponse)
async def get_student_data(student_id: str):
    # Fetch initial scores and profile data
    student_profile = fetch_data_df("SELECT math_score, science_score, english_language_score FROM students WHERE id = ?", (student_id,)).to_dict('records')

    if not student_profile:
        raise HTTPException(status_code=404, detail=f"Student ID '{student_id}' not found.")
    
    profile = student_profile[0]

    # Fetch activities history
    history_df = fetch_data_df("SELECT date, topic, difficulty, score, time_spent_min FROM activities WHERE student_id = ? ORDER BY date ASC", (student_id,))
    
    avg_score = history_df['score'].mean() if not history_df.empty else 0.0
    total_activities = len(history_df)
    recommendation = get_recommendation(student_id)

    history_list = [
        StudentHistory(
            date=row['date'],
            topic=row['topic'],
            difficulty=row['difficulty'],
            score=row['score'],
            time_spent_min=row['time_spent_min']
        ) for _, row in history_df.iterrows()
    ]

    return StudentDataResponse(
        summary=StudentSummary(
            avg_score=round(avg_score, 1), 
            total_activities=total_activities, 
            recommendation=recommendation,
            math_score=profile['math_score'],       # ENHANCED
            science_score=profile['science_score'], # ENHANCED
            english_language_score=profile['english_language_score'] # ENHANCED
        ),
        history=history_list
    )

# --- GROUP MANAGEMENT (NEW) ---

@app.post("/api/groups", status_code=201)
async def create_group(
    request: GroupCreateRequest,
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    if not check_permission(x_user_role, "manage_groups"):
         log_auth_event(x_user_id or "unknown", "Unauthorized Access", "Attempted to create group without permission")
         raise HTTPException(status_code=403, detail="Permission denied.")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO groups (name, description, subject) VALUES (?, ?, ?)", 
                       (request.name, request.description, request.subject))
        conn.commit()
        return {"message": f"Group '{request.name}' created successfully."}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Group name must be unique.")
    finally:
        conn.close()

@app.get("/api/groups", response_model=List[GroupResponse])
async def get_groups():
    conn = get_db_connection()
    query = """
        SELECT g.id, g.name, g.description, g.subject, COUNT(gm.student_id) as member_count
        FROM groups g
        LEFT JOIN group_members gm ON g.id = gm.group_id
        GROUP BY g.id
    """
    groups = conn.execute(query).fetchall()
    conn.close()
    
    return [GroupResponse(
        id=r['id'], 
        name=r['name'], 
        description=r['description'], 
        subject=r['subject'],
        member_count=r['member_count']
    ) for r in groups]

@app.delete("/api/groups/{group_id}")
async def delete_group(group_id: int):
    conn = get_db_connection()
    conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))
    conn.commit()
    conn.close()
    return {"message": "Group deleted."}

@app.get("/api/groups/{group_id}/members")
async def get_group_members(group_id: int):
    conn = get_db_connection()
    # Get group info
    group = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
    if not group:
        conn.close()
        raise HTTPException(status_code=404, detail="Group not found")
        
    # Get members
    members = conn.execute("SELECT student_id FROM group_members WHERE group_id = ?", (group_id,)).fetchall()
    member_ids = [m['student_id'] for m in members]
    conn.close()
    return {"group": dict(group), "members": member_ids}

@app.post("/api/groups/{group_id}/members")
async def update_group_members(group_id: int, request: GroupMemberUpdateRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Verify group exists
        if not cursor.execute("SELECT id FROM groups WHERE id = ?", (group_id,)).fetchone():
             raise HTTPException(status_code=404, detail="Group not found")

        # Configured to overwrite members (simpler for checkboxes UI)
        cursor.execute("DELETE FROM group_members WHERE group_id = ?", (group_id,))
        
        if request.student_ids:
            data = [(group_id, sid) for sid in request.student_ids]
            cursor.executemany("INSERT INTO group_members (group_id, student_id) VALUES (?, ?)", data)
            
        conn.commit()
        return {"message": "Group members updated."}
    except sqlite3.IntegrityError: # e.g. student_id doesn't exist
        raise HTTPException(status_code=400, detail="Invalid student ID provided.")
    finally:
        conn.close()

# --- GROUP MATERIALS API ---

@app.post("/api/groups/{group_id}/materials")
async def add_group_material(group_id: int, request: MaterialCreateRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        date_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("INSERT INTO group_materials (group_id, title, type, content, date) VALUES (?, ?, ?, ?, ?)",
                       (group_id, request.title, request.type, request.content, date_str))
        conn.commit()
        return {"message": "Material added."}
    finally:
        conn.close()

@app.get("/api/groups/{group_id}/materials", response_model=List[MaterialResponse])
async def get_group_materials(group_id: int):
    conn = get_db_connection()
    materials = conn.execute("SELECT * FROM group_materials WHERE group_id = ? ORDER BY id DESC", (group_id,)).fetchall()
    conn.close()
    return [MaterialResponse(id=m['id'], title=m['title'], type=m['type'], content=m['content'], date=m['date']) for m in materials]

@app.get("/api/students/{student_id}/groups", response_model=List[GroupResponse])
async def get_student_groups(student_id: str):
    conn = get_db_connection()
    query = """
        SELECT g.id, g.name, g.description, g.subject
        FROM groups g
        JOIN group_members gm ON g.id = gm.group_id
        WHERE gm.student_id = ?
    """
    groups = conn.execute(query, (student_id,)).fetchall()
    conn.close()
    return [GroupResponse(id=r['id'], name=r['name'], description=r['description'], subject=r['subject'], member_count=0) for r in groups]



# --- LIVE CLASS MANAGEMENT (NEW) ---

class ClassStatusResponse(BaseModel):
    is_active: bool
    meet_link: Optional[str] = None

class StartClassRequest(BaseModel):
    meet_link: str



# --- LIVE CLASSES ENDPOINTS (NEW) ---

@app.post("/api/classes/schedule", status_code=201)
async def schedule_class(
    request: ClassScheduleRequest,
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    if not check_permission(x_user_role, "schedule_active_class"):
         log_auth_event(x_user_id or "unknown", "Unauthorized Access", "Attempted to schedule class without permission")
         raise HTTPException(status_code=403, detail="Permission denied.")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Convert list to comma-string
        targets = ",".join(request.target_students)
        cursor.execute(
            "INSERT INTO live_classes (teacher_id, topic, date, meet_link, target_students) VALUES (?, ?, ?, ?, ?)",
            (request.teacher_id, request.topic, request.date, request.meet_link, targets)
        )
        conn.commit()
        return {"message": "Live class scheduled successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        conn.close()

@app.get("/api/classes/upcoming", response_model=List[ClassResponse])
async def get_upcoming_classes(student_id: Optional[str] = None):
    conn = get_db_connection()
    classes = conn.execute("SELECT * FROM live_classes ORDER BY date ASC").fetchall()
    conn.close()
    
    results = []
    for row in classes:
        targets_str = row['target_students'] if row['target_students'] else "ALL"
        target_list = targets_str.split(',')
        
        # Filter logic:
        # If student_id provided, include ONLY if they are in the list or list is ALL (or empty)
        # If no student_id (Teacher/Admin), include everything
        if student_id:
            if "ALL" not in target_list and student_id not in target_list:
                continue 
        
        results.append(ClassResponse(
            id=row['id'],
            teacher_id=row['teacher_id'],
            topic=row['topic'],
            date=row['date'],
            meet_link=row['meet_link'],
            target_students=target_list
        ))
    return results

@app.delete("/api/classes/{class_id}")
async def delete_class(class_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM live_classes WHERE id = ?", (class_id,))
    conn.commit()
    conn.close()
    return {"message": "Class cancelled."}

# --- 6. VIDEO RECOMMENDATIONS (NEW) ---




# --- 7. ONLINE CLASS (GOOGLE MEET) ---

# Simple in-memory state for the class session
CLASS_SESSION = {
    "is_active": False,
    "meet_link": ""
}

class ClassSessionRequest(BaseModel):
    meet_link: str

@app.post("/api/class/start")
async def start_class(
    request: ClassSessionRequest,
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    if not check_permission(x_user_role, "schedule_active_class"):
         log_auth_event(x_user_id or "unknown", "Unauthorized Access", "Attempted to start class without permission")
         raise HTTPException(status_code=403, detail="Permission denied.")

    CLASS_SESSION["is_active"] = True
    CLASS_SESSION["meet_link"] = request.meet_link
    return {"message": "Online class started successfully.", "link": request.meet_link}

@app.post("/api/class/end")
async def end_class():
    CLASS_SESSION["is_active"] = False
    CLASS_SESSION["meet_link"] = ""
    return {"message": "Online class ended."}

@app.get("/api/class/status")
async def get_class_status():
    return CLASS_SESSION 
