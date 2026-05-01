import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest, authHeaders } from '../lib/api';

const statusTheme = {
  pending: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
  shortlisted: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
  rejected: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
};

const ApplicationTracker = ({ token }) => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadApplications() {
      setLoading(true);
      setError('');

      try {
        const response = await apiRequest('/jobs/applications/me', { headers: authHeaders(token) });
        if (!ignore) {
          setApplications(response.applications || []);
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

    loadApplications();

    return () => {
      ignore = true;
    };
  }, [token]);

  const groupedApplications = useMemo(
    () => ({
      pending: applications.filter((application) => application.status === 'pending'),
      shortlisted: applications.filter((application) => application.status === 'shortlisted'),
      rejected: applications.filter((application) => application.status === 'rejected'),
    }),
    [applications]
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
      <section className="glass-panel p-6 md:p-8">
        <p className="badge border-cyan-300/20 bg-cyan-300/10 text-cyan-100">Candidate Pipeline</p>
        <h1 className="mt-4 text-4xl font-bold text-white">Application tracker</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">
          Follow every application from submission to recruiter decision. Pending means waiting for review, shortlisted
          marks progress, and rejected closes the application.
        </p>

        {error && (
          <div className="mt-6 rounded-3xl border border-rose-300/20 bg-rose-300/10 px-5 py-4 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {['pending', 'shortlisted', 'rejected'].map((status) => (
            <div key={status} className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold capitalize text-white">{status}</h2>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${statusTheme[status]}`}>
                  {groupedApplications[status].length}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {loading ? (
                  <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">Loading...</div>
                ) : groupedApplications[status].length > 0 ? (
                  groupedApplications[status].map((application) => (
                    <div key={application.application_id} className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                      <p className="text-lg font-semibold text-white">{application.job_title}</p>
                      <p className="mt-2 text-sm text-slate-300">Application ID: {application.application_id}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Submitted: {new Date(application.application_date).toLocaleDateString()}
                      </p>
                      <p className="mt-4 text-sm capitalize text-slate-200">Current state: {application.status}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-4 text-sm text-slate-300">
                    No applications in this stage.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

export default ApplicationTracker;
