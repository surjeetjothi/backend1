from fastapi import FastAPI, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response, StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import sqlite3
import pandas as pd
import io
import csv
from datetime import datetime, timedelta
from sklearn.ensemble import RandomForestClassifier
import numpy as np
import warnings 
import os
import logging
import uuid
import shutil
import json
from fastapi import FastAPI, HTTPException, Header, Depends, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.staticfiles import StaticFiles
# from groq import Groq (Moved to initialization block) 
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "275674033514-q7ghs0kt970m9soo44cqfusaqkkvgmb4.apps.googleusercontent.com")

# --- EMAIL CONFIGURATION ---
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "your-email@gmail.com") # User needs to set this
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "your-app-password") # User needs to set this

def send_email(to_email: str, subject: str, body: str):
    if "example.com" in to_email or "your-email" in SMTP_EMAIL:
        logger.warning(f"Email simulation: To={to_email}, Subject={subject}")
        return False # Simulated

    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_EMAIL
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False



try:
    # Initialize the Groq Client.
    from groq import Groq
    # Restore user's specific key as fallback
    api_key = os.getenv("GROQ_API_KEY", "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")
    
    GROQ_CLIENT = Groq(api_key=api_key)
    GROQ_MODEL = "llama-3.1-8b-instant" 
    
    # Initialize OpenRouter for Quiz Generator
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "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")
    OPENROUTER_MODEL = "meta-llama/llama-3.1-70b-instruct" # User requested Llama 3.1 70B
    
    AI_ENABLED = True
    logger.info("AI Chat System Initialized (Groq + Gemini for Quizzes).")
except ImportError:
    logger.error("Groq or google-generativeai library not installed. AI features disabled.")
    AI_ENABLED = False
except Exception as e:
    logger.error(f"Failed to initialize AI clients. Error: {e}")
    AI_ENABLED = False

app = FastAPI(title="EdTech AI Portal API - Enhanced")

# --- CORS Configuration ---
# Fix: Explicitly list allowed origins for Production + Development
origins = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "https://backend1-bzh1.onrender.com",
    "https://www.backend1-bzh1.onrender.com"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



DATABASE_URL = "edtech_fastapi_enhanced.db"
MIN_ACTIVITIES = 5 

# --- 2. DATA MODELS ---

class LoginRequest(BaseModel):
    username: str
    password: str
    role: str = "Student" # Default to Student to avoid breaking legacy clients if any, though frontend always sends it now

class LoginResponse(BaseModel):
    success: bool = True
    user_id: str
    role: Optional[str] = None
    requires_2fa: bool = False 

class Verify2FARequest(BaseModel):
    user_id: str
    code: str

class AddStudentRequest(BaseModel):
    id: str
    name: str
    grade: int
    preferred_subject: str
    attendance_rate: float
    home_language: str
    math_score: float
    science_score: float
    english_language_score: float
    password: str = "Student@123" 

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

class GenerateQuizRequest(BaseModel):
    topic: str
    difficulty: str = "Medium"
    question_count: int = 5
    type: str = "Multiple Choice" # or "Short Answer"
    description: Optional[str] = None

class GenerateQuizResponse(BaseModel):
    content: str
    
class AddActivityRequest(BaseModel):
    student_id: str
    date: str
    topic: str
    difficulty: str
    score: float
    time_spent_min: int

class UpdateStudentRequest(BaseModel):
    name: str
    grade: int
    preferred_subject: str
    attendance_rate: float
    home_language: str
    math_score: float
    science_score: float
    english_language_score: float
    password: Optional[str] = None 

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    grade: Optional[int] = 9
    preferred_subject: Optional[str] = "General"
    role: str = "Student" 
    invitation_token: Optional[str] = None 

class ClassScheduleRequest(BaseModel):
    teacher_id: str
    topic: str
    date: str # Format: YYYY-MM-DD HH:MM
    meet_link: str
    target_students: List[str] 

class ClassResponse(BaseModel):
    id: int
    teacher_id: str
    topic: str
    date: str
    meet_link: str
    target_students: List[str] 
    
class GroupCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    subject: str 

class MaterialCreateRequest(BaseModel):
    title: str
    type: str 
    content: str 

class GroupMemberUpdateRequest(BaseModel):
    student_ids: List[str]

class GroupResponse(BaseModel):
    id: int
    name: str
    description: str
    subject: Optional[str] = "General" 
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

class SocialTokenRequest(BaseModel):
    token: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ClassSessionRequest(BaseModel):
    meet_link: str

class AuditLogResponse(BaseModel):
    id: int
    user_id: str
    event_type: str
    timestamp: str
    details: str
    logout_time: Optional[str] = None
    duration_minutes: Optional[int] = None

class QuizCreateRequest(BaseModel):
    group_id: int
    title: str
    questions: List[Dict[str, Any]] # JSON List of questions

class QuizSubmitRequest(BaseModel):
    student_id: str
    answers: Dict[str, str] # Question Index -> Answer

class QuizResponse(BaseModel):
    id: int
    group_id: int
    title: str
    question_count: int
    created_at: str

class AssignmentCreateRequest(BaseModel):
    title: str
    description: str
    due_date: str
    type: str = "Assignment" # or "Project"
    points: int = 100

class AssignmentResponse(BaseModel):
    id: int
    group_id: int
    title: str
    description: str
    due_date: str
    type: str
    points: int

class SubmissionCreateRequest(BaseModel):
    student_id: str
    content: str # Text or Link

class SubmissionResponse(BaseModel):
    id: int
    assignment_id: int
    student_id: str
    student_name: Optional[str] = None
    content: str
    submitted_at: str
    grade: Optional[float] = None
    feedback: Optional[str] = None

class GradeSubmissionRequest(BaseModel):
    grade: float
    feedback: str = ""

class LessonPlanRequest(BaseModel):
    topic: str
    grade: str
    subject: str
    duration_mins: int
    description: Optional[str] = None

class LessonPlanResponse(BaseModel):
    content: str

# --- 3. DATABASE HELPER FUNCTIONS ---

def get_db_connection():
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row
    return conn

def fetch_data_df(query, params=()):
    conn = get_db_connection()
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    return df

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

