import React from 'react';

const insightLabel = {
  Gold: 'text-amber-200 border-amber-300/20 bg-amber-300/10',
  Silver: 'text-slate-100 border-slate-300/20 bg-slate-300/10',
  Bronze: 'text-orange-200 border-orange-300/20 bg-orange-300/10',
  Participant: 'text-cyan-100 border-cyan-300/20 bg-cyan-300/10',
};

const CandidateCard = ({ candidate, onStatusChange, showActions = false, status }) => {
  return (
    <article className="glass-panel p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Candidate</p>
            <h3 className="mt-2 text-2xl font-bold text-white">{candidate.username}</h3>
            <p className="mt-2 text-sm text-slate-300">Resume ID: {candidate.resume_id}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-emerald-200">{candidate.score?.toFixed?.(1) ?? candidate.score}</p>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Total score</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-sm text-slate-200">
          <span className={`rounded-full border px-3 py-2 ${insightLabel[candidate.badge] || insightLabel.Participant}`}>
            {candidate.badge || 'Candidate'}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
            Match: {candidate.match_percentage}%
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">
            Experience: {candidate.experience_years} years
          </span>
          {status && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 capitalize">
              Status: {status}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {(candidate.matched_skills || []).map((skill) => (
            <span key={skill} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-sm text-emerald-100">
              {skill}
            </span>
          ))}
        </div>

        {candidate.analysis && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100">
              {candidate.analysis.verdict || 'Assessment'}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">{candidate.analysis.summary}</p>
            {candidate.analysis.selection_reason && (
              <p className="mt-3 text-sm text-slate-400">Why this candidate: {candidate.analysis.selection_reason}</p>
            )}
          </div>
        )}

        {showActions && (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => onStatusChange(candidate.application_id, 'shortlisted')} className="primary-button flex-1">
              Shortlist
            </button>
            <button type="button" onClick={() => onStatusChange(candidate.application_id, 'rejected')} className="secondary-button flex-1">
              Reject
            </button>
          </div>
        )}
      </div>
    </article>
  );
};

export default CandidateCard;
