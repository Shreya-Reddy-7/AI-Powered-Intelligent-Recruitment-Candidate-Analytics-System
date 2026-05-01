import React from 'react';

const JobCard = ({ job, onApply, applied, actionLabel = 'Apply', disabled = false, footer }) => {
  const matchScore = typeof job.matchPercentage === 'number' ? job.matchPercentage : null;

  return (
    <article className="glass-panel p-6 transition duration-200 hover:-translate-y-1 hover:border-cyan-300/20">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{job.postedBy || 'Recruiter post'}</p>
            <h3 className="mt-2 text-2xl font-bold text-white">{job.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{job.description}</p>
          </div>
          {matchScore !== null && (
            <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-right">
              <p className="text-2xl font-bold text-emerald-200">{matchScore}%</p>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/80">Match</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-slate-200">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
            Experience: {job.experience || 'Not specified'}
          </span>
          {job.optionalSkills?.length > 0 && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
              Bonus skills: {job.optionalSkills.length}
            </span>
          )}
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
            Job ID: {job.id}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {(job.skills || []).map((skill) => (
            <span key={skill} className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
              {skill}
            </span>
          ))}
        </div>

        {footer}

        {onApply && (
          <button type="button" onClick={() => onApply(job)} className="primary-button w-full" disabled={disabled || applied}>
            {applied ? 'Already applied' : actionLabel}
          </button>
        )}
      </div>
    </article>
  );
};

export default JobCard;
