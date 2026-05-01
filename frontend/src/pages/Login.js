import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../lib/api';

const initialForm = {
  username: '',
  password: '',
};

const Login = ({ onAuthenticated }) => {
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      await onAuthenticated(data.access_token);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl gap-10 px-4 py-8 md:grid-cols-[1.1fr_0.9fr] md:px-6 md:py-12">
      <section className="flex flex-col justify-center">
        <p className="badge max-w-max border-cyan-300/20 bg-cyan-300/10 text-cyan-100">AI Recruitment System</p>
        <h1 className="mt-6 max-w-2xl text-5xl font-bold leading-tight text-white md:text-6xl">
          Recruit faster. Rank smarter. Keep every decision explainable.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          This frontend connects candidates and recruiters to resume parsing, job analysis, AI insights, candidate ranking,
          application tracking, and recruiter decision workflows in one live interface.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <div className="glass-panel p-5">
            <p className="text-3xl font-bold text-cyan-200">60%</p>
            <p className="mt-2 text-sm text-slate-300">Weighted skill score in the ranking engine</p>
          </div>
          <div className="glass-panel p-5">
            <p className="text-3xl font-bold text-emerald-200">Top 5</p>
            <p className="mt-2 text-sm text-slate-300">Recruiter ranking view with LLM-backed insights</p>
          </div>
          <div className="glass-panel p-5">
            <p className="text-3xl font-bold text-amber-200">Live</p>
            <p className="mt-2 text-sm text-slate-300">Resume upload, applications, shortlist and reject actions</p>
          </div>
        </div>
      </section>

      <section className="glass-panel flex items-center p-6 md:p-8">
        <div className="w-full">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Welcome back</p>
          <h2 className="mt-3 text-3xl font-bold text-white">Sign in to your workspace</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Use your username or email with the password you registered through the backend.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Username or email</label>
              <input
                type="text"
                required
                className="field"
                value={formData.username}
                onChange={(event) => setFormData((current) => ({ ...current, username: event.target.value }))}
                placeholder="jane.recruiter"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
              <input
                type="password"
                required
                className="field"
                value={formData.password}
                onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
                placeholder="Enter your password"
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            )}

            <button type="submit" className="primary-button w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Enter platform'}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-400">
            Need an account?{' '}
            <Link to="/signup" className="font-semibold text-cyan-200 hover:text-cyan-100">
              Create one here
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
};

export default Login;
