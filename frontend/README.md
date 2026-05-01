# Frontend UI for AI Recruitment System

This frontend is a minimal React-based dashboard that consumes the backend API at `http://127.0.0.1:8000`.

## Usage
1. Start the backend:
   ```bash
   uvicorn backend.main:app --reload
   ```
2. Open `frontend/index.html` in your web browser.

## Features
- Register and login users
- Fetch current profile
- View all jobs
- **Apply to jobs (candidates only)**
- **View my job applications (candidates only)**
- Recruiters can fetch top-ranked candidates for jobs and upload new job descriptions
- Candidates can upload resume files
- Lookup resume rankings by resume ID
