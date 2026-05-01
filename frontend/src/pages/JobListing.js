import React, { useEffect, useMemo, useState } from 'react';
import JobCard from '../components/JobCard';
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
    experienceNumeric: job.experience_numeric || 0,
  };
}

const JobListing = ({ user, token }) => {
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [resume, setResume] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [experienceFilter, setExperienceFilter] = useState('');
  const [skillFilter, setSkillFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const jobsResponse = await apiRequest('/jobs/all', { headers: authHeaders(token) });
        const formattedJobs = (jobsResponse.jobs || []).map(formatJob);

        if (ignore) {
          return;
        }

        setJobs(formattedJobs);

        if (user.role === 'candidate') {
          const [applicationResponse, resumeResponse] = await Promise.all([
            apiRequest('/jobs/applications/me', { headers: authHeaders(token) }),
            apiRequest('/resume/me', { headers: authHeaders(token) }),
          ]);

          if (!ignore) {
            setApplications(applicationResponse.applications || []);
            setResume(resumeResponse.has_resume ? resumeResponse : null);
          }
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError.message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [token, user.role]);

  const appliedJobIds = useMemo(() => new Set(applications.map((application) => application.job_id)), [applications]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const search = searchTerm.trim().toLowerCase();
      const skillSearch = skillFilter.trim().toLowerCase();

      const matchesSearch =
        !search ||
        job.title.toLowerCase().includes(search) ||
        job.description.toLowerCase().includes(search) ||
        job.postedBy.toLowerCase().includes(search);

      const matchesExperience = !experienceFilter || job.experienceNumeric >= Number(experienceFilter);

      const matchesSkills =
        !skillSearch ||
        job.skills.some((skill) => skill.toLowerCase().includes(skillSearch)) ||
        job.optionalSkills.some((skill) => skill.toLowerCase().includes(skillSearch));

      const matchesRole = user.role === 'recruiter' ? job.postedBy === user.username : true;

      return matchesSearch && matchesExperience && matchesSkills && matchesRole;
    });
  }, [experienceFilter, jobs, searchTerm, skillFilter, user]);

  const handleApply = async (job) => {
    if (!resume?.resume_id) {
      setError('Upload a resume from the candidate dashboard or resume lab before applying.');
      return;
    }

    setMessage('');
    setError('');

    try {
      await apiRequest(`/jobs/apply/${job.id}?resume_id=${resume.resume_id}`, {
        method: 'POST',
        headers: authHeaders(token, { 'Content-Type': 'application/json' }),
      });
      setApplications((current) => current.concat({ job_id: job.id, status: 'pending' }));
      setMessage(`Applied to ${job.title}.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <section className="glass-panel p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="badge border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
              {user.role === 'recruiter' ? 'Recruiter View' : 'Candidate View'}
            </p>
            <h1 className="mt-4 text-4xl font-bold text-white">Job board</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
              {user.role === 'recruiter'
                ? 'Review the roles you have already published and the skill requirements extracted from each posting.'
                : 'Search current openings, inspect required skills, and apply directly with your uploaded resume.'}
            </p>
          </div>
          <p className="text-sm text-slate-400">{loading ? 'Loading jobs...' : `${filteredJobs.length} jobs shown`}</p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-[1.5fr_0.7fr_0.8fr]">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="field"
            placeholder="Search by title, description, or recruiter"
          />
          <select className="field" value={experienceFilter} onChange={(event) => setExperienceFilter(event.target.value)}>
            <option value="">Any experience level</option>
            <option value="1">1+ years</option>
            <option value="2">2+ years</option>
            <option value="3">3+ years</option>
            <option value="5">5+ years</option>
          </select>
          <input
            type="text"
            value={skillFilter}
            onChange={(event) => setSkillFilter(event.target.value)}
            className="field"
            placeholder="Filter by skill"
          />
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

        <div className="mt-8 grid gap-5 xl:grid-cols-2">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onApply={user.role === 'candidate' ? handleApply : null}
              applied={appliedJobIds.has(job.id)}
              disabled={user.role === 'candidate' && !resume?.resume_id}
              actionLabel={user.role === 'candidate' ? 'Apply to role' : undefined}
              footer={
                user.role === 'recruiter' ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    Mandatory skills: {job.skills.length}. Optional skills: {job.optionalSkills.length}.
                  </div>
                ) : null
              }
            />
          ))}
        </div>

        {!loading && filteredJobs.length === 0 && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
            No jobs matched your filters.
          </div>
        )}
      </section>
    </main>
  );
};

export default JobListing;
