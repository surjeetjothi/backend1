from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import psycopg2
from psycopg2 import extras

import pandas as pd
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier
import numpy as np
import warnings 
# Suppress pandas UserWarning about raw DBAPI connection
warnings.filterwarnings('ignore', message='pandas only supports SQLAlchemy connectable')

import os # NEW: Import os for environment variables
from dotenv import load_dotenv
load_dotenv()
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
tags_metadata = [
    {"name": "Authentication", "description": "Login and role verification."},
    {"name": "Teacher Dashboard", "description": "Class overview, stats, and roster management."},
    {"name": "Students", "description": "CRUD operations for student profiles."},
    {"name": "Activities", "description": "Logging student activities and performance."},
    {"name": "AI Tutor", "description": "Chat with the Groq-powered AI assistant."},
    {"name": "Groups", "description": "Management of study groups and materials."},
    {"name": "Live Classes", "description": "Scheduling and managing Google Meet sessions."},
]

app = FastAPI(
    title="EdTech AI Portal API",
    description="Backend API for the Noble Nexus EdTech platform. Features include:\n* Role-based Auth\n* Student/Teacher Dashboards\n* AI-powered recommendations & chat\n* Live Class Scheduling\n* Supabase (PostgreSQL) Integration",
    version="1.0.0",
    openapi_tags=tags_metadata
)

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
    password: str = "123" # Default password for new students

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


    
# --- 3. DATABASE (SQLite) Functions and Initialization ---

DATABASE_URL = os.getenv("DATABASE_URL")
MIN_ACTIVITIES = 5 

def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL environment variable is not set. Please add it to your .env file.")
    conn = psycopg2.connect(DATABASE_URL)
    return conn

def fetch_data_df(query, params=()):
    conn = get_db_connection()
    df = pd.read_sql_query(query, conn, params=params)
    conn.close()
    return df

def initialize_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Enable UUID extension if needed (optional, using strings for IDs currently)
    # cursor.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')

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
        english_language_score REAL
    )
    """)
    
    # Activities Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        student_id TEXT,
        date TEXT,
        topic TEXT,
        difficulty TEXT,
        score REAL,
        time_spent_min INTEGER,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
    )
    """)
    
    # Live Classes Table (NEW)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS live_classes (
        id SERIAL PRIMARY KEY,
        teacher_id TEXT,
        topic TEXT,
        date TEXT,
        meet_link TEXT,
        target_students TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE,
        description TEXT,
        subject TEXT DEFAULT 'General'
    )
    """)

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
        id SERIAL PRIMARY KEY,
        group_id INTEGER,
        title TEXT,
        type TEXT,
        content TEXT,
        date TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    )
    """)

    # Seed data only if tables are empty
    cursor.execute("SELECT COUNT(*) FROM students")
    if cursor.fetchone()[0] == 0:
        students_data = [
            ('S001', 'Alice Smith', 9, 'Math', 92.5, 'English', '123', 85.0, 78.5, 90.0),
            ('S002', 'Bob Johnson', 10, 'Science', 85.0, 'Spanish', '123', 60.0, 95.0, 75.0),
            ('SURJEET', 'Surjeet J', 11, 'Physics', 77.0, 'Punjabi', '123', 70.0, 65.0, 80.0),
            ('DEVA', 'Deva Krishnan', 11, 'Chemistry', 90.0, 'Tamil', '123', 95.0, 88.0, 92.0),
            ('HARISH', 'Harish Boy', 5, 'English', 7.0, 'Hindi', '123', 50.0, 50.0, 45.0),
            ('admin', 'Teacher Admin', 0, 'All', 100.0, 'English', 'admin', 100.0, 100.0, 100.0), 
        ]
        # Use executemany with %s placeholder
        cursor.executemany("INSERT INTO students VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)", students_data)

        activities_data = [
            ('S001', '2025-11-01', 'Algebra', 'Medium', 95, 10),
            ('S001', '2025-11-03', 'Geometry', 'Medium', 65, 25), 
            ('S002', '2025-11-01', 'Physics', 'Medium', 40, 45),
            ('S002', '2025-11-02', 'Chemistry', 'Easy', 55, 30),
            ('HARISH', '2025-11-10', 'Reading', 'Easy', 80, 15),
        ]
        # Custom loop for explicit insert if needed, but executemany works
        cursor.executemany("INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min) VALUES (%s, %s, %s, %s, %s, %s)", activities_data)
        
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
    df_history = fetch_data_df("SELECT score, time_spent_min FROM activities WHERE student_id = %s ORDER BY date DESC LIMIT 1", (student_id,))
    
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

