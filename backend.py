import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier
import numpy as np
import warnings 
import os
import logging
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO)

load_dotenv()
from groq import Groq 
# Removed google/microsoft specific libs slightly to simplify dependency on raw setup 
# but keeping imports if they are present in env to avoid breaking unrelated things
try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
except ImportError:
    pass
import requests 


try:
    # Initialize the Groq Client. 
    # Using a fallback key for demo purposes if environment variable is missing
    api_key = os.getenv("GROQ_API_KEY") or "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"
    GROQ_CLIENT = Groq(api_key=api_key)
    GROQ_MODEL = "llama-3.1-8b-instant" 
    AI_ENABLED = True
except Exception as e:
    print(f"ERROR: Failed to initialize Groq client. AI Chat disabled. Error: {e}")
    AI_ENABLED = False

# --- 1. CONFIGURATION AND SETUP ---
app = FastAPI(
    title="EdTech AI Portal API",
    description="Backend API for Noble Nexus (SQLite Version)",
    version="1.0.0"
)

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global Exception Handler ---
from fastapi.responses import JSONResponse
from fastapi.requests import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Global Exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )

# --- 2. Pydantic Models ---
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    success: bool = True
    user_id: str
    role: Optional[str] = None
    require_2fa: bool = False
    message: Optional[str] = None

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
    password: str = "123" 

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

class StudentRegistrationRequest(BaseModel):
    name: str
    email: str 
    password: str
    grade: int
    preferred_subject: str = "General"

class ClassScheduleRequest(BaseModel):
    teacher_id: str
    topic: str
    date: str 
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


# --- 3. DATABASE (SQLite) Functions ---
# Automatically create 'noble_nexus.db' in the current directory
DB_FILE = "noble_nexus.db"

def get_db_connection():
    # Detect if we are in the correct directory, otherwise look in the same dir as the script
    db_path = DB_FILE
    if not os.path.exists(db_path):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        db_path = os.path.join(base_dir, DB_FILE)
        
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row # Access columns by name
    return conn

def fetch_data_df(query, params=()):
    conn = get_db_connection()
    try:
        df = pd.read_sql_query(query, conn, params=params)
    except Exception as e:
        print(f"SQL Error: {e}")
        df = pd.DataFrame()
    finally:
        conn.close()
    return df

def initialize_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")

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
        english_language_score REAL
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

    # Live Class Students Join Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS live_class_students (
        live_class_id INTEGER,
        student_id TEXT,
        FOREIGN KEY (live_class_id) REFERENCES live_classes(id) ON DELETE CASCADE,
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
        PRIMARY KEY (live_class_id, student_id)
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

    # Seed data
    cursor.execute("SELECT COUNT(*) FROM students")
    if cursor.fetchone()[0] == 0:
        students_data = [
            ('S001', 'Alice Smith', 9, 'Math', 92.5, 'English', '123', 85.0, 78.5, 90.0),
            ('S002', 'Bob Johnson', 10, 'Science', 85.0, 'Spanish', '123', 60.0, 95.0, 75.0),
            ('SURJEET', 'Surjeet J', 11, 'Physics', 77.0, 'Punjabi', '123', 70.0, 65.0, 80.0),
            ('DEVA', 'Deva Krishnan', 11, 'Chemistry', 90.0, 'Tamil', '123', 95.0, 88.0, 92.0),
            ('HARISH', 'Harish Boy', 5, 'English', 7.0, 'Hindi', '123', 50.0, 50.0, 45.0),
            ('teacher', 'Teacher Admin', 0, 'All', 100.0, 'English', 'teacher', 100.0, 100.0, 100.0), 
        ]
        cursor.executemany("INSERT INTO students VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", students_data)

        activities_data = [
            ('S001', '2025-11-01', 'Algebra', 'Medium', 95, 10),
            ('S001', '2025-11-03', 'Geometry', 'Medium', 65, 25), 
            ('S002', '2025-11-01', 'Physics', 'Medium', 40, 45),
            ('S002', '2025-11-02', 'Chemistry', 'Easy', 55, 30),
            ('HARISH', '2025-11-10', 'Reading', 'Easy', 80, 15),
        ]
        # Skip 'id' for auto-increment
        cursor.executemany("INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min) VALUES (?, ?, ?, ?, ?, ?)", activities_data)
        
    conn.commit()
    conn.close()

