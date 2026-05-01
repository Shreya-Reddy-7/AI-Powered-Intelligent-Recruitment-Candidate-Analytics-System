import pandas as pd
import re
import json
import sqlite3
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.stem import WordNetLemmatizer
import os

# -----------------------------
# NLTK SETUP (SAFE)
# -----------------------------
def _try_download(resource):
    try:
        nltk.download(resource, quiet=True)
    except Exception:
        pass


for resource_path, resource_name in (
    ('tokenizers/punkt', 'punkt'),
    ('corpora/stopwords', 'stopwords'),
    ('corpora/wordnet', 'wordnet'),
):
    try:
        nltk.data.find(resource_path)
    except Exception:
        _try_download(resource_name)


# -----------------------------
# CONFIG
# -----------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RESUME_CSV = os.path.join(BASE_DIR, 'datasets', 'Resume.csv')
DB_PATH = os.path.join(BASE_DIR, 'database', 'resume_database.db')


# -----------------------------
# SKILL LIST
# -----------------------------
skills_list = [
    'python', 'java', 'c++', 'sql', 'machine learning', 'deep learning', 'nlp',
    'data analysis', 'data science', 'excel', 'power bi', 'tableau',
    'html', 'css', 'javascript', 'react', 'node', 'flask', 'django',
    'tensorflow', 'pytorch', 'scikit learn'
]


# -----------------------------
# EDUCATION KEYWORDS
# -----------------------------
education_keywords = [
    'bachelor', 'bachelor of technology', 'b.tech', 'b.e',
    'master', 'm.tech', 'mca', 'mba',
    'bsc', 'msc', 'phd',
    'computer science', 'information technology',
    'electronics', 'mechanical engineering'
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
# TEXT PREPROCESSING
# -----------------------------
try:
    stop_words = set(stopwords.words('english'))
except LookupError:
    stop_words = {
        "a", "an", "the", "and", "or", "to", "of", "in", "for", "on", "with",
        "is", "are", "was", "were", "be", "by", "as", "at", "from"
    }
lemmatizer = WordNetLemmatizer()

def preprocess_text(text):
    try:
        tokens = word_tokenize(text)
    except LookupError:
        tokens = text.split()
    tokens = [word for word in tokens if word not in stop_words]
    try:
        tokens = [lemmatizer.lemmatize(word) for word in tokens]
    except LookupError:
        pass
    return " ".join(tokens)


# -----------------------------
# SKILL EXTRACTION (IMPROVED)
# -----------------------------
def extract_skills(text):
    extracted = []

    for skill in skills_list:
        if re.search(rf'\b{re.escape(skill)}\b', text):
            extracted.append(skill)

    return list(set(extracted))


# -----------------------------
# EXPERIENCE EXTRACTION
# -----------------------------
def total_experience(text):
    pattern = r'(\d+)\+?\s*(years|year|yrs|yr)'
    matches = re.findall(pattern, text.lower())
    years = [int(match[0]) for match in matches]
    return max(years) if years else 0


# -----------------------------
# EDUCATION EXTRACTION
# -----------------------------
def extract_education(text):
    extracted = []

    for edu in education_keywords:
        if re.search(rf'\b{re.escape(edu)}\b', text):
            extracted.append(edu)

    return list(set(extracted))


# -----------------------------
# PARSE SINGLE RESUME (API USE)
# -----------------------------
def parse_resume_text(text):

    cleaned = clean_text(text)
    processed = preprocess_text(cleaned)

    skills = extract_skills(processed)
    experience = total_experience(text)
    education = extract_education(cleaned)

    return {
        "skills": skills,  # ❗ no "Not Mentioned"
        "education": education,
        "experience_years": experience
    }


# -----------------------------
# PARSE ALL RESUMES (DATASET PIPELINE)
# -----------------------------
def parse_all_resumes():

    print("📥 Loading resume dataset...")
    df = pd.read_csv(RESUME_CSV)
    df = df[['Resume_str']]

    print("⚙️ Processing resumes...")

    df['cleaned'] = df['Resume_str'].apply(clean_text)
    df['processed'] = df['cleaned'].apply(preprocess_text)
    df['skills'] = df['processed'].apply(extract_skills)
    df['education'] = df['cleaned'].apply(extract_education)
    df['experience'] = df['Resume_str'].apply(total_experience)

    # -----------------------------
    # SAVE TO DATABASE (SAFE TABLE)
    # -----------------------------
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS resumes_dataset (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        skills TEXT,
        education TEXT,
        experience INTEGER
    )
    """)

    cursor.execute("DELETE FROM resumes_dataset")

    for _, row in df.iterrows():
        cursor.execute("""
        INSERT INTO resumes_dataset (skills, education, experience)
        VALUES (?, ?, ?)
        """, (
            json.dumps(row['skills']),
            json.dumps(row['education']),
            row['experience']
        ))

    conn.commit()

    cursor.execute("SELECT COUNT(*) FROM resumes_dataset")
    count = cursor.fetchone()[0]

    conn.close()

    print(f"✅ Stored {count} resumes in dataset table")

    return count


# -----------------------------
# RUN DIRECTLY
# -----------------------------
if __name__ == "__main__":
    parse_all_resumes()
