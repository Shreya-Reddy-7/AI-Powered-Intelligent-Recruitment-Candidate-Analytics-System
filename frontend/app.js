const BASE_URL = "http://127.0.0.1:8000";
const h = React.createElement;

function App() {
  const [token, setToken] = React.useState(localStorage.getItem("ai_recruitment_token") || "");
  const [user, setUser] = React.useState(null);
  const [jobs, setJobs] = React.useState([]);
  const [selectedRanking, setSelectedRanking] = React.useState(null);
  const [resumeRankings, setResumeRankings] = React.useState(null);
  const [myApplications, setMyApplications] = React.useState([]);
  const [loginForm, setLoginForm] = React.useState({ username: "", password: "" });
  const [loginRole, setLoginRole] = React.useState("candidate");
  const [jobForm, setJobForm] = React.useState({ job_title: "", job_description: "" });
  const [resumeId, setResumeId] = React.useState("");
  const [resumeFile, setResumeFile] = React.useState(null);
  const [applyForm, setApplyForm] = React.useState({ jobId: null });
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (token) {
      localStorage.setItem("ai_recruitment_token", token);
      fetchCurrentUser();
      fetchJobs();
      fetchMyApplications();
    } else {
      localStorage.removeItem("ai_recruitment_token");
      setUser(null);
      setJobs([]);
      setSelectedRanking(null);
      setResumeRankings(null);
      setMyApplications([]);
    }
  }, [token]);

  async function apiFetch(path, options = {}) {
    const headers = options.headers || {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (err) {
      data = { message: text };
    }

    if (!response.ok) {
      const errorText = data?.detail || data?.message || response.statusText;
      throw new Error(errorText || "Request failed");
    }

    return data;
  }

  async function fetchCurrentUser() {
    try {
      const profile = await apiFetch("/users/me");
      setUser(profile);
      setError("");
    } catch (err) {
      setError(err.message);
      setToken("");
    }
  }

  async function fetchJobs() {
    if (!token) return;
    try {
      const allJobs = await apiFetch("/jobs/all");
      setJobs(allJobs || []);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function fetchMyApplications() {
    if (!token || !user || user.role !== "candidate") return;
    try {
      const applications = await apiFetch("/jobs/my-applications");
      setMyApplications(applications || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const formData = new URLSearchParams();
    formData.append("username", loginForm.username.trim());
    formData.append("password", loginForm.password);

    try {
      const result = await fetch(`${BASE_URL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });
      const data = await result.json();
      if (!result.ok) {
        throw new Error(data?.detail || data?.message || result.statusText);
      }
      setToken(data.access_token);
      setLoginForm({ username: "", password: "" });
      setMessage("Login successful.");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    setToken("");
    setUser(null);
    setMessage("Logged out successfully.");
    setError("");
  }

  async function handleJobRanking(jobId, topN = 10) {
    setError("");
    setMessage("");
    try {
      const path = `/ranking/top/${jobId}?n=${topN}`;
      const result = await apiFetch(path);
      setSelectedRanking(result);
      setResumeRankings(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleResumeRankings(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!resumeId) {
      setError("Please enter a resume ID.");
      return;
    }
    try {
      const result = await apiFetch(`/ranking/resume/${resumeId}`);
      setResumeRankings(result);
      setSelectedRanking(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleJobUpload(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!jobForm.job_title.trim() || !jobForm.job_description.trim()) {
      setError("Job title and description are required.");
      return;
    }
    try {
      const result = await apiFetch("/jobs/upload", {
        method: "POST",
        body: JSON.stringify(jobForm),
      });
      setMessage(result.message || "Job uploaded successfully.");
      setJobForm({ job_title: "", job_description: "" });
      fetchJobs();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleResumeUpload(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!resumeFile) {
      setError("Please choose a resume file.");
      return;
    }
    const formData = new FormData();
    formData.append("file", resumeFile);
    try {
      const result = await apiFetch("/resume/upload", {
        method: "POST",
        body: formData,
      });
      setMessage(`${result.message} (Resume ID: ${result.resume_id})`);
      setResumeFile(null);
      document.getElementById("resume-file-input").value = null;
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleApply(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!applyForm.jobId) {
      setError("Please select a job first.");
      return;
    }

    if (!resumeFile) {
      setError("Please upload a resume file.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", resumeFile);

      const uploadResult = await apiFetch("/resume/upload", {
        method: "POST",
        body: formData,
      });

      const resumeIdToUse = uploadResult.resume_id;
      setMessage(`${uploadResult.message} (Resume ID: ${resumeIdToUse})`);

      const result = await apiFetch(`/jobs/apply/${applyForm.jobId}`, {
        method: "POST",
        body: JSON.stringify({ resume_id: parseInt(resumeIdToUse) }),
      });

      setMessage(result.message || "Application submitted successfully.");
      setApplyForm({ jobId: null });
      setResumeFile(null);
      document.getElementById("resume-file-input").value = null;
      fetchMyApplications();
    } catch (err) {
      setError(err.message);
    }
  }

  const authSection = token
    ? h("section", null,
        h("h2", null, "Authenticated User"),
        h("p", null, user ? `Logged in as ${user.username} (${user.role})` : "Loading profile..."),
        h("button", { onClick: logout }, "Logout")
      )
    : h("section", { className: "login-panel" },
        h("div", { className: "login-header" },
          h("h2", null, "Candidate / Recruiter Login"),
          h("p", null, "Select your role and sign in to access jobs and applications.")
        ),
        h("form", { onSubmit: handleLogin },
          h("input", {
            type: "text",
            placeholder: "Username",
            value: loginForm.username,
            onChange: (e) => setLoginForm({ ...loginForm, username: e.target.value })
          }),
          h("input", {
            type: "password",
            placeholder: "Password",
            value: loginForm.password,
            onChange: (e) => setLoginForm({ ...loginForm, password: e.target.value })
          }),
          h("label", { className: "input-label" },
            "Login as",
            h("select", {
              value: loginRole,
              onChange: (e) => setLoginRole(e.target.value)
            },
              h("option", { value: "candidate" }, "Candidate"),
              h("option", { value: "recruiter" }, "Recruiter")
            )
          ),
          h("button", { type: "submit" }, `Login as ${loginRole.charAt(0).toUpperCase() + loginRole.slice(1)}`)
        )
      );

  const jobCards = jobs.map((job) =>
    h("div", { key: job.job_id, className: "card" },
      h("h3", null, job.job_title),
      h("p", null, h("strong", null, "Job ID: "), job.job_id),
      h("p", null, h("strong", null, "Experience: "), job.experience_required),
      h("p", null, h("strong", null, "Mandatory Skills: "), job.mandatory_skills.join(", ")),
      h("p", null, h("strong", null, "Optional Skills: "), job.optional_skills.join(", ") || "None"),
      user && user.role === "recruiter" && h("button", { className: "small secondary", onClick: () => handleJobRanking(job.job_id, 10) }, "View Top 10 Candidates"),
      user && user.role === "candidate" && h("button", { className: "small", onClick: () => setApplyForm({ jobId: job.job_id }) }, "Apply")
    )
  );

  const rankingDisplay = selectedRanking
    ? h("section", null,
        h("h2", null, `Top Candidates for ${selectedRanking.job_title}`),
        h("p", null, `Total candidates: ${selectedRanking.total_candidates}`),
        h("div", { className: "card-list" },
          selectedRanking.rankings.map((row) =>
            h("div", { key: row.resume_id, className: "card" },
              h("h3", null, `Resume ${row.resume_id}`),
              h("p", null, h("strong", null, "Score: "), row.score.toFixed(2)),
              h("p", null, h("strong", null, "Skill Score: "), row.skill_score.toFixed(2)),
              h("p", null, h("strong", null, "Experience Score: "), row.experience_score.toFixed(2)),
              h("p", null, h("strong", null, "Education Score: "), row.education_score.toFixed(2)),
              h("p", null, h("strong", null, "Matched Skills: "), row.matched_skills.join(", ") || "None")
            )
          )
        )
      )
    : null;

  const resumeRankingDisplay = resumeRankings
    ? h("section", null,
        h("h2", null, `Resume ${resumeRankings.resume_id} Rankings`),
        h("p", null, `Total jobs: ${resumeRankings.total_jobs}`),
        h("div", { className: "card-list" },
          resumeRankings.rankings.map((row, index) =>
            h("div", { key: `${row.job_id}-${index}`, className: "card" },
              h("h3", null, row.job_title),
              h("p", null, h("strong", null, "Job ID: "), row.job_id),
              h("p", null, h("strong", null, "Score: "), row.score.toFixed(2)),
              h("p", null, h("strong", null, "Matched Skills: "), row.matched_skills.join(", ") || "None")
            )
          )
        )
      )
    : null;

  return h("div", null,
    h("header", null,
      h("div", null,
        h("h1", null, "AI Recruitment Dashboard"),
        h("p", null, "A professional hiring workspace for recruiters and candidates — discover jobs, upload resumes, and manage applications from one secure panel.")
      )
    ),
    authSection,
    token && user && h("section", null,
      h("h2", null, "Jobs"),
      jobs.length > 0
        ? h("div", { className: "card-list" }, jobCards)
        : h("p", null, "No jobs loaded yet. Refresh to fetch jobs."),
      h("div", { style: { marginTop: "16px" } },
        h("button", { onClick: fetchJobs }, "Reload Jobs")
      )
    ),
    token && user && user.role === "recruiter" && h("section", null,
      h("h2", null, "Upload Job Description"),
      h("form", { onSubmit: handleJobUpload },
        h("input", {
          type: "text",
          placeholder: "Job Title",
          value: jobForm.job_title,
          onChange: (e) => setJobForm({ ...jobForm, job_title: e.target.value })
        }),
        h("textarea", {
          rows: 5,
          placeholder: "Job Description",
          value: jobForm.job_description,
          onChange: (e) => setJobForm({ ...jobForm, job_description: e.target.value })
        }),
        h("button", { type: "submit" }, "Upload Job")
      )
    ),
    token && h("section", null,
      h("h2", null, "Resume Ranking Lookup"),
      h("form", { onSubmit: handleResumeRankings },
        h("input", {
          type: "number",
          placeholder: "Resume ID",
          value: resumeId,
          onChange: (e) => setResumeId(e.target.value)
        }),
        h("button", { type: "submit" }, "Load Resume Rankings")
      )
    ),
    applyForm.jobId && h("section", null,
      h("h2", null, `Apply for Job ${applyForm.jobId}`),
      h("form", { onSubmit: handleApply },
        h("p", null, "Upload your resume to apply for this job:"),
        h("input", {
          id: "resume-file-input",
          type: "file",
          accept: ".pdf,.doc,.docx",
          onChange: (e) => setResumeFile(e.target.files[0])
        }),
        h("div", { style: { marginTop: "12px" } },
          h("button", { type: "submit" }, "Upload & Apply"),
          h("button", { type: "button", className: "secondary", onClick: () => setApplyForm({ jobId: null }), style: { marginLeft: "8px" } }, "Cancel")
        )
      )
    ),
    token && user && user.role === "candidate" && h("section", null,
      h("h2", null, "My Applications"),
      myApplications.length > 0
        ? h("div", { className: "card-list" },
            myApplications.map((app) =>
              h("div", { key: app.application_id, className: "card" },
                h("h3", null, app.job_title),
                h("p", null, h("strong", null, "Application ID: "), app.application_id),
                h("p", null, h("strong", null, "Job ID: "), app.job_id),
                h("p", null, h("strong", null, "Resume ID: "), app.resume_id),
                h("p", null, h("strong", null, "Status: "), h("span", { className: `status-${app.status}` }, app.status)),
                h("p", null, h("strong", null, "Applied: "), new Date(app.application_date).toLocaleDateString())
              )
            )
          )
        : h("p", null, "No applications yet. Apply to jobs above!")
    ),
    error && h("div", { className: "message error" }, error),
    message && h("div", { className: "message success" }, message),
    rankingDisplay,
    resumeRankingDisplay,
    h("div", { className: "footer" }, "Backend API: ", h("code", null, BASE_URL))
  );
}

const rootElement = document.getElementById("root");
ReactDOM.createRoot(rootElement).render(h(App));