# Initialize DB on start
try:
    initialize_db()
    logging.info("SQLite Database initialized successfully.")
except Exception as e:
    logging.error(f"Failed to initialize SQLite DB: {e}")

# --- 4. ML Engine ---
ML_MODEL = None
DIFF_LABEL_MAP = {0: 'Easy', 1: 'Medium', 2: 'Hard'}
DIFFICULTY_MAP = {'Easy': 0, 'Medium': 1, 'Hard': 2}

def train_recommendation_model():
    global ML_MODEL
    df = fetch_data_df("SELECT score, time_spent_min, difficulty FROM activities")
    if len(df) < 5:
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

    # SQLite query using ?
    df_history = fetch_data_df("SELECT score, time_spent_min FROM activities WHERE student_id = ? ORDER BY date DESC LIMIT 1", (student_id,))
    
    if df_history.empty:
        return "No activity history available."

    last_activity = df_history.iloc[0]
    X_pred = np.array([[last_activity['score'], last_activity['time_spent_min']]])
    
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pred_idx = ML_MODEL.predict(X_pred)[0]
    
    rec_diff = DIFF_LABEL_MAP.get(pred_idx, 'Medium')
    return f"Based on your last score of {last_activity['score']}%, we recommend trying a **{rec_diff}** difficulty topic next!"

train_recommendation_model()

# --- 5. ENDPOINTS ---

@app.get("/")
def read_root():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    index_path = os.path.join(base_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "index.html not found, but backend is running."}

@app.get("/script.js")
def read_script():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    script_path = os.path.join(base_dir, "script.js")
    if os.path.exists(script_path):
        return FileResponse(script_path)
    raise HTTPException(status_code=404, detail="script.js not found")

@app.post("/api/auth/login", response_model=LoginResponse)
async def login_user(request: LoginRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, password FROM students WHERE id = ? AND password = ?", 
                            (request.username, request.password))
        user = cursor.fetchone()
    finally:
        conn.close()

    if user:
        role = 'Teacher' if user['id'] == 'teacher' else 'Student'
        logging.info(f"Successful login: {user['id']}") 
        return LoginResponse(user_id=user['id'], role=role)
    else:
        logging.warning(f"Failed login: {request.username}")
        raise HTTPException(status_code=401, detail="Invalid credentials.")

