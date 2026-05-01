import sqlite3
import os
import re
import tempfile
from backend.auth import hash_password

# -----------------------------
# BASE PATH
# -----------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def resolve_database_dir():
    configured_dir = os.getenv("DATABASE_DIR")
    if not configured_dir:
        return os.path.join(BASE_DIR, "database")

    # Support Windows shell-style env references such as "$env:TEMP" or "%TEMP%".
    powershell_match = re.fullmatch(r"\$env:([A-Za-z_][A-Za-z0-9_]*)", configured_dir.strip())
    cmd_match = re.fullmatch(r"%([^%]+)%", configured_dir.strip())

    if powershell_match:
        return os.getenv(powershell_match.group(1), os.path.join(BASE_DIR, "database"))
    if cmd_match:
        return os.getenv(cmd_match.group(1), os.path.join(BASE_DIR, "database"))

    return os.path.expandvars(configured_dir)


DB_FOLDER = resolve_database_dir()
os.makedirs(DB_FOLDER, exist_ok=True)

RESUME_DB = os.path.join(DB_FOLDER, "resume_database.db")
JOBS_DB = os.path.join(DB_FOLDER, "jobs_database.db")
RESULTS_DB = os.path.join(DB_FOLDER, "matching_results.db")
USERS_DB = os.path.join(DB_FOLDER, "users_database.db")
RUNTIME_DB_FOLDER = os.path.join(tempfile.gettempdir(), "ai_recruitment_runtime")
os.makedirs(RUNTIME_DB_FOLDER, exist_ok=True)
USERS_DB_FALLBACK = os.path.join(RUNTIME_DB_FOLDER, "users_database_runtime.db")
USERS_DB_JOURNAL = f"{USERS_DB}-journal"


# -----------------------------
# CONNECTION HELPER
# -----------------------------
def _can_use_database(db_path):
    try:
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.execute("PRAGMA user_version")
        conn.close()
        return True
    except sqlite3.OperationalError:
        return False


def resolve_db_path(db_path):
    if db_path == USERS_DB:
        if os.path.exists(USERS_DB_JOURNAL):
            return USERS_DB_FALLBACK
        if not _can_use_database(USERS_DB):
            return USERS_DB_FALLBACK
    return db_path


def connect(db_path):
    resolved_path = resolve_db_path(db_path)
    conn = sqlite3.connect(resolved_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def get_users_db(): return connect(USERS_DB)
def get_resume_db(): return connect(RESUME_DB)
def get_jobs_db(): return connect(JOBS_DB)
def get_results_db(): return connect(RESULTS_DB)
def get_applications_db(): return connect(USERS_DB)


# -----------------------------
# USERS + APPLICATIONS
# -----------------------------
def init_users_db():
    conn = get_users_db()
    cursor = conn.cursor()

    try:
        # USERS TABLE
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            role TEXT NOT NULL
        )
        """)

        # APPLICATIONS TABLE (STRICT STATUS)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            resume_id INTEGER NOT NULL,
            username TEXT NOT NULL,
            application_date TEXT NOT NULL,

            -- 🔥 STRICT STATUS CONTROL
            status TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'shortlisted', 'rejected')),

            UNIQUE(job_id, resume_id)
        )
        """)

        # -----------------------------
        # MIGRATION (FOR OLD DBs)
        # -----------------------------
        cursor.execute("PRAGMA table_info(applications)")
        columns = [col[1] for col in cursor.fetchall()]

        if "status" not in columns:
            cursor.execute("""
            ALTER TABLE applications
            ADD COLUMN status TEXT DEFAULT 'pending'
            """)

        # -----------------------------
        # INDEXES (PERFORMANCE)
        # -----------------------------
        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_applications_job_id
        ON applications(job_id)
        """)

        cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_applications_username
        ON applications(username)
        """)

        # -----------------------------
        # SEED USERS
        # -----------------------------
        cursor.execute("SELECT 1 FROM users WHERE username=?", ("candidate1",))
        if not cursor.fetchone():
            cursor.execute("""
            INSERT INTO users (username, email, hashed_password, role)
            VALUES (?, ?, ?, ?)
            """, ("candidate1", "c1@mail.com", hash_password("123"), "candidate"))

        cursor.execute("SELECT 1 FROM users WHERE username=?", ("recruiter1",))
        if not cursor.fetchone():
            cursor.execute("""
            INSERT INTO users (username, email, hashed_password, role)
            VALUES (?, ?, ?, ?)
            """, ("recruiter1", "r1@mail.com", hash_password("123"), "recruiter"))

        conn.commit()

    finally:
        conn.close()


# -----------------------------
# RESUME TABLE
# -----------------------------
def init_resume_db():
    conn = get_resume_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS resumes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            skills TEXT DEFAULT '[]',
            education TEXT DEFAULT '[]',
            experience INTEGER DEFAULT 0
        )
        """)

        conn.commit()

    finally:
        conn.close()


# -----------------------------
# JOB TABLE
# -----------------------------
def init_jobs_db():
    conn = get_jobs_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            job_id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_title TEXT NOT NULL,
            job_description TEXT NOT NULL,
            experience_required TEXT DEFAULT '0',
            mandatory_skills TEXT DEFAULT '[]',
            optional_skills TEXT DEFAULT '[]',
            posted_by TEXT NOT NULL
        )
        """)

        conn.commit()

    finally:
        conn.close()
