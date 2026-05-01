from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from backend.database import get_resume_db
from backend.auth import require_role, get_current_user
import ast
import io
import json
import os

import docx
import pdfplumber
from groq import Groq

from modules.resume_parsing import parse_resume_text

router = APIRouter(prefix="/resume", tags=["Resume"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


def safe_list(x):
    return x if isinstance(x, list) else []


def extract_text_from_pdf(content):
    text = ""
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


def extract_text_from_docx(content):
    doc = docx.Document(io.BytesIO(content))
    return "\n".join([p.text for p in doc.paragraphs])


def extract_json(text):
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start != -1 and end != -1:
            return json.loads(text[start:end])
    except Exception as e:
        print("JSON PARSE ERROR:", e)
    return None


def clean_list(items):
    if isinstance(items, str):
        return [items]

    cleaned = []
    for item in items:
        if isinstance(item, dict):
            cleaned.append(item.get("skill", str(item)))
        elif isinstance(item, list):
            cleaned.extend([str(x) for x in item])
        else:
            cleaned.append(str(item))
    return cleaned


def parse_storage_list(value):
    if isinstance(value, list):
        return value
    if not value:
        return []
    try:
        return ast.literal_eval(value)
    except Exception:
        return []


def generate_candidate_analysis(parsed, score_data=None):

    skills = safe_list(parsed.get("skills", []))
    exp = parsed.get("experience_years", 0)

    if score_data:
        matched = safe_list(score_data.get("matched_skills", []))
        score = score_data.get("score", 0)
        job_skills = safe_list(score_data.get("job_skills", []))
        missing = list(set(job_skills) - set(skills))
    else:
        matched, missing, score = [], [], None

    # -----------------------------
    # BACKEND DECISION (SOURCE OF TRUTH)
    # -----------------------------
    if score is not None:
        if score >= 75:
            verdict = "Strong Fit"
        elif score >= 50:
            verdict = "Moderate Fit"
        else:
            verdict = "Weak Fit"
    else:
        verdict = "Potential"

    # -----------------------------
    # FALLBACK (NO LLM)
    # -----------------------------
    if not groq_client:
        return {
            "strengths": matched if matched else skills[:3],
            "weaknesses": ["Lack of experience"] if exp == 0 else [],
            "skill_gaps": missing,
            "improvements": ["Work on real-world projects"],
            "score": score,
            "summary": "Candidate meets some requirements but needs improvement.",
            "verdict": verdict,
            "selection_reason": "Evaluation based on available data",
            "ranking_reason": "Ranked based on overall score"
        }

    try:
        prompt = f"""
You are a senior recruiter evaluating a candidate.

Candidate Skills: {skills}
Experience: {exp} years
Matched Skills: {matched}
Missing Skills: {missing}
Score: {score}
Verdict: {verdict}

INSTRUCTIONS:
- DO NOT change the verdict
- Use the data above strictly
- Be specific and realistic (no generic sentences)
- Do NOT mention technologies not in missing_skills
- Weaknesses should be real issues (experience, gaps, depth)

Return ONLY JSON:
{{
  "strengths": [],
  "weaknesses": [],
  "improvements": [],
  "summary": "",
  "selection_reason": "",
  "ranking_reason": ""
}}
"""

        response = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}]
        )

        content = response.choices[0].message.content.strip()
        content = content.replace("```json", "").replace("```", "").strip()

        parsed_json = extract_json(content)

        if parsed_json:

            # -----------------------------
            # CLEAN OUTPUT
            # -----------------------------
            parsed_json["strengths"] = clean_list(parsed_json.get("strengths", []))
            parsed_json["weaknesses"] = clean_list(parsed_json.get("weaknesses", []))
            parsed_json["improvements"] = clean_list(parsed_json.get("improvements", []))

            # -----------------------------
            # ENSURE SUMMARY EXISTS
            # -----------------------------
            if not parsed_json.get("summary"):
                if matched:
                    parsed_json["summary"] = (
                        f"Candidate has strengths in {', '.join(matched[:3])}, "
                        "but needs improvement in experience and missing skills."
                    )
                else:
                    parsed_json["summary"] = "Candidate has potential but needs improvement."

            # -----------------------------
            # SAFETY: REMOVE INVALID WEAKNESSES
            # -----------------------------
            parsed_json["weaknesses"] = [
                w for w in parsed_json["weaknesses"]
                if w.lower() not in [s.lower() for s in skills]
            ]

            # -----------------------------
            # FINAL CONSISTENT OUTPUT
            # -----------------------------
            parsed_json["skill_gaps"] = missing
            parsed_json["score"] = score
            parsed_json["verdict"] = verdict

            # fallback if LLM misses fields
            if not parsed_json.get("selection_reason"):
                parsed_json["selection_reason"] = (
                    "Decision based on skill match, experience, and overall score"
                )

            if not parsed_json.get("ranking_reason"):
                parsed_json["ranking_reason"] = (
                    "Ranked relative to other candidates based on score"
                )

            return parsed_json

        raise Exception("Invalid JSON")

    except Exception as e:
        print("LLM ERROR:", e)

        return {
            "strengths": matched if matched else skills[:3],
            "weaknesses": ["Lack of practical experience"] if exp == 0 else [],
            "skill_gaps": missing,
            "improvements": ["Work on real-world projects"],
            "score": score,
            "summary": "Candidate has potential but needs improvement.",
            "verdict": verdict,
            "selection_reason": "Evaluation based on available data",
            "ranking_reason": "Ranked based on overall score"
        }