@app.post("/api/auth/register", status_code=201)
async def register_student(request: StudentRegistrationRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM students WHERE id = ?", (request.email,))
        if cursor.fetchone() is not None:
             raise HTTPException(status_code=400, detail="Account with this Email/ID already exists.")

        cursor.execute(
            """
            INSERT INTO students (id, name, grade, preferred_subject, attendance_rate, home_language, password, math_score, science_score, english_language_score)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                request.email, request.name, request.grade, request.preferred_subject, 
                100.0, "English", request.password, 
                0.0, 0.0, 0.0 
            )
        )
        conn.commit()
        return {"message": "Registration successful!"}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="ID already exists.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/teacher/overview", response_model=TeacherOverviewResponse)
async def get_teacher_overview():
    # SQLite uses ? placeholders
    students_df = fetch_data_df("SELECT id, name, grade, preferred_subject, attendance_rate, home_language, math_score, science_score, english_language_score FROM students WHERE id != 'teacher'")
    
    if students_df.empty:
        return TeacherOverviewResponse(total_students=0, class_attendance_avg=0.0, class_score_avg=0.0, roster=[])

    activities_df = fetch_data_df("SELECT student_id, score FROM activities")
    
    if not activities_df.empty:
        avg_scores = activities_df.groupby('student_id')['score'].mean().reset_index()
        avg_scores.columns = ['id', 'Avg Score']
    else:
        avg_scores = pd.DataFrame(columns=['id', 'Avg Score'])
    
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
async def add_new_student(request: AddStudentRequest):
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
        return {"message": f"Student {request.name} added."}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail=f"Student ID '{request.id}' already exists.")
    finally:
        conn.close()

@app.put("/api/students/{student_id}")
async def update_student(student_id: str, request: UpdateStudentRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM students WHERE id = ?", (student_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Student not found.")
            
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
        conn.commit()
        return {"message": "Student updated."}
    finally:
        conn.close()

@app.delete("/api/students/{student_id}")
async def delete_student(student_id: str):
    if student_id == 'teacher':
        raise HTTPException(status_code=403, detail="Cannot delete admin.")
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM students WHERE id = ?", (student_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Student not found.")
        conn.commit()
        return {"message": "Student deleted."}
    finally:
        conn.close()

@app.post("/api/activities/add", status_code=201)
async def add_new_activity(request: AddActivityRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM students WHERE id = ?", (request.student_id,))
        if cursor.fetchone() is None:
            raise HTTPException(status_code=404, detail="Student not found.")
            
        cursor.execute(
            """
            INSERT INTO activities (student_id, date, topic, difficulty, score, time_spent_min)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (request.student_id, request.date, request.topic, request.difficulty, request.score, request.time_spent_min)
        )
        conn.commit()
        try:
             train_recommendation_model()
        except:
             pass 
        return {"message": "Activity added."}
    finally:
        conn.close()

@app.post("/api/ai/chat/{student_id}", response_model=AIChatResponse)
async def chat_with_ai_tutor(student_id: str, request: AIChatRequest):
    if not AI_ENABLED:
        return AIChatResponse(reply="AI Service disabled (Check API Key).")
        
    system_prompt = f"You are an AI Tutor. Student ID: {student_id}. Keep answers short."
    
    try:
        df_history = fetch_data_df("SELECT topic, difficulty, score FROM activities WHERE student_id = ? ORDER BY date DESC LIMIT 5", (student_id,))
        if not df_history.empty:
            history_text = "\n".join([f"- {row['topic']} ({row['difficulty']}): {row['score']}%" for _, row in df_history.iterrows()])
            system_prompt += f"\nContext:\n{history_text}"
    except Exception:
        pass

    try:
        chat_completion = GROQ_CLIENT.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.prompt}
            ],
            model=GROQ_MODEL,
            temperature=0.7,
            max_tokens=300
        )
        reply = chat_completion.choices[0].message.content
    except Exception as e:
        reply = f"AI Error: {str(e)}"
        
    return AIChatResponse(reply=reply)

@app.get("/api/students/all")
async def get_all_students_list():
    df = fetch_data_df("SELECT id, name, attendance_rate, grade FROM students WHERE id != 'admin' AND id != 'teacher'")
    return df.to_dict('records') 

@app.get("/api/students/{student_id}/data", response_model=StudentDataResponse)
async def get_student_data(student_id: str):
    student_profile = fetch_data_df("SELECT math_score, science_score, english_language_score FROM students WHERE id = ?", (student_id,)).to_dict('records')

    if not student_profile:
        raise HTTPException(status_code=404, detail="Student not found.")
    
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

@app.post("/api/groups", status_code=201)
async def create_group(request: GroupCreateRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO groups (name, description, subject) VALUES (?, ?, ?)", 
                       (request.name, request.description, request.subject))
        conn.commit()
        return {"message": "Group created."}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Group name must be unique.")
    finally:
        conn.close()

@app.get("/api/groups", response_model=List[GroupResponse])
async def get_groups():
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        query = """
            SELECT g.id, g.name, g.description, g.subject, COUNT(gm.student_id) as member_count
            FROM groups g
            LEFT JOIN group_members gm ON g.id = gm.group_id
            GROUP BY g.id, g.name, g.description, g.subject
        """
        cursor.execute(query)
        groups = cursor.fetchall() # Row factory makes these accessible by name
        return [GroupResponse(
            id=r['id'], name=r['name'], description=r['description'], subject=r['subject'], member_count=r['member_count']
        ) for r in groups]
    finally:
        conn.close()

