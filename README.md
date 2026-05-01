# 🚀 AI-Powered Intelligent Recruitment & Candidate Analytics System

An AI-driven recruitment platform that intelligently matches candidates to job roles using skill-based scoring, experience evaluation, and AI-generated insights.

---

## 🔥 Key Features

- ✅ Role-based system (Recruiter & Candidate)
- ✅ Secure JWT Authentication
- ✅ Resume upload and parsing
- ✅ Job description analysis (skills + experience extraction)
- ✅ Intelligent candidate ranking (Top candidates)
- ✅ AI-generated candidate insights (LLM-based)
- ✅ Only applied candidates are ranked
- ✅ Experience-based filtering (ineligible candidates excluded)
- ✅ Recruiter approval system (Shortlist / Reject)
- ✅ Candidate application tracking (status visibility)
- ✅ Skill normalization (case-insensitive matching)
- ✅ Clean modular backend architecture

---

## 🧠 How It Works

1. Recruiter uploads a job
2. Candidate uploads resume
3. Candidate applies for job
4. System evaluates: Skills, Experience, and Education
5. Candidates are ranked automatically
6. AI generates insights: Strengths, Weaknesses, Improvements, and Final Verdict
7. Recruiter shortlists or rejects
8. Candidate sees application status

---

## 📊 Scoring Logic
Final Score = (0.60 × Skill Score) + (0.25 × Experience Score) + (0.15 × Education Score)
Match % = (Matched Skills / Total Resume Skills) × 100

- ✔ Case-insensitive matching
- ✔ Weighted scoring system

---

## 🏗️ Project Structure
backend/
│
├── main.py                 # FastAPI entry point
├── auth.py                 # JWT Authentication
├── database.py             # Database setup
├── models.py               # Pydantic schemas
│
└── routers/
├── users.py            # Auth APIs
├── resume.py           # Resume upload
├── jobs.py             # Jobs + applications + approval
└── ranking.py          # Ranking engine
modules/
├── matching_engine.py      # Scoring logic
└── job_parser.py           # Job parsing
|___ resume_parsing.py

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI |
| Database | SQLite |
| Authentication | JWT |
| AI / NLP | Rule-based matching engine + LLM analysis |
| Frontend | React (Planned) |

---

## 🚀 Setup Instructions

### 1. Clone Repository

```bash
git clone <your-repo-url>
cd AI-Recruitment-System
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Create `.env` File

```env
SECRET_KEY=your_secret_key
GROQ_API_KEY=your_api_key
```

> ⚠️ Add `.env` to `.gitignore`

### 4. Run Server

```bash
uvicorn backend.main:app --reload
```

### 5. Open Swagger UI
http://127.0.0.1:8000/docs

---

## 🔐 Authentication Flow

1. Register user (candidate / recruiter)
2. Login → receive JWT token
3. Click **Authorize** in Swagger UI
4. Use protected APIs

---

## 📌 API Endpoints

### 👤 Users

| Method | Endpoint | Description |
|---|---|---|
| POST | `/users/register` | Register |
| POST | `/users/login` | Login |
| GET | `/users/me` | Get current user |

### 📄 Resume (Candidate)

| Method | Endpoint |
|---|---|
| POST | `/resume/upload` |

### 💼 Jobs

| Method | Endpoint | Access |
|---|---|---|
| GET | `/jobs/all` | Any logged user |
| GET | `/jobs/{job_id}` | Any logged user |
| POST | `/jobs/upload` | Recruiter |
| POST | `/jobs/apply/{job_id}` | Candidate |

### 📊 Applications

| Method | Endpoint | Access |
|---|---|---|
| GET | `/jobs/applications/me` | Candidate |
| GET | `/jobs/{job_id}/applicants` | Recruiter |
| PUT | `/jobs/applications/{application_id}/status` | Recruiter |

**Status values:** `pending` · `shortlisted` · `rejected`

### 🏆 Ranking

| Method | Endpoint | Access |
|---|---|---|
| GET | `/ranking/top/{job_id}` | Recruiter |

- ✔ Only applied candidates
- ✔ Experience filtering applied

---

## 📌 Example Output

```json
{
  "resume_id": 1,
  "score": 82.5,
  "match_percentage": 66.67,
  "badge": "Gold",
  "analysis": {
    "verdict": "Strong Fit",
    "summary": "Candidate has strong ML skills"
  }
}
```

---

## 🎯 Application Workflow

**👨‍💻 Candidate**
Register → Login → Upload Resume → View Jobs → Apply → Check Status

**👨‍💼 Recruiter**
Register → Login → Upload Job → View Applicants → View Ranking → Shortlist / Reject

---

## 🏛️ System Design
Matching Engine  →  Scoring
Ranking Engine   →  Sorting + Filtering
LLM              →  Explanation
Jobs             →  Workflow Control

---

## ⚠️ Important Notes

- Only applied candidates are ranked
- Experience filtering is applied before ranking
- Skill matching is case-insensitive
- Recruiter decision overrides ranking order
- LLM output is validated before display
- SQLite is used for simplicity (production-ready DB migration planned)