@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_resume(
    file: UploadFile = File(...),
    current_user=Depends(require_role("candidate"))
):
    try:
        content = await file.read()

        if file.filename.endswith(".pdf"):
            text = extract_text_from_pdf(content)
        elif file.filename.endswith(".docx"):
            text = extract_text_from_docx(content)
        else:
            text = content.decode(errors="ignore")

        parsed = parse_resume_text(text)
        analysis = generate_candidate_analysis(parsed)

        conn = get_resume_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id FROM resumes WHERE username=?",
            (current_user.username,)
        )
        existing = cursor.fetchone()

        if existing:
            cursor.execute(
                """
                UPDATE resumes
                SET skills=?, education=?, experience=?
                WHERE username=?
                """,
                (
                    str(parsed.get("skills", [])),
                    str(parsed.get("education", [])),
                    parsed.get("experience_years", 0),
                    current_user.username
                )
            )
            resume_id = existing["id"]
            message = "Resume updated"
        else:
            cursor.execute(
                """
                INSERT INTO resumes (username, skills, education, experience)
                VALUES (?, ?, ?, ?)
                """,
                (
                    current_user.username,
                    str(parsed.get("skills", [])),
                    str(parsed.get("education", [])),
                    parsed.get("experience_years", 0)
                )
            )
            resume_id = cursor.lastrowid
            message = "Resume uploaded"

        conn.commit()
        conn.close()

        return {
            "message": message,
            "resume_id": resume_id,
            "parsed_data": parsed,
            "analysis": analysis,
            "note": "Score is calculated during job ranking"
        }

    except Exception as e:
        print("UPLOAD ERROR:", e)
        raise HTTPException(500, "Internal Server Error")


@router.get("/me")
def get_my_resume(current_user=Depends(require_role("candidate"))):
    conn = get_resume_db()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT * FROM resumes WHERE username=? ORDER BY id DESC LIMIT 1",
            (current_user.username,)
        )
        row = cursor.fetchone()
        if not row:
            return {"has_resume": False}

        parsed_data = {
            "skills": parse_storage_list(row["skills"]),
            "education": parse_storage_list(row["education"]),
            "experience_years": row["experience"]
        }

        return {
            "has_resume": True,
            "resume_id": row["id"],
            "username": current_user.username,
            "parsed_data": parsed_data,
            "analysis": generate_candidate_analysis(parsed_data)
        }
    finally:
        conn.close()


@router.get("/all")
def get_all_resumes(current_user=Depends(get_current_user)):
    conn = get_resume_db()
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT * FROM resumes ORDER BY id DESC")
        rows = cursor.fetchall()
        resumes = []

        for row in rows:
            if current_user.role == "candidate" and row["username"] != current_user.username:
                continue

            resumes.append({
                "resume_id": row["id"],
                "username": row["username"],
                "skills": parse_storage_list(row["skills"]),
                "education": parse_storage_list(row["education"]),
                "experience_years": row["experience"]
            })

        return {"total_resumes": len(resumes), "resumes": resumes}
    finally:
        conn.close()