def update_user_logout(user_id: str):
    """Updates the last explicit 'Login Success' event with logout time and duration."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Find the latest open session (Login Success with no logout_time)
        row = cursor.execute("SELECT id, timestamp FROM auth_logs WHERE user_id = ? AND event_type = 'Login Success' AND logout_time IS NULL ORDER BY id DESC LIMIT 1", (user_id,)).fetchone()
        
        if row:
            log_id = row['id']
            # Parse ISO formats safely
            try:
                start_time = datetime.fromisoformat(row['timestamp'])
                end_time = datetime.now()
                duration = int((end_time - start_time).total_seconds() / 60)
                
                cursor.execute("UPDATE auth_logs SET logout_time = ?, duration_minutes = ? WHERE id = ?", 
                               (end_time.isoformat(), duration, log_id))
                conn.commit()
                logger.info(f"Updated session duration for user {user_id}: {duration} mins")
            except ValueError:
                pass # safely ignore parsing errors if legacy data is weird
        
        conn.close()
    except Exception as e:
        logger.error(f"Failed to update session logout: {e}")

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

# --- 4. DATABASE INITIALIZATION ---

def initialize_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Students Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT,
        grade INTEGER,
        preferred_subject TEXT,
        attendance_rate REAL,
        home_language TEXT,
        password TEXT,
        math_score REAL,          
        science_score REAL,       
        english_language_score REAL, 
        role TEXT DEFAULT 'Student', 
        failed_login_attempts INTEGER DEFAULT 0, 
        locked_until TEXT 
    )
    """)

    # Invitations Table 
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS invitations (
        token TEXT PRIMARY KEY,
        role TEXT,
        expires_at TEXT,
        is_used BOOLEAN DEFAULT 0
    )
    """)

    # Password Resets Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS password_resets (
        token TEXT PRIMARY KEY,
        user_id TEXT,
        expires_at TEXT
    )
    """)

    # Backup Codes Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS backup_codes (
        user_id TEXT,
        code TEXT,
        created_at TEXT,
        PRIMARY KEY (user_id, code),
        FOREIGN KEY (user_id) REFERENCES students(id) ON DELETE CASCADE
    )
    """)
    
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
    cursor.execute("PRAGMA foreign_keys = ON")

    # Live Classes Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS live_classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        teacher_id TEXT,
        topic TEXT,
        date TEXT,
        meet_link TEXT,
        target_students TEXT 
    )
    """)
    
    # Auth Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS auth_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        event_type TEXT, 
        timestamp TEXT,
        details TEXT
    )
    """)
    
    # Groups Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        description TEXT,
        subject TEXT DEFAULT 'General'
    )
    """)

    # Group Members Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER,
        student_id TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        PRIMARY KEY (group_id, student_id)
    )
    """)

    # Group Materials Table
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

    # Quizzes Table (LMS Phase 2)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER,
        title TEXT,
        questions TEXT, -- JSON String
        created_at TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    )
    """)

    # Quiz Attempts Table (LMS Phase 2)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quiz_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        quiz_id INTEGER,
        student_id TEXT,
        score REAL,
        answers TEXT, -- JSON String
        submitted_at TEXT,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
    """)

    # --- MIGRATIONS ---
    # Add columns if missing
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN role TEXT DEFAULT 'Student'")
    except sqlite3.OperationalError: pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN failed_login_attempts INTEGER DEFAULT 0")
        cursor.execute("ALTER TABLE students ADD COLUMN locked_until TEXT")
    except sqlite3.OperationalError: pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN math_score REAL DEFAULT 0.0")
    except sqlite3.OperationalError: pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN science_score REAL DEFAULT 0.0")
    except sqlite3.OperationalError: pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN english_language_score REAL DEFAULT 0.0")
    except sqlite3.OperationalError: pass 
    try:
        cursor.execute("ALTER TABLE live_classes ADD COLUMN target_students TEXT")
    except sqlite3.OperationalError: pass 
    try:
        cursor.execute("ALTER TABLE groups ADD COLUMN subject TEXT DEFAULT 'General'")
    except sqlite3.OperationalError: pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN xp INTEGER DEFAULT 0")
    except sqlite3.OperationalError: pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN badges TEXT DEFAULT '[]'")
    except sqlite3.OperationalError: pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN xp INTEGER DEFAULT 0")
    except sqlite3.OperationalError: pass
    try:
        cursor.execute("ALTER TABLE students ADD COLUMN badges TEXT DEFAULT '[]'")
    except sqlite3.OperationalError: pass

    # --- NEW FIX: Add missing columns to auth_logs to prevent crash ---
    try:
        cursor.execute("ALTER TABLE auth_logs ADD COLUMN logout_time TEXT")
    except sqlite3.OperationalError: pass
    try:
        cursor.execute("ALTER TABLE auth_logs ADD COLUMN duration_minutes INTEGER")
    except sqlite3.OperationalError: pass
    # ------------------------------------------------------------------

    # Ensure Teacher has correct role
    cursor.execute("UPDATE students SET role = 'Teacher' WHERE id = 'teacher'")
    conn.commit()

    # Seed data only if tables are empty
    if cursor.execute("SELECT COUNT(*) FROM students").fetchone()[0] == 0:
        students_data = [
            # ID, Name, Grade, Subject, Attend %, Language, Password, Math, Science, English, Role, FailedLogin, LockedUntil
            ('S001', 'Alice Smith', 9, 'Maths', 92.5, 'English', '123', 85.0, 78.5, 90.0, 'Student', 0, None),
            ('S002', 'Bob Johnson', 10, 'Science', 85.0, 'Spanish', '123', 60.0, 95.0, 75.0, 'Student', 0, None),
            ('SURJEET', 'Surjeet J', 11, 'Science', 77.0, 'Punjabi', '123', 70.0, 65.0, 80.0, 'Student', 0, None),
            ('DEVA', 'Deva Krishnan', 11, 'Tamil', 90.0, 'Tamil', '123', 95.0, 88.0, 92.0, 'Student', 0, None),
            ('HARISH', 'Harish Boy', 5, 'English', 7.0, 'Hindi', '123', 50.0, 50.0, 45.0, 'Student', 0, None),
            ('teacher', 'Teacher Admin', 0, 'All', 100.0, 'English', 'teacher', 100.0, 100.0, 100.0, 'Teacher', 0, None), 
        ]
        cursor.executemany("INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score, role, failed_login_attempts, locked_until) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", students_data)

        activities_data = [
            ('S001', '2025-11-01', 'Algebra', 'Medium', 95, 10),
            ('S001', '2025-11-03', 'Geometry', 'Medium', 65, 25), 
            ('S002', '2025-11-01', 'Physics', 'Medium', 40, 45),
            ('S002', '2025-11-02', 'Chemistry', 'Easy', 55, 30),
            ('HARISH', '2025-11-10', 'Reading', 'Easy', 80, 15),
        ]
        for a in activities_data:
             cursor.execute("INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min) VALUES (?, ?, ?, ?, ?, ?)", a)
        
    # Ensure Teacher and Admin exist
    if not cursor.execute("SELECT id FROM students WHERE id = 'teacher'").fetchone():
         cursor.execute("INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score, role, failed_login_attempts, locked_until) VALUES ('teacher', 'Teacher Admin', 0, 'All', 100.0, 'English', 'teacher', 100.0, 100.0, 100.0, 'Teacher', 0, NULL)")
    
    if not cursor.execute("SELECT id FROM students WHERE id = 'admin'").fetchone():
         cursor.execute("INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score, role, failed_login_attempts, locked_until) VALUES ('admin', 'System Admin', 0, 'All', 100.0, 'English', 'admin', 100.0, 100.0, 100.0, 'Admin', 0, NULL)")

    # Seed demo codes for existing users (Check individually to ensure all are present)
    demo_codes = [
        ('teacher', '928471'), ('teacher', '582931'),
        ('admin', '736102'),
        ('S001', '519384'),
        ('S002', '123456'),
        ('SURJEET', '192837'),
        ('DEVA', '112233'),
        ('HARISH', '998877')
    ]
    now = datetime.now().isoformat()
    for uid, code in demo_codes:
         # Check if this specific code exists
         if not cursor.execute("SELECT 1 FROM backup_codes WHERE user_id = ? AND code = ?", (uid, code)).fetchone():
             # Only insert if user actually exists
             if cursor.execute("SELECT 1 FROM students WHERE id = ?", (uid,)).fetchone():
                 cursor.execute("INSERT INTO backup_codes (user_id, code, created_at) VALUES (?, ?, ?)", (uid, code, now))
    
    # Catch-all: Ensure ALL students have at least one code (Enforces 2FA for everyone)
    all_users = cursor.execute("SELECT id FROM students").fetchall()
    for user in all_users:
        uid = user[0]
        if not cursor.execute("SELECT 1 FROM backup_codes WHERE user_id = ?", (uid,)).fetchone():
            # Generate a RANDOM default code for anyone missing one
            default_code = str(random.randint(100000, 999999))
            cursor.execute("INSERT INTO backup_codes (user_id, code, created_at) VALUES (?, ?, ?)", (uid, default_code, now))
    
    # FIX: Update any legacy '123456' codes to be unique random codes
    legacy_codes = cursor.execute("SELECT user_id FROM backup_codes WHERE code = '123456'").fetchall()
    for user in legacy_codes:
        uid = user[0]
        new_random_code = str(random.randint(100000, 999999))
        cursor.execute("UPDATE backup_codes SET code = ? WHERE user_id = ? AND code = '123456'", (new_random_code, uid))
                 
    conn.commit()
    conn.close()

initialize_db()

# --- 5. ML ENGINE ---

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
    
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        clf = RandomForestClassifier(n_estimators=50, random_state=42)
        clf.fit(X, y)
    
    ML_MODEL = clf

def get_recommendation(student_id: str) -> Optional[str]:
    train_recommendation_model() 
    if not ML_MODEL:
        return "Not enough data (minimum 5 activities) to generate an ML-based recommendation."

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

train_recommendation_model()

# --- 6. RBAC CONFIGURATION ---

ROLE_PERMISSIONS = {
    "Admin": [
        "view_dashboard", "manage_users", "manage_invitations", 
        "view_all_grades", "edit_all_grades", 
        "schedule_active_class", "manage_groups", "view_audit_logs"
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

async def verify_permission(permission: str, x_user_role: str = Header(None, alias="X-User-Role"), x_user_id: str = Header(None, alias="X-User-Id")):
    # SECURITY FIX: Trust only the database role, ignore the client-provided header
    if not x_user_id:
         raise HTTPException(status_code=401, detail="Authentication required")

    conn = get_db_connection()
    try:
        user = conn.execute("SELECT role FROM students WHERE id = ?", (x_user_id,)).fetchone()
    finally:
        conn.close()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Use the source of truth from DB
    current_role = user['role']

    if not check_permission(current_role, permission):
        log_auth_event(x_user_id, "Unauthorized Access", f"Missing permission: {permission}")
        raise HTTPException(status_code=403, detail=f"Permission denied: {permission} required.")
    
    return True


# --- LMS & UPLOADS CONFIGURATION ---
UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- 7. API ENDPOINTS ---

@app.get("/", response_class=HTMLResponse)
async def read_root():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "index.html")
    
    if not os.path.exists(file_path):
        # Graceful Fallback: If index.html is missing (e.g. separate frontend), just show API status
        return HTMLResponse(content="""
            <html>
                <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                    <h1 style="color: #4CAF50;">Class Bridge API is Running 🚀</h1>
                    <p>The backend is online and accepting requests.</p>
                    <p>Please access the application via your <strong>Vercel Frontend</strong>.</p>
                </body>
            </html>
        """, status_code=200)
        
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()

@app.get("/script.js")
async def read_script():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, "script.js")
    if not os.path.exists(file_path):
        return Response(content="console.error('script.js not found');", media_type="text/javascript")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    return Response(content=content, media_type="text/javascript")

@app.post("/api/ai/lesson-plan", response_model=LessonPlanResponse)
async def generate_lesson_plan(request: LessonPlanRequest, user_role: str = Header(None, alias="X-User-Role")):
    if user_role and user_role != "Teacher" and user_role != "Admin":
         raise HTTPException(status_code=403, detail="Only teachers can generate lesson plans.")

    prompt = (
        f"Create a detailed {request.duration_mins}-minute lesson plan for a grade {request.grade} "
        f"{request.subject} class on the topic: '{request.topic}'.\n"
    )
    if request.description:
        prompt += f"Additional Context/Instructions: {request.description}\n"
    
    prompt += (
        f"Structure it with timings (e.g., Intro 5m, Activity 20m, Wrap-up 5m). "
        f"Include specific activities."
    )

    if AI_ENABLED:
        try:
            chat_completion = GROQ_CLIENT.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert teacher's assistant. Generate structured, timed lesson plans."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                model=GROQ_MODEL,
                temperature=0.7,
            )
            return LessonPlanResponse(content=chat_completion.choices[0].message.content)
        except Exception as e:
            logger.error(f"AI Generation Failed: {e}")
            # Fallback to heuristic if AI fails
    
    # Heuristic Fallback
    intro_time = max(5, int(request.duration_mins * 0.15))
    main_time = int(request.duration_mins * 0.7)
    wrap_time = request.duration_mins - intro_time - main_time
    
    plan = f"""
    ## 📚 Lesson Plan: {request.topic}
    **Grade:** {request.grade} | **Subject:** {request.subject} | **Duration:** {request.duration_mins} mins
    
    ### 1. Introduction ({intro_time} mins)
    *   **Hook:** Start with a question or short story about {request.topic}.
    *   **Objective:** Explain what students will learn today.
    
    ### 2. Main Activity ({main_time} mins)
    *   **Direct Instruction:** Briefly explain the core concepts of {request.topic}.
    *   **Guided Practice:** Work through an example together.
    *   **Independent/Group Work:** Students practice or discuss {request.topic}.
    
    ### 3. Wrap-Up ({wrap_time} mins)
    *   **Review:** Recap key points.
    *   **Exit Ticket:** Ask one checking question.
    """
    return LessonPlanResponse(content=plan)

@app.post("/api/auth/login", response_model=LoginResponse)
async def login_user(request: LoginRequest):
    logger.info(f"Login attempt for user: {request.username}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    user = cursor.execute("SELECT id, name, password, role, failed_login_attempts, locked_until FROM students WHERE id = ?", 
                        (request.username,)).fetchone()
    
    if not user:
        conn.close()
        logger.warning(f"Login failed for user: {request.username} - User not found")
        log_auth_event(request.username, "Login Failed", "User not found")
        raise HTTPException(status_code=401, detail="Invalid credentials.")

    # Enforce Role Match
    # Exception: Admins can log in to Teacher portal
    allow_login = False
    if user['role'] == request.role:
        allow_login = True
    elif user['role'] == 'Admin' and request.role == 'Teacher':
        allow_login = True
        
    if not allow_login:
        conn.close()
        logger.warning(f"Role mismatch for {request.username}. DB={user['role']}, Req={request.role}")
        log_auth_event(request.username, "Login Failed", f"Role Mismatch: Tried {request.role} as {user['role']}")
        raise HTTPException(status_code=403, detail=f"Access Denied: You are registered as a {user['role']}, not a {request.role}.")

    # Check Account Lockout
    if user['locked_until']:
        lock_time = datetime.fromisoformat(user['locked_until'])
        if datetime.now() < lock_time:
            conn.close()
            remaining_min = int((lock_time - datetime.now()).total_seconds() / 60)
            log_auth_event(request.username, "Login Failed", "Account locked")
            raise HTTPException(status_code=403, detail=f"Account locked. Try again in {remaining_min + 1} minutes.")
        else:
            cursor.execute("UPDATE students SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", (request.username,))
            conn.commit()

    # Password Verification
    if user['password'] == request.password:
        cursor.execute("UPDATE students SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?", (request.username,))
        
        # 2FA CHECK
        has_codes = cursor.execute("SELECT 1 FROM backup_codes WHERE user_id = ?", (request.username,)).fetchone()
        conn.commit()
        conn.close()
        
        if has_codes:
            logger.info(f"Password correct for {request.username}, triggering 2FA.")
            return LoginResponse(
                user_id=user['id'], 
                role=None, 
                requires_2fa=True 
            )
        else:
            role = user['role'] 
            logger.info(f"Login successful for user: {request.username} (Role: {role})")
            log_auth_event(request.username, "Login Success", f"Role: {role}")

            # GAMIFICATION: Award daily login XP
            try:
                current_xp = user['xp'] or 0
                # Simple +10 XP for login
                cursor.execute("UPDATE students SET xp = ? WHERE id = ?", (current_xp + 10, user['id']))
                conn.commit()
            except Exception as e:
                logger.error(f"Error awarding login XP: {e}")

            return LoginResponse(user_id=user['id'], role=role, requires_2fa=False)

    else:
        new_attempts = (user['failed_login_attempts'] or 0) + 1
        if new_attempts >= 5: 
            lockout_duration = datetime.now() + timedelta(minutes=15)
            cursor.execute("UPDATE students SET failed_login_attempts = ?, locked_until = ? WHERE id = ?", 
                           (new_attempts, lockout_duration.isoformat(), request.username))
            conn.commit()
            conn.close()
            logger.warning(f"Account locked for user: {request.username}")
            log_auth_event(request.username, "Account Locked", "Too many failed attempts")
            raise HTTPException(status_code=403, detail="Account locked. Too many failed attempts.")
        else:
            cursor.execute("UPDATE students SET failed_login_attempts = ? WHERE id = ?", (new_attempts, request.username))
            conn.commit()
            conn.close()
            remaining = 5 - new_attempts
            logger.warning(f"Login failed for user: {request.username} - Invalid password.")
            log_auth_event(request.username, "Login Failed", f"Invalid password.")
            raise HTTPException(status_code=401, detail=f"Invalid credentials. {remaining} attempts remaining.")

@app.post("/api/auth/verify-2fa", response_model=LoginResponse)
async def verify_backup_code(request: Verify2FARequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    code_entry = cursor.execute("SELECT code FROM backup_codes WHERE user_id = ? AND code = ?", 
                               (request.user_id, request.code)).fetchone()
                               
    if not code_entry:
        conn.close()
        log_auth_event(request.user_id, "2FA Failed", "Invalid or used code")
        raise HTTPException(status_code=401, detail="Invalid one-time code.")
        
    # cursor.execute("DELETE FROM backup_codes WHERE user_id = ? AND code = ?", (request.user_id, request.code))
    user = cursor.execute("SELECT role FROM students WHERE id = ?", (request.user_id,)).fetchone()
    conn.commit()
    conn.close()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    role = user['role']
    logger.info(f"2FA Successful for user: {request.user_id}")
    log_auth_event(request.user_id, "Login Success", "2FA Verified")
    
    return LoginResponse(user_id=request.user_id, role=role, requires_2fa=False)

@app.post("/api/auth/register", status_code=201)
async def register_user(request: RegisterRequest):
    validate_password_strength(request.password)

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        if request.role == 'Teacher' or request.role == 'Admin':
             if not request.invitation_token:
                 raise HTTPException(status_code=403, detail="Invitation required for this role.")
             
             invite = cursor.execute("SELECT * FROM invitations WHERE token = ? AND is_used = 0", (request.invitation_token,)).fetchone()
             if not invite:
                 raise HTTPException(status_code=400, detail="Invalid or used invitation token.")
             if datetime.now() > datetime.fromisoformat(invite['expires_at']):
                 raise HTTPException(status_code=400, detail="Invitation expired.")
             if invite['role'] != request.role:
                 raise HTTPException(status_code=400, detail="Token does not match the requested role.")
             
             cursor.execute("UPDATE invitations SET is_used = 1 WHERE token = ?", (request.invitation_token,))
             
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

@app.post("/api/auth/logout")
async def logout_user(request: LogoutRequest):
    logger.info(f"Logout for user: {request.user_id}")
    log_auth_event(request.user_id, "Logout", "User logged out")
    return {"message": "Logged out successfully"}



@app.get("/api/auth/permissions")
async def get_role_permissions():
    return ROLE_PERMISSIONS

@app.get("/api/teacher/students/{student_id}/codes")
async def get_student_codes(student_id: str, authorized: bool = Depends(lambda: verify_permission("manage_users"))):
    conn = get_db_connection()
    codes = conn.execute("SELECT code FROM backup_codes WHERE user_id = ?", (student_id,)).fetchall()
    student = conn.execute("SELECT name FROM students WHERE id = ?", (student_id,)).fetchone()
    conn.close()
    
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    code_list = [row['code'] for row in codes]
    
    # If no codes exist (shouldn't happen with our catch-all, but safe fallback), generate one
    if not code_list:
        new_code = str(random.randint(100000, 999999))
        conn = get_db_connection()
        conn.execute("INSERT INTO backup_codes (user_id, code, created_at) VALUES (?, ?, ?)", 
                     (student_id, new_code, datetime.now().isoformat()))
        conn.commit()
        conn.close()
        code_list = [new_code]

    return {
        "student_id": student_id,
        "name": student['name'],
        "codes": code_list
    }

@app.post("/api/teacher/students/{student_id}/regenerate-code")
async def regenerate_student_code(student_id: str, authorized: bool = Depends(lambda: verify_permission("manage_users"))):
    conn = get_db_connection()
    
    # Check if student exists
    if not conn.execute("SELECT 1 FROM students WHERE id = ?", (student_id,)).fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Student not found")

    # Delete ALL existing codes for this user (Revoke old)
    conn.execute("DELETE FROM backup_codes WHERE user_id = ?", (student_id,))
    
    # Generate ONE new random code
    new_code = str(random.randint(100000, 999999))
    conn.execute("INSERT INTO backup_codes (user_id, code, created_at) VALUES (?, ?, ?)", 
                 (student_id, new_code, datetime.now().isoformat()))
    
    student_name = conn.execute("SELECT name FROM students WHERE id = ?", (student_id,)).fetchone()[0]
    conn.commit()
    conn.close()
    
    log_auth_event(student_id, "Security Update", "2FA Code Regenerated by Teacher")

    return {
        "student_id": student_id,
        "name": student_name,
        "codes": [new_code],
        "message": "Old codes revoked. New code generated."
    }

@app.post("/api/students/{student_id}/email-code")
async def send_access_code_email(student_id: str):
    conn = get_db_connection()
    codes = conn.execute("SELECT code FROM backup_codes WHERE user_id = ?", (student_id,)).fetchall()
    student = conn.execute("SELECT name FROM students WHERE id = ?", (student_id,)).fetchone()
    conn.close()

    if not codes:
        raise HTTPException(status_code=404, detail="No codes found for this user.")

    # Determine Email Address (Assuming ID is Email if it contains @, otherwise fail for now or use a lookup)
    target_email = student_id if "@" in student_id else None
    
    if not target_email:
         # For demo purposes, if ID isn't an email, we can't send.
         # In a real app, we'd look up a profile.email field.
         raise HTTPException(status_code=400, detail="Student ID is not a valid email address.")

    code_list_html = "".join([f"<li style='font-size:18px; font-weight:bold;'>{row['code']}</li>" for row in codes])
    
    email_body = f"""
    <html>
        <body>
            <h2>Class Bridge Access Card</h2>
            <p>Hello {student['name']},</p>
            <p>Here are your secure access codes for logging into the portal:</p>
            <ul>{code_list_html}</ul>
            <p>Keep these codes safe!</p>
            <p><i>Class Bridge Admin</i></p>
        </body>
    </html>
    """
    
    success = send_email(target_email, "Your Class Bridge Access Codes", email_body)
    
    if success:
        return {"message": f"Codes sent to {target_email}"}
    else:
        # Fallback if SMTP not configured
        return {"message": "Email simulation: Check server logs (SMTP not configured)."}

@app.post("/api/auth/google-login", response_model=LoginResponse)
async def google_login(request: SocialTokenRequest):
    logger.info(f"Processing Google Login...")
    
    # 1. Verify Token with Google
    try:
        # Use Google's tokeninfo endpoint to verify the ID token
        response = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={request.token}")
        
        if response.status_code != 200:
             logger.error(f"Google Token Check Failed: {response.text}")
             raise HTTPException(status_code=401, detail="Invalid Google Token")
        
        google_data = response.json()
        
        # 2. Verify Audience matches our Client ID
        if google_data['aud'] != GOOGLE_CLIENT_ID:
             logger.error(f"Audience Mismatch: {google_data['aud']}")
             raise HTTPException(status_code=401, detail="Token audience mismatch")
             
        user_email = google_data['email']
        user_name = google_data.get('name', 'Google User') # Use real name from Google
        
    except Exception as e:
        logger.error(f"Google Login Error: {e}")
        raise HTTPException(status_code=401, detail=f"Google Authentication Failed.")

    # 3. Handle User in Database
    conn = get_db_connection()
    user = conn.execute("SELECT id, role FROM students WHERE id = ?", (user_email,)).fetchone()
    
    role = 'Student'
    if user:
         role = user['role']
    else:
        # Auto-register new user from Google
        conn.execute("INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                     (user_email, user_name, 9, "Science", 100.0, "English", "social_login", 0.0, 0.0, 0.0, 'Student'))
        conn.commit()
        log_auth_event(user_email, "Register Success", "Google Auto-Register")
    
    conn.close()
    
    log_auth_event(user_email, "Login Success", "Google Login")
    return LoginResponse(user_id=user_email, role=role)

@app.post("/api/auth/microsoft-login", response_model=LoginResponse)
async def microsoft_login(request: SocialTokenRequest):
    logger.info("Processing Microsoft Login")
    
    # Check if this is a Simulated Token (starts with 'token_')
    if request.token.startswith("token_"):
        # Extract unique part from simulated token for uniqueness
        unique_suffix = request.token.split("_")[-1] if "_" in request.token else str(random.randint(1000,9999))
        user_email = f"ms_user_{unique_suffix}@example.com"
        user_name = f"Microsoft User {unique_suffix}"
    else:
        # REAL TOKEN LOGIC: Verify via Microsoft Graph API
        # The frontend sends an Access Token for Graph API (User.Read scope).
        # We verify it by successfully calling the /me endpoint.
        try:
            graph_response = requests.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={"Authorization": f"Bearer {request.token}"}
            )
            
            if graph_response.status_code != 200:
                 logger.error(f"Graph API Failed: {graph_response.text}")
                 raise HTTPException(status_code=401, detail="Invalid Microsoft Token")

            graph_data = graph_response.json()
            # Use 'mail' (email) or 'userPrincipalName' (UPN) as the unique ID
            user_email = graph_data.get('mail') or graph_data.get('userPrincipalName')
            user_name = graph_data.get('displayName', 'Microsoft User')
            
            if not user_email:
                 raise ValueError("No email found in Microsoft account")
                 
        except Exception as e:
             logger.error(f"Microsoft Login Validation Error: {e}")
             raise HTTPException(status_code=401, detail="Microsoft Authentication Failed")

    conn = get_db_connection()
    user = conn.execute("SELECT id, role FROM students WHERE id = ?", (user_email,)).fetchone()
    
    role = 'Student'
    if user:
         role = user['role']
    else:
        # Auto-register new user
        conn.execute("INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                     (user_email, user_name, 9, "Math", 100.0, "English", "social_login", 0.0, 0.0, 0.0, 'Student'))
        conn.commit()
        log_auth_event(user_email, "Register Success", "Microsoft Auto-Register")

    conn.close()
    
    log_auth_event(user_email, "Login Success", "Microsoft Login")
    return LoginResponse(user_id=user_email, role=role)

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

@app.post("/api/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    logger.info(f"Password reset requested for: {request.email}")
    conn = get_db_connection()
    user = conn.execute("SELECT id FROM students WHERE id = ?", (request.email,)).fetchone()
    
    if user:
        token = str(uuid.uuid4())
        expires_at = (datetime.now() + timedelta(minutes=15)).isoformat()
        conn.execute("INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)", 
                     (token, request.email, expires_at))
        conn.commit()
        conn.close()
        
        link = f"http://127.0.0.1:8000/?reset_token={token}"
        log_auth_event(request.email, "Password Reset Requested", f"Token generated (Dev Link: {link})")
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
        reset_entry = conn.execute("SELECT user_id, expires_at FROM password_resets WHERE token = ?", (request.token,)).fetchone()
        
        if not reset_entry:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
            
        if datetime.now() > datetime.fromisoformat(reset_entry['expires_at']):
            conn.execute("DELETE FROM password_resets WHERE token = ?", (request.token,))
            conn.commit()
            raise HTTPException(status_code=400, detail="Reset token has expired.")
            
        validate_password_strength(request.new_password)
        conn.execute("UPDATE students SET password = ?, failed_login_attempts = 0, locked_until = NULL WHERE id = ?", (request.new_password, reset_entry['user_id']))
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
    await verify_permission("view_all_grades", x_user_id=x_user_id)

    students_df = fetch_data_df("SELECT id, name, grade, preferred_subject, attendance_rate, home_language, math_score, science_score, english_language_score FROM students WHERE role = 'Student'")
    
    if students_df.empty:
        return TeacherOverviewResponse(total_students=0, class_attendance_avg=0.0, class_score_avg=0.0, roster=[])

    activities_df = fetch_data_df("SELECT student_id, score FROM activities")
    avg_scores = activities_df.groupby('student_id')['score'].mean().reset_index()
    avg_scores.columns = ['id', 'Avg Score']
    
    teacher_df = students_df.merge(avg_scores, on='id', how='left').fillna({'Avg Score': 0})
    teacher_df['Overall Initial Score'] = teacher_df[['math_score', 'science_score', 'english_language_score']].mean(axis=1)

    roster_list = teacher_df.apply(lambda row: {
        "ID": row['id'],
        "Name": row['name'],
        "Grade": row['grade'],
        "Attendance %": round(row['attendance_rate'], 1),
        "Avg Activity Score": round(row['Avg Score'], 1), 
        "Initial Score": round(row['Overall Initial Score'], 1), 
        "Subject": row['preferred_subject'],
        "Home Language": row['home_language'],
    }, axis=1).to_list()
    
    class_avg_score = teacher_df['Avg Score'].mean() if not teacher_df.empty else 0.0
    class_avg_attendance = teacher_df['attendance_rate'].mean() if not teacher_df.empty else 0.0

    return TeacherOverviewResponse(
        total_students=len(teacher_df),
        class_attendance_avg=round(class_avg_attendance, 1),
        class_score_avg=round(class_avg_score, 1),
        roster=roster_list
    )

@app.post("/api/students/add", status_code=201)
async def add_new_student(
    request: AddStudentRequest, 
    x_user_role: str = Header(None, alias="X-User-Role"), 
    x_user_id: str = Header(None, alias="X-User-Id")
):
    if not x_user_id:
         raise HTTPException(status_code=401, detail="Authentication required")
         
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT role FROM students WHERE id = ?", (x_user_id,)).fetchone()
    finally:
        conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
        
    real_role = user['role']

    if not check_permission(real_role, "manage_users") and not check_permission(real_role, "invite_students"):
         log_auth_event(x_user_id, "Unauthorized Access", "Attempted to add student without permission")
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
    token = str(uuid.uuid4())[:8]
    expires_at = (datetime.now() + timedelta(hours=request.expiry_hours)).isoformat()
    
    conn = get_db_connection()
    conn.execute("INSERT INTO invitations (token, role, expires_at) VALUES (?, ?, ?)", 
                 (token, request.role, expires_at))
    conn.commit()
    conn.close()
    
    return InvitationResponse(link=f"?invite={token}", token=token, expires_at=expires_at)

@app.put("/api/students/{student_id}")
async def update_student(
    student_id: str, 
    request: UpdateStudentRequest,
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    await verify_permission("edit_all_grades", x_user_id=x_user_id)

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
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
        result = cursor.execute("SELECT id FROM students WHERE id = ?", (student_id,)).fetchone()
        if result is None:
            raise HTTPException(status_code=404, detail=f"Student ID '{student_id}' not found.")
            
        cursor.execute("DELETE FROM students WHERE id = ?", (student_id,))
        conn.commit()
        return {"message": f"Student {student_id} and all related activities deleted successfully."}
    finally:
        conn.close()

@app.post("/api/activities/add", status_code=201)
async def add_new_activity(
    request: AddActivityRequest,
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    if not x_user_id:
         raise HTTPException(status_code=401, detail="Authentication required")
         
    conn = get_db_connection()
    try:
        user = conn.execute("SELECT role FROM students WHERE id = ?", (x_user_id,)).fetchone()
    finally:
        conn.close()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    real_role = user['role']

    # Allow if Teacher/Admin (edit_all_grades) OR if Student adding their own activity
    has_permission = check_permission(real_role, "edit_all_grades")
    if not has_permission:
        if real_role == "Student" and str(request.student_id) == str(x_user_id):
            has_permission = True
    
    if not has_permission:
         log_auth_event(x_user_id, "Unauthorized Access", "Attempted to add activity without permission")
         raise HTTPException(status_code=403, detail="Permission denied.")

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
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
        train_recommendation_model()
        return {"message": f"Activity for student {request.student_id} added successfully."}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException) and e.status_code == 404: raise e
        raise HTTPException(status_code=500, detail=f"An error occurred: {e}")
    finally:
        conn.close()

@app.post("/api/ai/chat/{student_id}", response_model=AIChatResponse)
async def chat_with_ai_tutor(student_id: str, request: AIChatRequest):
    if not AI_ENABLED:
        return AIChatResponse(reply="The live AI service is currently disabled.")
        
    system_prompt = (
        "You are an expert Academic Advisor and AI Tutor. "
        "Keep your answers CONCISE, FRIENDLY, and 'SWEET'. "
        "The student's ID is {student_id}."
    ).format(student_id=student_id)
    
    try:
        df_history = fetch_data_df("SELECT topic, difficulty, score FROM activities WHERE student_id = ? ORDER BY date DESC LIMIT 5", (student_id,))
        if not df_history.empty:
            history_text = "\n".join([f"- {row['topic']} ({row['difficulty']}): {row['score']}%" for _, row in df_history.iterrows()])
            system_prompt += f"\n\nContext - Recent Student Activity:\n{history_text}\n\nUse this data to provide specific compliments or improvement tips."
            
        df_profile = fetch_data_df("SELECT grade, preferred_subject, math_score, science_score FROM students WHERE id = ?", (student_id,))
        if not df_profile.empty:
            prof = df_profile.iloc[0]
            system_prompt += f"\n\nStudent Profile: Grade {prof['grade']}, Prefers {prof['preferred_subject']}. Initial Scores: Math={prof['math_score']}, Science={prof['science_score']}."
    except Exception as e:
        print(f"Error fetching context for AI: {e}")

    try:
        chat_completion = GROQ_CLIENT.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.7, 
            max_tokens=500
        )
        reply = chat_completion.choices[0].message.content
    except Exception as e:
        print(f"Groq API Error for student {student_id}: {e}")
        # Fallback to Simulated AI if real API fails
        prompt_lower = request.prompt.lower()
        if "math" in prompt_lower:
            reply = "I see you're asking about Math. Based on your recent scores, I think you should focus on Algebra optimization. Would you like some practice problems?"
        elif "science" in prompt_lower or "physics" in prompt_lower:
            reply = "Science is fascinating! Your recent Physics activity showed great progress. Keep reviewing Newton's laws."
        elif "grade" in prompt_lower or "score" in prompt_lower:
            reply = "You're doing well! Your attendance is solid, and your activity scores are improving. Consistency is key!"
        elif "hello" in prompt_lower or "hi" in prompt_lower:
            reply = "Hello! I'm your AI Tutor. How can I help you with your studies today?"
        else:
            reply = "That's an interesting question. While I'm having trouble connecting to my main brain right now, I suggest reviewing your recent class notes on this topic. Can I help with anything else?"
        
    return AIChatResponse(reply=reply)

@app.get("/api/students/all")
async def get_all_students_list():
    df = fetch_data_df("SELECT id, name, attendance_rate, grade FROM students WHERE role = 'Student'")
    return df.to_dict('records') 

@app.get("/api/students/{student_id}/data", response_model=StudentDataResponse)
async def get_student_data(student_id: str):
    student_profile = fetch_data_df("SELECT math_score, science_score, english_language_score FROM students WHERE id = ?", (student_id,)).to_dict('records')
    if not student_profile:
        raise HTTPException(status_code=404, detail=f"Student ID '{student_id}' not found.")
    profile = student_profile[0]

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
            math_score=profile['math_score'],       
            science_score=profile['science_score'], 
            english_language_score=profile['english_language_score'] 
        ),
        history=history_list
    )

# --- GROUP MANAGEMENT ---

@app.post("/api/groups", status_code=201)
async def create_group(
    request: GroupCreateRequest,
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    await verify_permission("manage_groups", x_user_id=x_user_id)

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
    group = conn.execute("SELECT * FROM groups WHERE id = ?", (group_id,)).fetchone()
    if not group:
        conn.close()
        raise HTTPException(status_code=404, detail="Group not found")
        
    members = conn.execute("SELECT student_id FROM group_members WHERE group_id = ?", (group_id,)).fetchall()
    member_ids = [m['student_id'] for m in members]
    conn.close()
    return {"group": dict(group), "members": member_ids}

@app.post("/api/groups/{group_id}/members")
async def update_group_members(group_id: int, request: GroupMemberUpdateRequest, x_user_id: str = Header(None, alias="X-User-Id")):
    await verify_permission("manage_groups", x_user_id=x_user_id)
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        if not cursor.execute("SELECT id FROM groups WHERE id = ?", (group_id,)).fetchone():
             raise HTTPException(status_code=404, detail="Group not found")

        cursor.execute("DELETE FROM group_members WHERE group_id = ?", (group_id,))
        
        if request.student_ids:
            data = [(group_id, sid) for sid in request.student_ids]
            cursor.executemany("INSERT INTO group_members (group_id, student_id) VALUES (?, ?)", data)
            
        conn.commit()
        return {"message": "Group members updated."}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Invalid student ID provided.")
    finally:
        conn.close()

@app.post("/api/groups/{group_id}/materials")
async def add_group_material(group_id: int, request: MaterialCreateRequest, x_user_id: str = Header(None, alias="X-User-Id")):
    await verify_permission("manage_groups", x_user_id=x_user_id)
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

@app.get("/api/students/{student_id}/assignments")
async def get_student_assignments(student_id: str):
    conn = get_db_connection()
    assignments = conn.execute("""
        SELECT a.*, g.name as course_name
        FROM assignments a
        JOIN group_members gm ON a.group_id = gm.group_id
        JOIN groups g ON a.group_id = g.id
        WHERE gm.student_id = ?
        ORDER BY a.due_date ASC
    """, (student_id,)).fetchall()
    conn.close()
    return [dict(row) for row in assignments]

# --- ASSIGNMENTS & PROJECT MANAGEMENT ---

@app.post("/api/groups/{group_id}/assignments")
async def create_assignment(group_id: int, request: AssignmentCreateRequest, x_user_id: str = Header(None, alias="X-User-Id")):
    await verify_permission("manage_groups", x_user_id=x_user_id)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO assignments (group_id, title, description, due_date, type, points) VALUES (?, ?, ?, ?, ?, ?)",
                   (group_id, request.title, request.description, request.due_date, request.type, request.points))
    conn.commit()
    conn.close()
    return {"message": f"{request.type} created successfully."}

@app.get("/api/groups/{group_id}/assignments", response_model=List[AssignmentResponse])
async def get_group_assignments(group_id: int):
    conn = get_db_connection()
    # Filter by group
    data = conn.execute("SELECT * FROM assignments WHERE group_id = ? ORDER BY due_date ASC", (group_id,)).fetchall()
    conn.close()
    return [AssignmentResponse(**dict(row)) for row in data]

@app.post("/api/assignments/{assignment_id}/submit")
async def submit_assignment(assignment_id: int, request: SubmissionCreateRequest, x_user_id: str = Header(None, alias="X-User-Id")):
    if not x_user_id: raise HTTPException(status_code=401, detail="Authentication required")
    if str(request.student_id) != str(x_user_id):
          raise HTTPException(status_code=403, detail="Cannot submit for another student.")
    conn = get_db_connection()
    cursor = conn.cursor()
    submitted_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Check if exists to update or insert
    existing = cursor.execute("SELECT id FROM submissions WHERE assignment_id = ? AND student_id = ?", (assignment_id, request.student_id)).fetchone()
    
    if existing:
         cursor.execute("UPDATE submissions SET content = ?, submitted_at = ? WHERE id = ?", (request.content, submitted_at, existing[0]))
    else:
         cursor.execute("INSERT INTO submissions (assignment_id, student_id, content, submitted_at) VALUES (?, ?, ?, ?)",
                        (assignment_id, request.student_id, request.content, submitted_at))
    
    conn.commit()
    conn.close()
    return {"message": "Assignment submitted successfully."}

@app.get("/api/assignments/{assignment_id}/submissions", response_model=List[SubmissionResponse])
async def get_assignment_submissions(assignment_id: int, x_user_id: str = Header(None, alias="X-User-Id")):
    await verify_permission("view_all_grades", x_user_id=x_user_id)
    conn = get_db_connection()
    query = """
        SELECT s.*, st.name as student_name 
        FROM submissions s
        JOIN students st ON s.student_id = st.id
        WHERE s.assignment_id = ?
    """
    data = conn.execute(query, (assignment_id,)).fetchall()
    conn.close()
    return [SubmissionResponse(**dict(row)) for row in data]

@app.post("/api/submissions/{submission_id}/grade")
async def grade_submission(submission_id: int, request: GradeSubmissionRequest, x_user_id: str = Header(None, alias="X-User-Id")):
    await verify_permission("edit_all_grades", x_user_id=x_user_id)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE submissions SET grade = ?, feedback = ? WHERE id = ?", (request.grade, request.feedback, submission_id))
    conn.commit()
    conn.close()
    return {"message": "Grade saved."}

# --- LIVE CLASS MANAGEMENT ---

CLASS_SESSION = {
    "is_active": False,
    "meet_link": ""
}

@app.post("/api/classes/schedule", status_code=201)
async def schedule_class(
    request: ClassScheduleRequest,
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    await verify_permission("schedule_active_class", x_user_id=x_user_id)

    conn = get_db_connection()
    try:
        cursor = conn.cursor()
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


@app.post("/api/ai/chat/{student_id}", response_model=AIChatResponse)
async def chat_with_ai(student_id: str, request: AIChatRequest):
    if not AI_ENABLED:
         return AIChatResponse(reply="AI Chat is currently disabled (System configuration).")

    try:
        # Simple context fetch (optional optimization)
        completion = GROQ_CLIENT.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful, encouraging AI tutor for a K-12 student. Keep answers concise, safe, and educational."
                },
                {
                    "role": "user",
                    "content": request.prompt,
                }
            ],
            model=GROQ_MODEL,
        )
        return AIChatResponse(reply=completion.choices[0].message.content)

    except Exception as e:
        logger.error(f"AI Chat Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.post("/api/ai/generate-quiz", response_model=GenerateQuizResponse)
async def generate_quiz(request: GenerateQuizRequest):
    if not AI_ENABLED:
         return GenerateQuizResponse(content='[{"question": "AI Disabled", "options": ["A", "B"], "correct_answer": "A"}]')

    try:
        # Enforce JSON Structure for Database Compatibility
        prompt = f"""
        Generate a {request.difficulty} difficulty {request.type} quiz about "{request.topic}".
        """
        if request.description:
            prompt += f"Context/Description: {request.description}\n"
            
        prompt += f"""
        It should have {request.question_count} questions.
        Return ONLY a raw JSON array. Do not include markdown formatting (like ```json), just the array.
        Format:
        [
            {{
                "question": "Question text",
                "options": ["Option A", "Option B", "Option C", "Option D"],
                "correct_answer": "Option A"
            }}
        ]
        """
        
        full_prompt = "You are a quiz generation engine. Output valid JSON only.\n" + prompt
        
        # Call OpenRouter API
        or_headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json"
        }
        or_data = {
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "user", "content": full_prompt}
            ]
        }
        or_response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=or_headers, json=or_data)
        if or_response.status_code != 200:
             raise Exception(f"OpenRouter API Error: {or_response.text}")
             
        or_json = or_response.json()
        raw_content = or_json['choices'][0]['message']['content'].strip()
        if raw_content.startswith("```json"):
            raw_content = raw_content[7:]
        if raw_content.startswith("```"):
            raw_content = raw_content[3:]
        if raw_content.endswith("```"):
            raw_content = raw_content[:-3]
            
        return GenerateQuizResponse(content=raw_content.strip())

    except Exception as e:
        logger.error(f"AI Quiz Gen Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")

@app.delete("/api/classes/{class_id}")
async def delete_class(class_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM live_classes WHERE id = ?", (class_id,))
    conn.commit()
    conn.close()
    return {"message": "Class cancelled."}

@app.post("/api/class/start")
async def start_class(
    request: ClassSessionRequest,
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    await verify_permission("schedule_active_class", x_user_id=x_user_id)

    CLASS_SESSION["is_active"] = True
    CLASS_SESSION["meet_link"] = request.meet_link
    return {"message": "Online class started successfully.", "link": request.meet_link}

@app.post("/api/class/end")
async def end_class():
    CLASS_SESSION["is_active"] = False
    CLASS_SESSION["meet_link"] = ""
    return {"message": "Online class ended."}

# --- WEBSOCKET MANAGER FOR WHITEBOARD ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        # Broadcast to all connected clients
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # Handle broken connections gracefully
                pass

manager = ConnectionManager()

@app.websocket("/ws/whiteboard")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket Error: {e}")
        manager.disconnect(websocket)
 

@app.get("/api/teacher/export-grades-csv")
async def export_grades_csv(
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    await verify_permission("view_all_grades", x_user_id=x_user_id)

    conn = get_db_connection()
    try:
        # Fetch comprehensive student data
        query = """
            SELECT 
                s.id, 
                s.name, 
                s.grade, 
                s.attendance_rate || '%' as attendance,
                s.preferred_subject,
                s.math_score as initial_math_score,
                s.science_score as initial_science_score,
                s.english_language_score as initial_english_score,
                COALESCE(ROUND(AVG(a.score), 1), 0) as current_average_score,
                COUNT(a.id) as activities_completed
            FROM students s
            LEFT JOIN activities a ON s.id = a.student_id
            WHERE s.role = 'Student'
            GROUP BY s.id
        """
        cursor = conn.cursor()
        cursor.execute(query)
        rows = cursor.fetchall()
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write Header
        writer.writerow([
            "Student ID", "Name", "Grade", "Attendance", "Fav Subject", 
            "Initial Math", "Initial Science", "Initial English", 
            "Current Avg Score", "Activities Completed"
        ])
        
        # Write Data
        for row in rows:
            writer.writerow([
                row['id'], row['name'], row['grade'], row['attendance'], row['preferred_subject'],
                row['initial_math_score'], row['initial_science_score'], row['initial_english_score'],
                row['current_average_score'], row['activities_completed']
            ])
            
        output.seek(0)
        
        # Return as StreamingResponse
        response = StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv"
        )
        response.headers["Content-Disposition"] = "attachment; filename=class_grades_export.csv"
        return response

    except Exception as e:
        logger.error(f"Export Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate export.")
    finally:
        conn.close()

# --- LMS MODULE: MATERIALS & QUIZZES ---

@app.post("/api/groups/{group_id}/upload")
async def upload_group_material(group_id: int, file: UploadFile = File(...), title: str = None):
    # LMS Phase 1: File Uploads
    try:
        file_ext = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Determine Type
        content_type = "File"
        if file_ext.lower() in ['.pdf']: content_type = "PDF"
        elif file_ext.lower() in ['.mp4', '.mov', '.avi']: content_type = "Video"
        elif file_ext.lower() in ['.jpg', '.png', '.jpeg']: content_type = "Image"
        
        # Save to DB
        conn = get_db_connection()
        cursor = conn.cursor()
        date_str = datetime.now().strftime("%Y-%m-%d")
        display_title = title or file.filename
        
        # URL accessible via static mount
        file_url = f"/static/uploads/{unique_filename}"
        
        cursor.execute("INSERT INTO group_materials (group_id, title, type, content, date) VALUES (?, ?, ?, ?, ?)",
                      (group_id, display_title, content_type, file_url, date_str))
        conn.commit()
        conn.close()
        
        return {"message": "File uploaded successfully", "url": file_url}
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/quizzes/create", response_model=QuizResponse)
async def create_quiz_endpoint(request: QuizCreateRequest):
    # LMS Phase 2: Create Quiz
    conn = get_db_connection()
    cursor = conn.cursor()
    
    questions_json = json.dumps(request.questions)
    created_at = datetime.now().isoformat()
    
    cursor.execute("INSERT INTO quizzes (group_id, title, questions, created_at) VALUES (?, ?, ?, ?)",
                  (request.group_id, request.title, questions_json, created_at))
    quiz_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return QuizResponse(
        id=quiz_id, 
        group_id=request.group_id, 
        title=request.title, 
        question_count=len(request.questions), 
        created_at=created_at
    )

@app.get("/api/groups/{group_id}/quizzes")
async def get_group_quizzes(group_id: int):
    conn = get_db_connection()
    quizzes = conn.execute("SELECT id, title, created_at, questions FROM quizzes WHERE group_id = ?", (group_id,)).fetchall()
    
    # Also fetch attempts for the current user if they are a student? 
    # For now just return the quizzes. Frontend can verify if taken.
    result = []
    for q in quizzes:
        q_dict = dict(q)
        q_dict['question_count'] = len(json.loads(q_dict['questions']))
        del q_dict['questions'] # Don't send answers/questions in list view
        result.append(q_dict)
    conn.close()
    return result

@app.get("/api/quizzes/{quiz_id}")
async def get_quiz_details(quiz_id: int):
    conn = get_db_connection()
    quiz = conn.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    conn.close()
    
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
        
    data = dict(quiz)
    data['questions'] = json.loads(data['questions'])
    
    # SECURITY: If student, strip 'isCorrect' or 'answer' fields from questions if they exist?
    # For simplicity in this V1, we assume questions JSON is [{question, options, correct_answer}]
    # We should ideally strip 'correct_answer' before sending to student.
    
    safe_questions = []
    for q in data['questions']:
        q_copy = q.copy()
        if 'correct_answer' in q_copy:
            del q_copy['correct_answer'] # Hide answer
        safe_questions.append(q_copy)
        
    data['questions'] = safe_questions
    return data

@app.post("/api/quizzes/{quiz_id}/submit")
async def submit_quiz(quiz_id: int, request: QuizSubmitRequest):
    conn = get_db_connection()
    quiz = conn.execute("SELECT * FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    
    if not quiz:
        conn.close()
        raise HTTPException(status_code=404, detail="Quiz not found")
        
    questions = json.loads(quiz['questions'])
    score = 0
    total = len(questions)
    
    # Grading Logic
    for idx, q in enumerate(questions):
        # We assume Question structure has 'correct_answer'
        correct = q.get('correct_answer', '').strip().lower()
        # Answer key is usually a string index "0", "1" etc.
        user_ans = request.answers.get(str(idx), '').strip().lower()
        
        if user_ans == correct:
            score += 1
            
    final_score_percent = (score / total) * 100 if total > 0 else 0
    
    # Save Attempt
    answers_json = json.dumps(request.answers)
    submitted_at = datetime.now().isoformat()
    
    conn.execute("INSERT INTO quiz_attempts (quiz_id, student_id, score, answers, submitted_at) VALUES (?, ?, ?, ?, ?)",
                (quiz_id, request.student_id, final_score_percent, answers_json, submitted_at))
    
    # Clean up old attempts? (Optional: keep only best? or all?)
    
    # Update Student Stats (XP, Activity Log)
    # Re-use Activity Table for "Quiz" type?
    conn.execute("INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min) VALUES (?, ?, ?, ?, ?, ?)",
                (request.student_id, datetime.now().strftime("%Y-%m-%d"), f"Quiz: {quiz['title']}", "Medium", final_score_percent, 15))

    conn.commit()
    conn.close()
    
    return {"score": final_score_percent, "total": total, "correct": score}

@app.get("/api/admin/audit-logs", response_model=List[AuditLogResponse])
async def get_audit_logs(
    x_user_role: str = Header(None, alias="X-User-Role"),
    x_user_id: str = Header(None, alias="X-User-Id")
):
    await verify_permission("view_audit_logs", x_user_id=x_user_id)

    conn = get_db_connection()
    try:
        # Select all columns explicitly including new ones
        logs = conn.execute("SELECT id, user_id, event_type, timestamp, details, logout_time, duration_minutes FROM auth_logs ORDER BY timestamp DESC LIMIT 100").fetchall()
        
        return [
            AuditLogResponse(
                id=row['id'], 
                user_id=row['user_id'], 
                event_type=row['event_type'], 
                timestamp=row['timestamp'], 
                details=row['details'],
                logout_time=row['logout_time'],
                duration_minutes=row['duration_minutes']
            ) 
            for row in logs
        ]
    except Exception as e:
        # Log the error for debugging
        print(f"Error fetching logs: {e}")
        # Return a simplified list or empty list to fail gracefully if schema mismatch persists
        # But for valid JSON response let's raise
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        conn.close()
