from datetime import datetime
from typing import Literal
import ast
import re

from fastapi import APIRouter, Depends, HTTPException

from backend.auth import require_role, get_current_user
from backend.database import get_jobs_db, get_resume_db, get_applications_db
from backend.models import JobCreate
from modules.job_parser import parse_job

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def parse_list(text):
    try:
        if not text:
            return []
        if isinstance(text, list):
            return text
        return ast.literal_eval(text)
    except Exception:
        return []


def extract_experience_number(exp_text):
    try:
        if not exp_text:
            return 0
        numbers = re.findall(r"\d+", exp_text)
        return int(numbers[0]) if numbers else 0
    except Exception:
        return 0


@router.get("/applications/me")
def get_my_applications(current_user=Depends(require_role("candidate"))):
    conn = get_applications_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM applications WHERE username=?", (current_user.username,))
    applications = cursor.fetchall()
    conn.close()

    if not applications:
        return {"total_applications": 0, "applications": []}

    job_conn = get_jobs_db()
    jc = job_conn.cursor()
    result = []

    for app in applications:
        jc.execute("SELECT * FROM jobs WHERE job_id=?", (app["job_id"],))
        job = jc.fetchone()
        result.append({
            "application_id": app["id"],
            "job_id": app["job_id"],
            "job_title": job["job_title"] if job else "Deleted Job",
            "resume_id": app["resume_id"],
            "application_date": app["application_date"],
            "status": app["status"]
        })

    job_conn.close()
    return {"total_applications": len(result), "applications": result}


@router.get("/all")
def get_all_jobs(current_user=Depends(get_current_user)):
    conn = get_jobs_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs ORDER BY job_id DESC")
    jobs = cursor.fetchall()
    conn.close()

    result = []
    for job in jobs:
        exp_text = job["experience_required"]
        result.append({
            "job_id": job["job_id"],
            "job_title": job["job_title"],
            "description": job["job_description"],
            "experience_required": exp_text,
            "experience_numeric": extract_experience_number(exp_text),
            "mandatory_skills": parse_list(job["mandatory_skills"]),
            "optional_skills": parse_list(job["optional_skills"]),
            "posted_by": job["posted_by"]
        })

    return {"total_jobs": len(result), "jobs": result}


@router.get("/{job_id}/applicants")
def get_applicants(job_id: int, current_user=Depends(require_role("recruiter"))):
    job_conn = get_jobs_db()
    jc = job_conn.cursor()
    jc.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,))
    job = jc.fetchone()
    job_conn.close()

    if not job:
        raise HTTPException(404, "Job not found")
    if job["posted_by"] != current_user.username:
        raise HTTPException(403, "Not your job")

    conn = get_applications_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM applications WHERE job_id=?", (job_id,))
    apps = conn.fetchall() if False else cursor.fetchall()
    conn.close()

    return {"total_applicants": len(apps), "applications": [dict(a) for a in apps]}


@router.put("/applications/{application_id}/status")
def update_application_status(
    application_id: int,
    status: Literal["shortlisted", "rejected"],
    current_user=Depends(require_role("recruiter"))
):
    conn = get_applications_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM applications WHERE id=?", (application_id,))
    app = cursor.fetchone()

    if not app:
        conn.close()
        raise HTTPException(404, "Application not found")

    job_conn = get_jobs_db()
    jc = job_conn.cursor()
    jc.execute("SELECT * FROM jobs WHERE job_id=?", (app["job_id"],))
    job = jc.fetchone()
    job_conn.close()

    if not job or job["posted_by"] != current_user.username:
        conn.close()
        raise HTTPException(403, "Not your job")

    cursor.execute(
        "UPDATE applications SET status=? WHERE id=?",
        (status, application_id)
    )
    conn.commit()
    conn.close()

    return {"message": f"Application {status}"}


@router.post("/upload")
def upload_job(job: JobCreate, current_user=Depends(require_role("recruiter"))):
    parsed = parse_job(job.job_description)

    conn = get_jobs_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO jobs (job_title, job_description, experience_required,
                          mandatory_skills, optional_skills, posted_by)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            job.job_title,
            job.job_description,
            job.experience_required,
            str(parsed.get("mandatory_skills", [])),
            str(parsed.get("optional_skills", [])),
            current_user.username
        )
    )
    conn.commit()
    job_id = cursor.lastrowid
    conn.close()

    return {"job_id": job_id, "message": "Job uploaded successfully"}


@router.post("/apply/{job_id}")
def apply(job_id: int, resume_id: int, current_user=Depends(require_role("candidate"))):
    job_conn = get_jobs_db()
    jc = job_conn.cursor()
    jc.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,))
    job = jc.fetchone()
    job_conn.close()

    if not job:
        raise HTTPException(404, "Job not found")

    conn = get_resume_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM resumes WHERE id=? AND username=?",
        (resume_id, current_user.username)
    )
    resume = cursor.fetchone()
    conn.close()

    if not resume:
        raise HTTPException(403, "Use your own resume")

    app_conn = get_applications_db()
    ac = app_conn.cursor()
    ac.execute(
        "SELECT * FROM applications WHERE job_id=? AND resume_id=?",
        (job_id, resume_id)
    )

    if ac.fetchone():
        app_conn.close()
        raise HTTPException(400, "Already applied")

    ac.execute(
        """
        INSERT INTO applications (job_id, resume_id, username, application_date, status)
        VALUES (?, ?, ?, ?, ?)
        """,
        (
            job_id,
            resume_id,
            current_user.username,
            datetime.now().isoformat(),
            "pending"
        )
    )
    app_conn.commit()
    app_conn.close()

    return {"message": "Applied successfully", "job_id": job_id}


@router.get("/{job_id}")
def get_job(job_id: int, current_user=Depends(get_current_user)):
    conn = get_jobs_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,))
    job = cursor.fetchone()
    conn.close()

    if not job:
        raise HTTPException(404, "Job not found")

    return {
        "job_id": job["job_id"],
        "job_title": job["job_title"],
        "description": job["job_description"],
        "experience_required": job["experience_required"],
        "experience_numeric": extract_experience_number(job["experience_required"]),
        "mandatory_skills": parse_list(job["mandatory_skills"]),
        "optional_skills": parse_list(job["optional_skills"]),
        "posted_by": job["posted_by"]
    }
