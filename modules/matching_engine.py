import ast
import re
import os
from difflib import SequenceMatcher

# -----------------------------
# ENV FIX
# -----------------------------
os.environ["TRANSFORMERS_NO_TF"] = "1"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

# -----------------------------
# LOAD MODEL
# -----------------------------
try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
except Exception:
    model = None


# -----------------------------
# HELPERS
# -----------------------------
def normalize_text(text):
    text = str(text).lower().strip()
    text = re.sub(r'[-_/]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text


def to_list(text):
    try:
        if isinstance(text, list):
            return [normalize_text(s) for s in text if str(s).strip()]
        return [normalize_text(s) for s in ast.literal_eval(str(text)) if s.strip()]
    except:
        return []


def extract_number(text):
    nums = re.findall(r'\d+', str(text))
    return int(nums[0]) if nums else 0


def safe_to_float(value):
    try:
        return float(value)
    except:
        return 0.0


def char_similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()


# -----------------------------
# TF-IDF SIMILARITY
# -----------------------------
def tfidf_similarity(resume_text, job_text):
    try:
        vectorizer = TfidfVectorizer(stop_words='english')
        vectors = vectorizer.fit_transform([resume_text, job_text])
        sim = cosine_similarity(vectors[0:1], vectors[1:2])[0][0]
        return sim
    except:
        return 0.0


# -----------------------------
# HYBRID MATCH (ML + FUZZY)
# -----------------------------
def hybrid_skill_match(resume_skills, job_skills):

    if not job_skills:
        return [], 0.0

    resume_skills = [normalize_text(s) for s in resume_skills]
    job_skills = [normalize_text(s) for s in job_skills]

    matched = []

    # ---- ML MATCH ----
    if model:
        try:
            resume_vecs = model.encode(resume_skills)
            job_vecs = model.encode(job_skills)

            for i, j_vec in enumerate(job_vecs):

                sims = cosine_similarity([j_vec], resume_vecs)[0]
                max_sim = max(sims) if len(sims) else 0

                for r in resume_skills:
                    if (
                        max_sim > 0.55 or
                        char_similarity(r, job_skills[i]) > 0.75
                    ):
                        matched.append(job_skills[i])
                        break

            matched = list(set(matched))
            score = len(matched) / len(job_skills)

            return matched, score

        except Exception:
            pass

    # ---- FALLBACK ----
    for r in resume_skills:
        for j in job_skills:
            if r == j or char_similarity(r, j) > 0.8:
                matched.append(j)
                break

    matched = list(set(matched))
    score = len(matched) / len(job_skills) if job_skills else 0

    return matched, score


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


def education_score(resume_edu):
    if not resume_edu:
        return 0.5
    rank = max([EDUCATION_RANK.get(e, 0) for e in resume_edu])
    return 1.0 if rank >= 3 else 0.7


# -----------------------------
# EXPERIENCE SCORE
# -----------------------------
def experience_score(resume_exp, job_exp_str):
    resume_exp = safe_to_float(resume_exp)
    job_exp = extract_number(job_exp_str)

    if job_exp > 0:
        return min(1.0, resume_exp / job_exp)
    return 1.0 if resume_exp > 0 else 0.5


# -----------------------------
# FINAL SCORE
# -----------------------------
def final_score_with_breakdown(resume, job):

    resume_skills = to_list(resume[1])
    resume_edu = to_list(resume[2])
    resume_exp = safe_to_float(resume[3])

    job_skills = to_list(job[2])
    job_exp_str = job[4]

    job_exp = extract_number(job_exp_str)

    # HARD FILTER
    if job_exp > 0 and resume_exp < job_exp:
        return None

    # MATCHING
    matched, s_score = hybrid_skill_match(resume_skills, job_skills)

    e_score = experience_score(resume_exp, job_exp_str)
    edu_score = education_score(resume_edu)

    # TF-IDF
    resume_text = " ".join(resume_skills)
    job_text = " ".join(job_skills)
    tfidf_score = tfidf_similarity(resume_text, job_text)

    # FINAL SCORE (HYBRID)
    final = (
        0.50 * s_score +
        0.20 * e_score +
        0.15 * edu_score +
        0.15 * tfidf_score
    )

    return {
        "score": round(final * 100, 2),
        "skill_score": round(s_score * 100, 2),
        "experience_score": round(e_score * 100, 2),
        "education_score": round(edu_score * 100, 2),
        "tfidf_score": round(tfidf_score * 100, 2),
        "matched_skills": matched,
        "job_skills": job_skills
    }


# -----------------------------
# MAIN API FUNCTION
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

        if result is None:
            return {
                "score": 0,
                "skill_score": 0,
                "experience_score": 0,
                "education_score": 0,
                "tfidf_score": 0,
                "matched_skills": [],
                "job_skills": [],
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
            "tfidf_score": 0,
            "matched_skills": [],
            "job_skills": [],
            "error": True
        }