@app.delete("/api/groups/{group_id}")
async def delete_group(group_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM groups WHERE id = ?", (group_id,))
        conn.commit()
        return {"message": "Group deleted."}
    finally:
         conn.close()

@app.get("/api/groups/{group_id}/members")
async def get_group_members(group_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM groups WHERE id = ?", (group_id,))
        group = cursor.fetchone()
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
            
        cursor.execute("SELECT student_id FROM group_members WHERE group_id = ?", (group_id,))
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
        cursor.execute("SELECT id FROM groups WHERE id = ?", (group_id,))
        if not cursor.fetchone():
             raise HTTPException(status_code=404, detail="Group not found")

        cursor.execute("DELETE FROM group_members WHERE group_id = ?", (group_id,))
        
        if request.student_ids:
            data = [(group_id, sid) for sid in request.student_ids]
            cursor.executemany("INSERT INTO group_members (group_id, student_id) VALUES (?, ?)", data)
            
        conn.commit()
        return {"message": "Group members updated."}
    finally:
        conn.close()

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
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM group_materials WHERE group_id = ? ORDER BY id DESC", (group_id,))
        materials = cursor.fetchall()
        return [MaterialResponse(id=m['id'], title=m['title'], type=m['type'], content=m['content'], date=m['date']) for m in materials]
    finally:
        conn.close()

@app.get("/api/students/{student_id}/groups", response_model=List[GroupResponse])
async def get_student_groups(student_id: str):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        query = """
            SELECT g.id, g.name, g.description, g.subject
            FROM groups g
            JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.student_id = ?
        """
        cursor.execute(query, (student_id,))
        groups = cursor.fetchall()
        return [GroupResponse(id=r['id'], name=r['name'], description=r['description'], subject=r['subject'], member_count=0) for r in groups]
    finally:
        conn.close()

# --- LIVE CLASSES ENDPOINTS ---
@app.post("/api/classes/schedule", status_code=201)
async def schedule_class(request: ClassScheduleRequest):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        targets_str = "" 
        
        cursor.execute(
            "INSERT INTO live_classes (teacher_id, topic, date, meet_link, target_students) VALUES (?, ?, ?, ?, ?)",
            (request.teacher_id, request.topic, request.date, request.meet_link, targets_str)
        )
        class_id = cursor.lastrowid

        if request.target_students:
            student_data = [(class_id, student_id) for student_id in request.target_students]
            cursor.executemany(
                "INSERT INTO live_class_students (live_class_id, student_id) VALUES (?, ?)",
                student_data
            )
        conn.commit()
        return {"message": "Class scheduled."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    finally:
        conn.close()

@app.get("/api/classes", response_model=List[ClassResponse])
async def get_classes(teacher_id: Optional[str] = None):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM live_classes ORDER BY date ASC")
        classes = cursor.fetchall()
        
        results = []
        for c in classes:
            if teacher_id and c['teacher_id'] != teacher_id:
                continue
                
            cursor.execute("SELECT student_id FROM live_class_students WHERE live_class_id = ?", (c['id'],))
            db_students = [row['student_id'] for row in cursor.fetchall()]

            if not db_students and c['target_students']:
                 db_students = c['target_students'].split(',')

            results.append(ClassResponse(
                id=c['id'],
                teacher_id=c['teacher_id'],
                topic=c['topic'],
                date=c['date'],
                meet_link=c['meet_link'],
                target_students=db_students
            ))
        return results
    finally:
        conn.close()

@app.delete("/api/classes/{class_id}")
async def delete_class(class_id: int):
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM live_classes WHERE id = ?", (class_id,))
        if cursor.rowcount == 0:
             raise HTTPException(status_code=404, detail="Class not found.")
        conn.commit()
        return {"message": "Class cancelled."}
    finally:
         conn.close()

# --- ONLINE CLASS (GOOGLE MEET) STATE ---
CLASS_SESSION = {
    "is_active": False,
    "meet_link": ""
}
class ClassSessionRequest(BaseModel):
    meet_link: str

@app.get("/class/status")
async def get_global_class_status():
    return CLASS_SESSION

@app.post("/class/start")
async def start_global_class(request: ClassSessionRequest):
    CLASS_SESSION["is_active"] = True
    CLASS_SESSION["meet_link"] = request.meet_link
    return {"message": "Class started"}

@app.post("/class/end")
async def end_global_class():
    CLASS_SESSION["is_active"] = False
    CLASS_SESSION["meet_link"] = ""
    return {"message": "Class ended"}

@app.post("/api/class/start")
async def start_class_api(request: ClassSessionRequest):
    return await start_global_class(request)

@app.post("/api/class/end")
async def end_class_api():
    return await end_global_class()

@app.get("/api/class/status")
async def get_class_status_api():
    return await get_global_class_status()

if __name__ == "__main__":
    import uvicorn
    # Host on 127.0.0.1 for local dev
    uvicorn.run(app, host="127.0.0.1", port=8000)
