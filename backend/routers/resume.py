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
        missing = [skill for skill in skills if skill not in matched]
    else:
        matched = []
        missing = []
        score = None

    if not groq_client:
        return {
            "strengths": ["Basic skills identified"],
            "weaknesses": ["Limited analysis (LLM disabled)"],
            "improvements": ["Add more projects"],
            "score": score,
            "summary": "Basic evaluation.",
            "verdict": "Neutral",
            "selection_reason": "No LLM available",
            "ranking_reason": "Fallback mode"
        }

    try:
        prompt = f"""
You are a senior recruiter.

Skills: {skills}
Experience: {exp}
Matched Skills: {matched}
Missing Skills: {missing}
Score: {score}

Return ONLY JSON:
{{
  "strengths": [],
  "weaknesses": [],
  "improvements": [],
  "score": {score},
  "summary": "",
  "verdict": "",
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
            parsed_json["strengths"] = clean_list(parsed_json.get("strengths", []))
            parsed_json["weaknesses"] = clean_list(parsed_json.get("weaknesses", []))
            parsed_json["improvements"] = clean_list(parsed_json.get("improvements", []))

            if score_data:
                if score >= 75:
                    parsed_json["verdict"] = "Strong Fit"
                elif score >= 50:
                    parsed_json["verdict"] = "Moderate Fit"
                else:
                    parsed_json["verdict"] = "Weak Fit"
            else:
                parsed_json["score"] = None

            return parsed_json

        raise Exception("Invalid JSON")

    except Exception as e:
        print("LLM ERROR:", e)
        return {
            "strengths": ["Good foundational skills"],
            "weaknesses": ["Needs more practical exposure"],
            "improvements": ["Work on projects"],
            "score": score,
            "summary": "Candidate shows potential but needs experience.",
            "verdict": "Moderate Fit" if score_data else "Potential",
            "selection_reason": "Skills present but lacks depth",
            "ranking_reason": "Average compared to others"
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
