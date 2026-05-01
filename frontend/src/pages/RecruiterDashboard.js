import React, { useCallback, useEffect, useMemo, useState } from 'react';
import CandidateCard from '../components/CandidateCard';
import { apiRequest, authHeaders } from '../lib/api';

const initialJobForm = {
  job_title: '',
  job_description: '',
  experience_required: '',
};

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

const RecruiterDashboard = ({ user, token }) => {
  const [jobForm, setJobForm] = useState(initialJobForm);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [topInsight, setTopInsight] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const recruiterJobs = useMemo(
    () => jobs.filter((job) => job.postedBy === user?.username),
    [jobs, user]
  );

  const selectedJob = recruiterJobs.find((job) => job.id === selectedJobId) || recruiterJobs[0] || null;

  const refreshJobs = useCallback(async () => {
    const jobsResponse = await apiRequest('/jobs/all', { headers: authHeaders(token) });
    const formatted = (jobsResponse.jobs || []).map(formatJob);
    setJobs(formatted);

    if (!selectedJobId && formatted.length > 0) {
      const ownJob = formatted.find((job) => job.postedBy === user?.username);
      setSelectedJobId(ownJob?.id || null);
    }
  }, [selectedJobId, token, user?.username]);

  const refreshRanking = useCallback(async (jobId) => {
    if (!jobId) {
      setRankings([]);
      setTopInsight(null);
      return;
    }

    const [rankingResponse, applicantsResponse] = await Promise.all([
      apiRequest(`/ranking/job/${jobId}`, { headers: authHeaders(token) }),
      apiRequest(`/jobs/${jobId}/applicants`, { headers: authHeaders(token) }),
    ]);

    const applicationsByResumeId = new Map(
      (applicantsResponse.applications || []).map((application) => [application.resume_id, application])
    );

    setRankings(
      (rankingResponse.rankings || []).map((candidate) => ({
        ...candidate,
        application_id: applicationsByResumeId.get(candidate.resume_id)?.id,
        status: applicationsByResumeId.get(candidate.resume_id)?.status || 'pending',
      }))
    );
    setTopInsight(rankingResponse.top_insight || null);
  }, [token]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      await refreshJobs();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [refreshJobs]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (selectedJob?.id) {
      refreshRanking(selectedJob.id).catch((requestError) => setError(requestError.message));
    } else {
      setRankings([]);
      setTopInsight(null);
    }
  }, [refreshRanking, selectedJob?.id]);

  const handlePostJob = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      const result = await apiRequest('/jobs/upload', {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
        body: JSON.stringify(jobForm),
      });

      setMessage(result.message || 'Job posted successfully');
      setJobForm(initialJobForm);
      await refreshJobs();
      if (result.job_id) {
        setSelectedJobId(result.job_id);
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (applicationId, status) => {
    setMessage('');
    setError('');

    try {
      await apiRequest(`/jobs/applications/${applicationId}/status?status=${status}`, {
        method: 'PUT',
        headers: authHeaders(token),
      });
      setMessage(`Application marked as ${status}.`);
      if (selectedJob?.id) {
        await refreshRanking(selectedJob.id);
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <section className="grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="space-y-6">
          <div className="glass-panel p-6 md:p-8">
            <p className="badge border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Recruiter Control Room</p>
            <h1 className="mt-4 text-4xl font-bold text-white md:text-5xl">Manage hiring with ranked intelligence</h1>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Publish openings, inspect top candidates, and move applicants through shortlist and rejection steps with
              backend-generated scores and AI explanations.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Posted jobs</p>
                <p className="mt-3 text-3xl font-bold text-white">{recruiterJobs.length}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Selected role</p>
                <p className="mt-3 text-xl font-bold text-white">{selectedJob?.title || 'No job selected'}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Visible rankings</p>
                <p className="mt-3 text-3xl font-bold text-white">{rankings.length}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handlePostJob} className="glass-panel p-6 md:p-8">
            <h2 className="text-2xl font-bold text-white">Post a new job</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              The backend will parse mandatory and optional skills from the description when this is submitted.
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Job title</label>
                <input
                  className="field"
                  required
                  value={jobForm.job_title}
                  onChange={(event) => setJobForm((current) => ({ ...current, job_title: event.target.value }))}
                  placeholder="Senior Data Analyst"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Experience required</label>
                <input
                  className="field"
                  required
                  value={jobForm.experience_required}
                  onChange={(event) => setJobForm((current) => ({ ...current, experience_required: event.target.value }))}
                  placeholder="3 years"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">Job description</label>
                <textarea
                  className="field min-h-[180px]"
                  required
                  value={jobForm.job_description}
                  onChange={(event) => setJobForm((current) => ({ ...current, job_description: event.target.value }))}
                  placeholder="Describe responsibilities, must-have skills, and preferred background."
                />
              </div>
            </div>

            <button type="submit" className="primary-button mt-6 w-full" disabled={submitting}>
              {submitting ? 'Posting job...' : 'Publish role'}
            </button>
          </form>
        </div>

        <div className="glass-panel p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Ranking board</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Candidate leaderboard</h2>
            </div>
            <select
              className="field max-w-sm"
              value={selectedJob?.id || ''}
              onChange={(event) => setSelectedJobId(Number(event.target.value))}
            >
              {recruiterJobs.length === 0 && <option value="">No recruiter jobs yet</option>}
              {recruiterJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.title}
                </option>
              ))}
            </select>
          </div>

          {message && (
            <div className="mt-5 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm text-emerald-100">
              {message}
            </div>
          )}
          {error && (
            <div className="mt-5 rounded-3xl border border-rose-300/20 bg-rose-300/10 px-5 py-4 text-sm text-rose-100">
              {error}
            </div>
          )}

          {topInsight && (
            <div className="mt-5 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-5">
              <p className="text-sm uppercase tracking-[0.22em] text-cyan-100">Top insight</p>
              <p className="mt-3 text-lg font-semibold text-white">{selectedJob?.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-100">{topInsight.reason || 'Ranking generated successfully.'}</p>
            </div>
          )}

          <div className="mt-6 space-y-5">
            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">Loading recruiter data...</div>
            ) : rankings.length > 0 ? (
              rankings.map((candidate) => (
                <CandidateCard
                  key={`${candidate.resume_id}-${candidate.application_id}`}
                  candidate={candidate}
                  onStatusChange={handleStatusChange}
                  showActions
                  status={candidate.status}
                />
              ))
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-300">
                {recruiterJobs.length === 0
                  ? 'Post your first role to start receiving applicants.'
                  : 'No ranked applicants yet for this role. Candidates need to apply before rankings appear.'}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default RecruiterDashboard;
