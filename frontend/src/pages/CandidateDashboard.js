import React, { useCallback, useEffect, useMemo, useState } from 'react';
import JobCard from '../components/JobCard';
import ResumeUpload from '../components/ResumeUpload';
import { apiRequest, authHeaders } from '../lib/api';

function formatJob(job) {
  return {
    id: job.job_id,
    title: job.job_title,
    description: job.description,
    experience: job.experience_required,
    skills: job.mandatory_skills || [],
    optionalSkills: job.optional_skills || [],
    postedBy: job.posted_by,
  };
}

const CandidateDashboard = ({ user, token }) => {
  const [jobs, setJobs] = useState([]);
  const [resume, setResume] = useState(null);
  const [applications, setApplications] = useState([]);
  const [rankingSummary, setRankingSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const appliedJobIds = useMemo(() => new Set(applications.map((application) => application.job_id)), [applications]);

  const recommendedJobs = useMemo(() => {
    return jobs
      .filter((job) => !appliedJobIds.has(job.id))
      .map((job) => {
        const matchedSkills = (resume?.parsed_data?.skills || []).filter((skill) =>
          job.skills.some((required) => required.toLowerCase() === skill.toLowerCase())
        );
        const matchPercentage = job.skills.length
          ? Math.round((matchedSkills.length / job.skills.length) * 100)
          : 0;

        return {
          ...job,
          matchPercentage,
        };
      })
      .sort((left, right) => right.matchPercentage - left.matchPercentage)
      .slice(0, 3);
  }, [appliedJobIds, jobs, resume]);

  const refreshData = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setError('');

    try {
      const [jobsResponse, resumeResponse, applicationResponse] = await Promise.all([
        apiRequest('/jobs/all', { headers: authHeaders(token) }),
        apiRequest('/resume/me', { headers: authHeaders(token) }),
        apiRequest('/jobs/applications/me', { headers: authHeaders(token) }),
      ]);

      const formattedJobs = (jobsResponse.jobs || []).map(formatJob);
      setJobs(formattedJobs);
      setResume(resumeResponse.has_resume ? resumeResponse : null);
      setApplications(applicationResponse.applications || []);

      if (resumeResponse.has_resume) {
        const rankingResponse = await apiRequest(`/ranking/resume/${resumeResponse.resume_id}`, {
          headers: authHeaders(token),
        });
        setRankingSummary(rankingResponse.rankings || []);
      } else {
        setRankingSummary([]);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleResumeUpload = async (file) => {
    setMessage('');
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await apiRequest('/resume/upload', {
        method: 'POST',
        headers: authHeaders(token),
        body: formData,
      });

      setMessage(result.message || 'Resume uploaded successfully');
      await refreshData(true);
    } catch (uploadError) {
      setError(uploadError.message);
    }
  };

  const handleApply = async (job) => {
    if (!resume?.resume_id) {
      setError('Upload your resume before applying to a job.');
      return;
    }

    setMessage('');
    setError('');

    try {
      await apiRequest(`/jobs/apply/${job.id}?resume_id=${resume.resume_id}`, {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      });
      setMessage(`Application submitted for ${job.title}.`);
      await refreshData(true);
    } catch (applyError) {
      setError(applyError.message);
    }
  };

  const totalShortlisted = applications.filter((application) => application.status === 'shortlisted').length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-panel p-6 md:p-8">
          <p className="badge border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Candidate Command Center</p>
          <h1 className="mt-4 text-4xl font-bold text-white md:text-5xl">Welcome back, {user?.username}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
            Manage your resume, discover relevant openings, and track how your profile performs against each job.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Resume</p>
              <p className="mt-3 text-3xl font-bold text-white">{resume?.resume_id || '--'}</p>
              <p className="mt-2 text-sm text-slate-300">{resume ? 'Parsed and active for applications' : 'Upload to unlock applications'}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Applications</p>
              <p className="mt-3 text-3xl font-bold text-white">{applications.length}</p>
              <p className="mt-2 text-sm text-slate-300">Current tracked job applications</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Shortlisted</p>
              <p className="mt-3 text-3xl font-bold text-white">{totalShortlisted}</p>
              <p className="mt-2 text-sm text-slate-300">Recruiter decisions already in your favor</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 md:p-8">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Profile snapshot</p>
          <h2 className="mt-3 text-2xl font-bold text-white">Resume intelligence</h2>
          {resume ? (
            <div className="mt-5 space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-300">Skills</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {resume.parsed_data.skills.map((skill) => (
                    <span key={skill} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Experience</p>
                  <p className="mt-2 text-2xl font-bold text-white">{resume.parsed_data.experience_years} years</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Verdict</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-200">{resume.analysis?.verdict || 'Potential'}</p>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">AI Summary</p>
                <p className="mt-3 text-sm leading-6 text-slate-300">{resume.analysis?.summary}</p>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm leading-6 text-slate-300">No resume found yet. Upload one to unlock matching and application features.</p>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-6">
          <ResumeUpload onUpload={handleResumeUpload} />

          {message && (
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm text-emerald-100">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-3xl border border-rose-300/20 bg-rose-300/10 px-5 py-4 text-sm text-rose-100">
              {error}
            </div>
          )}

          <div className="glass-panel p-6">
            <h2 className="text-2xl font-bold text-white">Ranking preview</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Your per-job scores appear here after you apply with an uploaded resume.
            </p>
            <div className="mt-5 space-y-4">
              {rankingSummary.length > 0 ? (
                rankingSummary.slice(0, 3).map((item) => (
                  <div key={`${item.job_id}-${item.resume_id}`} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold text-white">{item.job_title}</p>
                        <p className="mt-1 text-sm text-slate-300 capitalize">Status: {item.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-200">{item.score.toFixed(1)}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Score</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-slate-300">{item.analysis?.summary}</p>
                  </div>
                ))
              ) : (
                <p className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  No ranking history yet.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Recommended roles</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Best matches from the current job board</h2>
            </div>
            <p className="text-sm text-slate-400">{loading ? 'Refreshing...' : `${jobs.length} total jobs available`}</p>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            {(recommendedJobs.length > 0 ? recommendedJobs : jobs.slice(0, 4)).map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onApply={handleApply}
                applied={appliedJobIds.has(job.id)}
                disabled={!resume?.resume_id}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default CandidateDashboard;
