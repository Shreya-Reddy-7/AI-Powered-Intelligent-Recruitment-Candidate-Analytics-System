import React, { useCallback, useEffect, useState } from 'react';
import ResumeUpload from '../components/ResumeUpload';
import { apiRequest, authHeaders } from '../lib/api';

const ResumeAnalyzer = ({ token }) => {
  const [resume, setResume] = useState(null);
  const [rankingSummary, setRankingSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadResume = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const resumeResponse = await apiRequest('/resume/me', { headers: authHeaders(token) });
      if (resumeResponse.has_resume) {
        setResume(resumeResponse);
        const rankingResponse = await apiRequest(`/ranking/resume/${resumeResponse.resume_id}`, {
          headers: authHeaders(token),
        });
        setRankingSummary(rankingResponse.rankings || []);
      } else {
        setResume(null);
        setRankingSummary([]);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadResume();
  }, [loadResume]);

  const handleUpload = async (file) => {
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
      setMessage(result.message || 'Resume analyzed successfully');
      await loadResume();
    } catch (uploadError) {
      setError(uploadError.message);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <ResumeUpload onUpload={handleUpload} />

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
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Performance snapshot</p>
            <h1 className="mt-3 text-3xl font-bold text-white">Resume lab</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Upload a new version anytime to refresh parsed skills, experience, and the AI-generated review used for ranking.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Resume ID</p>
                <p className="mt-2 text-3xl font-bold text-white">{resume?.resume_id || '--'}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Tracked jobs</p>
                <p className="mt-2 text-3xl font-bold text-white">{rankingSummary.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 md:p-8">
          {loading ? (
            <p className="text-sm text-slate-300">Loading resume analysis...</p>
          ) : resume ? (
            <div className="space-y-6">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-400">AI analysis</p>
                <h2 className="mt-2 text-3xl font-bold text-white">{resume.analysis?.verdict || 'Resume insight'}</h2>
                <p className="mt-3 text-base leading-7 text-slate-300">{resume.analysis?.summary}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Strengths</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(resume.analysis?.strengths || []).map((item) => (
                      <span key={item} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-sm text-emerald-100">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Improvements</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(resume.analysis?.improvements || []).map((item) => (
                      <span key={item} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-sm text-amber-100">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Parsed profile</p>
                <div className="mt-4 grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <p className="text-sm font-medium text-slate-200">Skills</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {resume.parsed_data.skills.map((skill) => (
                        <span key={skill} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-slate-200">Experience</p>
                      <p className="mt-2 text-2xl font-bold text-white">{resume.parsed_data.experience_years} years</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">Education</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {resume.parsed_data.education.map((item) => (
                          <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-200">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Ranking history</p>
                <div className="mt-4 space-y-4">
                  {rankingSummary.length > 0 ? (
                    rankingSummary.map((item) => (
                      <div key={`${item.job_id}-${item.resume_id}`} className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-lg font-semibold text-white">{item.job_title}</p>
                            <p className="mt-1 text-sm capitalize text-slate-400">Status: {item.status}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-200">{item.score.toFixed(1)}</p>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Score</p>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-300">{item.analysis?.ranking_reason || item.analysis?.summary}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-300">Apply to a job to see ranking outcomes here.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Resume lab</p>
              <h2 className="mt-2 text-3xl font-bold text-white">No resume analysis yet</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                Upload your resume to generate parsed skills, experience extraction, AI guidance, and ranking previews.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default ResumeAnalyzer;
