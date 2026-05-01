import sqlite3
import ast
import re
import os
from difflib import SequenceMatcher

# ML ENV FIXS
os.environ["TRANSFORMERS_NO_TF"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

try:
    from sentence_transformers import SentenceTransformer
except Exception:
    SentenceTransformer = None
from sklearn.metrics.pairwise import cosine_similarity

# -----------------------------
# LOAD MODEL (lazy safe)
# -----------------------------
try:
    model = SentenceTransformer('all-MiniLM-L6-v2') if SentenceTransformer else None
except Exception:
    model = None


# -----------------------------
# HELPERS
# -----------------------------
def to_list(text):
    try:
        if isinstance(text, list):
            return [str(s).lower().strip() for s in text if str(s).strip()]
        return [s.lower().strip() for s in ast.literal_eval(str(text)) if s.strip()]
    except:
        return []


def extract_number(text):
    nums = re.findall(r'\d+', str(text))
    return int(nums[0]) if nums else 0


def clean_skills(skills):
    return [s for s in skills if s not in ["not mentioned", "", None]]


def safe_to_float(value):
    try:
        return float(value)
    except:
        return 0.0


# -----------------------------
# FUZZY MATCH
# -----------------------------
def fuzzy_similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()


# -----------------------------
# HYBRID MATCH (ML + FUZZY)
# -----------------------------
def hybrid_skill_match(resume_skills, job_skills):

    if not job_skills:
        return [], 0.0

    # ---- ML MATCH ----
    if model:
        try:
            resume_vecs = model.encode(resume_skills)
            job_vecs = model.encode(job_skills)

            matched = []

            for i, j_vec in enumerate(job_vecs):
                sims = cosine_similarity([j_vec], resume_vecs)[0]
                if len(sims) > 0 and max(sims) > 0.6:
                    matched.append(job_skills[i])

            matched = list(set(matched))
            score = len(matched) / len(job_skills)

            return matched, round(score, 4)

        except Exception:
            pass  # fallback below

    # ---- FUZZY FALLBACK ----
    matched = []

    for r in resume_skills:
        for j in job_skills:
            if r == j or fuzzy_similarity(r, j) > 0.8:
                matched.append(j)
                break

    matched = list(set(matched))
    score = len(matched) / len(job_skills) if job_skills else 0

    return matched, round(score, 4)


# -----------------------------
# EDUCATION SCORE
# -----------------------------
EDUCATION_RANK = {
    "phd": 5,
    "msc": 4,
    "mca": 4,
    "mba": 4,
    "m.tech": 4,
    "master": 4,
    "bsc": 3,
    "b.tech": 3,
    "b.e": 3,
    "bachelor": 3,
    "diploma": 2,
}


def get_education_rank(edu_list):
    if not edu_list:
        return 0
    return max([EDUCATION_RANK.get(e, 0) for e in edu_list])


def education_score(resume_edu):
    rank = get_education_rank(resume_edu)

    if rank == 0:
        return 0.5
    elif rank >= 3:
        return 1.0
    else:
        return 0.7


# -----------------------------
# EXPERIENCE SCORE
# -----------------------------
def experience_score(resume_exp, job_exp_str):
    resume_exp = safe_to_float(resume_exp)
    job_exp = extract_number(job_exp_str)

    if job_exp > 0:
        return min(1.0, resume_exp / job_exp)
    else:
        return 1.0 if resume_exp > 0 else 0.5


# -----------------------------
# FINAL SCORE
# -----------------------------
def final_score_with_breakdown(resume, job):

    resume_skills = clean_skills(to_list(resume[1]))
    resume_edu = to_list(resume[2])
    resume_exp = safe_to_float(resume[3])

    job_skills = to_list(job[2])
    job_exp_str = job[4]

    job_exp = extract_number(job_exp_str)

    # 🔥 HARD FILTER (IMPORTANT)
    if job_exp > 0 and resume_exp < job_exp:
        return None  # exclude candidate

    matched, s_score = hybrid_skill_match(resume_skills, job_skills)

    e_score = experience_score(resume_exp, job_exp_str)
    edu_score = education_score(resume_edu)

    # ---- FINAL WEIGHT ----
    if s_score == 0:
        final = 0.1 * e_score + 0.05 * edu_score
    else:
        final = (0.60 * s_score) + (0.25 * e_score) + (0.15 * edu_score)

    return {
        "score": round(final * 100, 2),
        "skill_score": round(s_score * 100, 2),
        "experience_score": round(e_score * 100, 2),
        "education_score": round(edu_score * 100, 2),
        "matched_skills": matched
    }


# -----------------------------
# MAIN API FUNCTION (SAFE)
# -----------------------------
def compute_score(parsed_resume, job=None):

    try:
        resume = [
            None,
            str(parsed_resume.get("skills", [])),
            str(parsed_resume.get("education", [])),
            parsed_resume.get("experience_years", 0)
        ]

        if job:
            job_obj = [
                None,
                job.get("job_title", ""),
                str(job.get("mandatory_skills", []) + job.get("optional_skills", [])),
                None,
                job.get("experience_required", "0")
            ]
        else:
            job_obj = [
                None,
                "",
                str(parsed_resume.get("skills", [])),
                None,
                "0"
            ]

        result = final_score_with_breakdown(resume, job_obj)

        # 🔥 CRITICAL FIX (your crash)
        if result is None:
            return {
                "score": 0,
                "skill_score": 0,
                "experience_score": 0,
                "education_score": 0,
                "matched_skills": [],
                "filtered_out": True
            }

        return result

    except Exception as e:
        print("MATCHING ERROR:", e)

        return {
            "score": 0,
            "skill_score": 0,
            "experience_score": 0,
            "education_score": 0,
            "matched_skills": [],
            "error": True
        }
