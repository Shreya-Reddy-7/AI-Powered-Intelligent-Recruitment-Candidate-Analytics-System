from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import init_users_db, init_resume_db, init_jobs_db
from backend.routers import users, jobs, ranking, resume
import os

# -----------------------------
# CREATE APP
# -----------------------------
app = FastAPI(
    title="AI-Powered Recruitment System",
    description="Backend API for AI Recruitment & Candidate Analysis",
    version="1.0.0"
)

# -----------------------------
# CORS CONFIG
# -----------------------------
# ⚠️ In production, replace "*" with frontend URL
FRONTEND_URL = os.getenv("FRONTEND_URL", "*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL] if FRONTEND_URL != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# STARTUP EVENT
# -----------------------------
@app.on_event("startup")
def startup():
    try:
        init_users_db()
        init_resume_db()
        init_jobs_db()

        print("Database initialized")
        print("Server is running...")

    except Exception as e:
        print("Startup Error:", e)
        raise


# -----------------------------
# INCLUDE ROUTERS
# -----------------------------
app.include_router(users.router)
app.include_router(jobs.router)
app.include_router(resume.router)
app.include_router(ranking.router)


# -----------------------------
# ROOT ENDPOINT
# -----------------------------
@app.get("/")
def root():
    return {
        "message": "AI Recruitment System API is running",
        "version": "1.0.0",
        "docs": "/docs",
        "modules": {
            "users": "/users",
            "jobs": "/jobs",
            "resume": "/resume",
            "ranking": "/ranking"
        }
    }


# -----------------------------
# HEALTH CHECK
# -----------------------------
@app.get("/health")
def health():
    return {
        "status": "healthy",
        "message": "All systems operational"
    }