@app.api_route("/", methods=["GET", "HEAD"])
def read_root():
    return {"message": "EdTech AI Portal API (Enhanced) is running."}

# --- AUTHENTICATION ---

@app.post("/api/auth/login", response_model=LoginResponse)
async def login_user(request: LoginRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
        cursor.execute("SELECT id, name, password FROM students WHERE id = %s AND password = %s", 
                            (request.username, request.password))
        user = cursor.fetchone()
    finally:
        conn.close()

    if user:
        role = 'Teacher' if user['id'] == 'admin' else 'Parent' 
        return LoginResponse(user_id=user['id'], role=role)
    else:
        raise HTTPException(status_code=401, detail="Invalid credentials.")

# --- TEACHER DASHBOARD ---

@app.get("/api/teacher/overview", response_model=TeacherOverviewResponse)
async def get_teacher_overview():
    # Fetch all students including their initial scores
    students_df = fetch_data_df("SELECT id, name, grade, preferred_subject, attendance_rate, home_language, math_score, science_score, english_language_score FROM students WHERE id != 'admin'")
    
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
async def add_new_student(request: AddStudentRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                request.id, request.name, request.grade, request.preferred_subject, 
                request.attendance_rate, request.home_language, request.password,
                request.math_score, request.science_score, request.english_language_score
            )
        )
        conn.commit()
        return {"message": f"Student {request.id} ({request.name}) added successfully."}
    except psycopg2.IntegrityError:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Student ID '{request.id}' already exists.")
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@app.put("/api/students/{student_id}")
async def update_student(student_id: str, request: UpdateStudentRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Check if student exists
        cursor.execute("SELECT id FROM students WHERE id = %s", (student_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail=f"Student ID '{student_id}' not found.")
            
        cursor.execute(
            """
            UPDATE students 
            SET name = %s, grade = %s, preferred_subject = %s, attendance_rate = %s, home_language = %s,
                math_score = %s, science_score = %s, english_language_score = %s
            WHERE id = %s
            """,
            (
                request.name, request.grade, request.preferred_subject, 
                request.attendance_rate, request.home_language,
                request.math_score, request.science_score, request.english_language_score,
                student_id
            )
        )
        conn.commit()
        return {"message": f"Student {student_id} updated successfully."}
    finally:
        conn.close()


@app.delete("/api/students/{student_id}")
async def delete_student(student_id: str):
    if student_id == 'admin':
        raise HTTPException(status_code=403, detail="Cannot delete the admin user.")
        
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Check if student exists
        cursor.execute("SELECT id FROM students WHERE id = %s", (student_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail=f"Student ID '{student_id}' not found.")
            
        # Delete student (Activities are CASCADE deleted by the foreign key constraint)
        cursor.execute("DELETE FROM students WHERE id = %s", (student_id,))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Student ID '{student_id}' not found.")
            
        conn.commit()
        return {"message": f"Student {student_id} and all related activities deleted successfully."}
    finally:
        conn.close()
        







# --- ACTIVITY MANAGEMENT (NEW ENDPOINT) ---

@app.post("/api/activities/add", status_code=201)
async def add_new_activity(request: AddActivityRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Check if student exists
        cursor.execute("SELECT id FROM students WHERE id = %s", (request.student_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail=f"Student ID '{request.student_id}' not found.")
            
        cursor.execute(
            """
            INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (
                request.student_id, request.date, request.topic, request.difficulty, 
                request.score, request.time_spent_min
            )
        )
        conn.commit()
        
        # Re-train model after new data insertion
        try:
             train_recommendation_model()
        except:
             pass # Fail silent on model train if data issue
        
        return {"message": f"Activity for student {request.student_id} added successfully."}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
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
        df_history = fetch_data_df("SELECT topic, difficulty, score FROM activities WHERE student_id = %s ORDER BY date DESC LIMIT 5", (student_id,))
        
        if not df_history.empty:
            # Convert to string format for the LLM
            history_text = "\n".join([f"- {row['topic']} ({row['difficulty']}): {row['score']}%" for _, row in df_history.iterrows()])
            system_prompt += f"\n\nContext - Recent Student Activity:\n{history_text}\n\nUse this data to provide specific compliments or improvement tips."
            
        # Also fetch their profile/initial scores
        df_profile = fetch_data_df("SELECT grade, preferred_subject, math_score, science_score FROM students WHERE id = %s", (student_id,))
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
    df = fetch_data_df("SELECT id, name, attendance_rate, grade FROM students WHERE id != 'admin'")
    return df.to_dict('records') 

@app.get("/api/students/{student_id}/data", response_model=StudentDataResponse)
async def get_student_data(student_id: str):
    # Fetch initial scores and profile data
    student_profile = fetch_data_df("SELECT math_score, science_score, english_language_score FROM students WHERE id = %s", (student_id,)).to_dict('records')

    if not student_profile:
        raise HTTPException(status_code=404, detail=f"Student ID '{student_id}' not found.")
    
    profile = student_profile[0]

    # Fetch activities history
    history_df = fetch_data_df("SELECT date, topic, difficulty, score, time_spent_min FROM activities WHERE student_id = %s ORDER BY date ASC", (student_id,))
    
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
async def create_group(request: GroupCreateRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO groups (name, description, subject) VALUES (%s, %s, %s)", 
                       (request.name, request.description, request.subject))
        conn.commit()
        return {"message": f"Group '{request.name}' created successfully."}
    except psycopg2.IntegrityError:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Group name must be unique.")
    finally:
        conn.close()

@app.get("/api/groups", response_model=List[GroupResponse])
async def get_groups():
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
        query = """
            SELECT g.id, g.name, g.description, g.subject, COUNT(gm.student_id) as member_count
            FROM groups g
            LEFT JOIN group_members gm ON g.id = gm.group_id
            GROUP BY g.id, g.name, g.description, g.subject
        """ # Postgres requires all columns in GROUP BY or aggregation
        cursor.execute(query)
        groups = cursor.fetchall()
        
        return [GroupResponse(
            id=r['id'], 
            name=r['name'], 
            description=r['description'], 
            subject=r['subject'],
            member_count=r['member_count']
        ) for r in groups]
    finally:
        conn.close()

@app.delete("/api/groups/{group_id}")
async def delete_group(group_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM groups WHERE id = %s", (group_id,))
        conn.commit()
        return {"message": "Group deleted."}
    finally:
         conn.close()

@app.get("/api/groups/{group_id}/members")
async def get_group_members(group_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
        # Get group info
        cursor.execute("SELECT * FROM groups WHERE id = %s", (group_id,))
        group = cursor.fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
            
        # Get members
        cursor.execute("SELECT student_id FROM group_members WHERE group_id = %s", (group_id,))
        members = cursor.fetchall()
        member_ids = [m['student_id'] for m in members]
        return {"group": dict(group), "members": member_ids}
    finally:
        conn.close()

@app.post("/api/groups/{group_id}/members")
async def update_group_members(group_id: int, request: GroupMemberUpdateRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        # Verify group exists
        cursor.execute("SELECT id FROM groups WHERE id = %s", (group_id,))
        if not cursor.fetchone():
             raise HTTPException(status_code=404, detail="Group not found")

        # Configured to overwrite members
        cursor.execute("DELETE FROM group_members WHERE group_id = %s", (group_id,))
        
        if request.student_ids:
            data = [(group_id, sid) for sid in request.student_ids]
            # executemany works with %s
            cursor.executemany("INSERT INTO group_members (group_id, student_id) VALUES (%s, %s)", data)
            
        conn.commit()
        return {"message": "Group members updated."}
    except psycopg2.IntegrityError: # e.g. student_id doesn't exist
        conn.rollback()
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
        cursor.execute("INSERT INTO group_materials (group_id, title, type, content, date) VALUES (%s, %s, %s, %s, %s)",
                       (group_id, request.title, request.type, request.content, date_str))
        conn.commit()
        return {"message": "Material added."}
    finally:
        conn.close()

@app.get("/api/groups/{group_id}/materials", response_model=List[MaterialResponse])
async def get_group_materials(group_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
        cursor.execute("SELECT * FROM group_materials WHERE group_id = %s ORDER BY id DESC", (group_id,))
        materials = cursor.fetchall()
        return [MaterialResponse(id=m['id'], title=m['title'], type=m['type'], content=m['content'], date=m['date']) for m in materials]
    finally:
        conn.close()

@app.get("/api/students/{student_id}/groups", response_model=List[GroupResponse])
async def get_student_groups(student_id: str):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
        query = """
            SELECT g.id, g.name, g.description, g.subject
            FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.student_id = %s
        """
        cursor.execute(query, (student_id,))
        groups = cursor.fetchall()
        return [GroupResponse(id=r['id'], name=r['name'], description=r['description'], subject=r['subject'], member_count=0) for r in groups]
    finally:
        conn.close()



# --- LIVE CLASS MANAGEMENT (NEW) ---

class ClassStatusResponse(BaseModel):
    is_active: bool
    meet_link: Optional[str] = None

class StartClassRequest(BaseModel):
    meet_link: str

# Global state for live class (Simple implementation)
LIVE_CLASS_STATE = {
    "is_active": False,
    "meet_link": ""
}

@app.get("/class/status", response_model=ClassStatusResponse)
async def get_class_status():
    return ClassStatusResponse(
        is_active=LIVE_CLASS_STATE["is_active"],
        meet_link=LIVE_CLASS_STATE["meet_link"]
    )

@app.post("/class/start")
async def start_class(request: StartClassRequest):
    LIVE_CLASS_STATE["is_active"] = True
    LIVE_CLASS_STATE["meet_link"] = request.meet_link
    return {"message": "Class started"}

@app.post("/class/end")
async def end_class():
    LIVE_CLASS_STATE["is_active"] = False
    LIVE_CLASS_STATE["meet_link"] = ""
    return {"message": "Class ended"}

# --- LIVE CLASSES ENDPOINTS (NEW) ---

@app.post("/api/classes/schedule", status_code=201)
async def schedule_class(request: ClassScheduleRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Store list as comma-separated string
        targets_str = ",".join(request.target_students)
        
        cursor.execute(
            "INSERT INTO live_classes (teacher_id, topic, date, meet_link, target_students) VALUES (%s, %s, %s, %s, %s)",
            (request.teacher_id, request.topic, request.date, request.meet_link, targets_str)
        )
        conn.commit()
        return {"message": "Class scheduled successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        conn.close()

@app.get("/api/classes", response_model=List[ClassResponse])
async def get_classes(teacher_id: Optional[str] = None):
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=extras.RealDictCursor)
        cursor.execute("SELECT * FROM live_classes ORDER BY date ASC")
        classes = cursor.fetchall()
        
        results = []
        for c in classes:
            # Filter if teacher_id provided
            if teacher_id and c['teacher_id'] != teacher_id:
                continue
                
            targets = c['target_students'].split(',') if c['target_students'] else []
            
            results.append(ClassResponse(
                id=c['id'],
                teacher_id=c['teacher_id'],
                topic=c['topic'],
                date=c['date'],
                meet_link=c['meet_link'],
                target_students=targets
            ))
        return results
    finally:
        conn.close()

@app.delete("/api/classes/{class_id}")
async def delete_class(class_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM live_classes WHERE id = %s", (class_id,))
        if cursor.rowcount == 0:
             raise HTTPException(status_code=404, detail="Class not found.")
        conn.commit()
        return {"message": "Class cancelled."}
    finally:
         conn.close()

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
async def start_class(request: ClassSessionRequest):
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