import ast
import re

from fastapi import APIRouter, Depends, HTTPException

from backend.auth import require_role
from backend.database import get_jobs_db, get_resume_db, get_applications_db
from backend.models import RankingResponse
from backend.routers.resume import generate_candidate_analysis
from modules.matching_engine import compute_score

router = APIRouter(prefix="/ranking", tags=["Ranking"])


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
        numbers = re.findall(r"\d+", exp_text)
        return int(numbers[0]) if numbers else 0
    except Exception:
        return 0


def get_job_or_404(job_id):
    job_conn = get_jobs_db()
    jc = job_conn.cursor()
    jc.execute("SELECT * FROM jobs WHERE job_id=?", (job_id,))
    job = jc.fetchone()
    job_conn.close()

    if not job:
        raise HTTPException(404, "Job not found")
    return job


def fetch_applied_resumes(job_id):
    app_conn = get_applications_db()
    ac = app_conn.cursor()
    ac.execute("SELECT resume_id FROM applications WHERE job_id = ?", (job_id,))
    applications = ac.fetchall()
    app_conn.close()

    resume_ids = [row["resume_id"] for row in applications]
    if not resume_ids:
        return []

    resume_conn = get_resume_db()
    rc = resume_conn.cursor()
    query = f"SELECT * FROM resumes WHERE id IN ({','.join(['?'] * len(resume_ids))})"
    rc.execute(query, resume_ids)
    resumes = rc.fetchall()
    resume_conn.close()
    return resumes


def build_rankings(job, resumes, limit=None):
    job_dict = {
        "job_title": job["job_title"],
        "mandatory_skills": parse_list(job["mandatory_skills"]),
        "optional_skills": parse_list(job["optional_skills"]),
        "experience_required": job["experience_required"]
    }
    required_exp = extract_experience_number(job["experience_required"])
    results = []

    for row in resumes:
        parsed = {
            "skills": parse_list(row["skills"]),
            "education": parse_list(row["education"]),
            "experience_years": row["experience"]
        }

        if parsed["experience_years"] < required_exp:
            continue

        score_data = compute_score(parsed, job_dict)
        if not score_data or score_data.get("filtered_out"):
            continue

        analysis = generate_candidate_analysis(parsed, score_data)
        results.append({
            "resume_id": row["id"],
            "username": row["username"],
            "experience_years": row["experience"],
            "score": score_data.get("score", 0),
            "skill_score": score_data.get("skill_score", 0),
            "experience_score": score_data.get("experience_score", 0),
            "education_score": score_data.get("education_score", 0),
            "matched_skills": score_data.get("matched_skills", []),
            "match_percentage": round(
                (len(score_data.get("matched_skills", [])) / max(len(parsed["skills"]), 1)) * 100,
                2
            ),
            "analysis": analysis
        })

    ranked = sorted(results, key=lambda x: x["score"], reverse=True)
    if limit is not None:
        ranked = ranked[:limit]

    for index, row in enumerate(ranked):
        if index == 0:
            row["badge"] = "Gold"
        elif index == 1:
            row["badge"] = "Silver"
        elif index == 2:
            row["badge"] = "Bronze"
        else:
            row["badge"] = "Participant"

    return ranked


@router.get("/top/{job_id}", response_model=RankingResponse)
def top_candidates(job_id: int, current_user=Depends(require_role("recruiter"))):
    job = get_job_or_404(job_id)
    if job["posted_by"] != current_user.username:
        raise HTTPException(403, "Not your job")

    resumes = fetch_applied_resumes(job_id)
    if not resumes:
        return {
            "job_id": job_id,
            "job_title": job["job_title"],
            "total_candidates": 0,
            "rankings": [],
            "top_insight": None
        }

    ranked = build_rankings(job, resumes, limit=5)
    return {
        "job_id": job_id,
        "job_title": job["job_title"],
        "total_candidates": len(ranked),
        "rankings": ranked,
        "top_insight": {
            "best_candidate": ranked[0]["resume_id"] if ranked else None,
            "reason": ranked[0]["analysis"].get("ranking_reason", "") if ranked else ""
        } if ranked else None
    }


@router.get("/job/{job_id}", response_model=RankingResponse)
def ranking_for_job(job_id: int, current_user=Depends(require_role("recruiter"))):
    job = get_job_or_404(job_id)
    if job["posted_by"] != current_user.username:
        raise HTTPException(403, "Not your job")

    resumes = fetch_applied_resumes(job_id)
    ranked = build_rankings(job, resumes)
    return {
        "job_id": job_id,
        "job_title": job["job_title"],
        "total_candidates": len(ranked),
        "rankings": ranked,
        "top_insight": {
            "best_candidate": ranked[0]["resume_id"] if ranked else None,
            "reason": ranked[0]["analysis"].get("ranking_reason", "") if ranked else ""
        } if ranked else None
    }


@router.get("/resume/{resume_id}")
def ranking_for_resume(resume_id: int, current_user=Depends(require_role("candidate"))):
    resume_conn = get_resume_db()
    rc = resume_conn.cursor()
    rc.execute(
        "SELECT * FROM resumes WHERE id=? AND username=?",
        (resume_id, current_user.username)
    )
    resume = rc.fetchone()
    resume_conn.close()

    if not resume:
        raise HTTPException(404, "Resume not found")

    app_conn = get_applications_db()
    ac = app_conn.cursor()
    ac.execute("SELECT * FROM applications WHERE resume_id=?", (resume_id,))
    applications = ac.fetchall()
    app_conn.close()

    rankings = []
    for application in applications:
        job = get_job_or_404(application["job_id"])
        ranked = build_rankings(job, [resume], limit=1)
        if not ranked:
            continue

        row = ranked[0].copy()
        row["job_id"] = job["job_id"]
        row["job_title"] = job["job_title"]
        row["status"] = application["status"]
        rankings.append(row)

    rankings.sort(key=lambda x: x["score"], reverse=True)
    return {
        "resume_id": resume_id,
        "username": current_user.username,
        "total_jobs": len(rankings),
        "rankings": rankings
    }
