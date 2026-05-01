import re
import json
import sqlite3
import pandas as pd
import os

# -----------------------------
# CONFIG
# -----------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

JOBS_CSV = os.path.join(BASE_DIR, 'datasets', 'job_title_des.csv')
DB_PATH = os.path.join(BASE_DIR, 'database', 'jobs_database.db')
JSON_PATH = os.path.join(BASE_DIR, 'database', 'structured_jobs.json')

# -----------------------------
# SKILL LIST
# -----------------------------
skills_list = [
    'python', 'java', 'c++', 'sql', 'machine learning', 'deep learning',
    'tensorflow', 'pytorch', 'nlp', 'data analysis', 'data science',
    'flask', 'django', 'react', 'node', 'flutter', 'android', 'ios',
    'docker', 'kubernetes', 'aws', 'git',
    'communication', 'teamwork', 'problem solving',
    'leadership', 'critical thinking'
]

# -----------------------------
# TEXT CLEANING
# -----------------------------
def clean_text(text):
    text = re.sub(r'http\S+', '', str(text))
    text = re.sub(r'[^A-Za-z\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.lower()


# -----------------------------
# SKILL EXTRACTION (IMPROVED)
# -----------------------------
def extract_skills(text):
    extracted = []

    for skill in skills_list:
        # exact word match (better than "in")
        if re.search(rf'\b{re.escape(skill)}\b', text):
            extracted.append(skill)

    return list(set(extracted))


# -----------------------------
# EXPERIENCE EXTRACTION
# -----------------------------
def extract_experience(text):
    pattern = r'(\d+)\+?\s*(years|year|yrs|yr)'
    matches = re.findall(pattern, text.lower())

    years = [int(match[0]) for match in matches]

    return f"{max(years)} years" if years else "0"


# -----------------------------
# MANDATORY VS OPTIONAL
# -----------------------------
def classify_skills(text, skills):

    mandatory = []
    optional = []

    for skill in skills:
        if re.search(rf'(must|required).*{re.escape(skill)}', text):
            mandatory.append(skill)
        else:
            optional.append(skill)

    return mandatory, optional


# -----------------------------
# WEIGHT ASSIGNMENT
# -----------------------------
def assign_weights(skills, mandatory):
    return {skill: 2 if skill in mandatory else 1 for skill in skills}


# -----------------------------
# PARSE SINGLE JOB (API USE)
# -----------------------------
def parse_job(text):

    cleaned = clean_text(text)

    skills = extract_skills(cleaned)
    experience = extract_experience(text)
    mandatory, optional = classify_skills(cleaned, skills)

    return {
        "skills": skills,
        "mandatory_skills": mandatory,
        "optional_skills": optional,
        "experience_required": experience
    }


# -----------------------------
# PARSE ALL JOBS (DATASET PIPELINE)
# -----------------------------
def parse_all_jobs():

    print("📥 Loading jobs dataset...")
    df = pd.read_csv(JOBS_CSV)

    df.columns = ['index', 'job_title', 'job_description']
    df = df.drop(columns=['index'])
    df['job_description'] = df['job_description'].fillna('')

    job_data = []

    print("⚙️ Parsing job descriptions...")

    for idx, row in df.iterrows():

        parsed = parse_job(row['job_description'])

        job_data.append({
            "job_id": idx + 1,
            "job_title": row['job_title'],
            "job_description": row['job_description'],
            "mandatory_skills": parsed['mandatory_skills'],
            "optional_skills": parsed['optional_skills'],
            "experience_required": parsed['experience_required']
        })

    # -----------------------------
    # SAVE JSON
    # -----------------------------
    with open(JSON_PATH, "w") as f:
        json.dump(job_data, f, indent=4)

    print(f"✅ JSON saved → {JSON_PATH}")

    # -----------------------------
    # SAVE TO DATABASE (FIXED)
    # -----------------------------
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("DROP TABLE IF EXISTS jobs")

    cursor.execute("""
    CREATE TABLE jobs (
        job_id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_title TEXT,
        job_description TEXT,
        experience_required TEXT,
        mandatory_skills TEXT,
        optional_skills TEXT
    )
    """)

    for job in job_data:
        cursor.execute("""
        INSERT INTO jobs (
            job_title,
            job_description,
            experience_required,
            mandatory_skills,
            optional_skills
        )
        VALUES (?, ?, ?, ?, ?)
        """, (
            job['job_title'],
            job['job_description'],
            job['experience_required'],
            json.dumps(job['mandatory_skills']),
            json.dumps(job['optional_skills'])
        ))

    conn.commit()

    cursor.execute("SELECT COUNT(*) FROM jobs")
    count = cursor.fetchone()[0]

    conn.close()

    print(f"✅ Stored {count} jobs in database")

    return job_data


# -----------------------------
# RUN DIRECTLY
# -----------------------------
if __name__ == "__main__":
    parse_all_jobs()