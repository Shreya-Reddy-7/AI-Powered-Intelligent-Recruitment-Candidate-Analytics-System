import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../lib/api';

const initialForm = {
  username: '',
  email: '',
  password: '',
  role: 'candidate',
};

const Signup = ({ onAuthenticated }) => {
  const [formData, setFormData] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const registerResponse = await fetch(`${API_BASE_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      const registerData = await registerResponse.json();

      if (!registerResponse.ok) {
        throw new Error(registerData.detail || 'Signup failed');
      }

      const loginResponse = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: formData.username,
          password: formData.password,
        }),
      });
      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        throw new Error(loginData.detail || 'Login failed after signup');
      }

      await onAuthenticated(loginData.access_token);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl gap-10 px-4 py-8 md:grid-cols-[0.92fr_1.08fr] md:px-6 md:py-12">
      <section className="glass-panel flex items-center p-6 md:p-8">
        <div className="w-full">
          <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Create account</p>
          <h1 className="mt-3 text-3xl font-bold text-white">Launch your recruitment workspace</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Candidates can upload resumes and track applications. Recruiters can create roles, rank applicants,
            and manage shortlist decisions.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Username</label>
              <input
                type="text"
                required
                className="field"
                value={formData.username}
                onChange={(event) => setFormData((current) => ({ ...current, username: event.target.value }))}
                placeholder="talent.admin"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Email</label>
              <input
                type="email"
                required
                className="field"
                value={formData.email}
                onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                placeholder="name@company.com"
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
                placeholder="At least 3 characters"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">Role</label>
              <select
                className="field"
                value={formData.role}
                onChange={(event) => setFormData((current) => ({ ...current, role: event.target.value }))}
              >
                <option value="candidate">Candidate</option>
                <option value="recruiter">Recruiter</option>
              </select>
            </div>

            {error && (
              <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            )}

            <button type="submit" className="primary-button w-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-400">
            Already registered?{' '}
            <Link to="/" className="font-semibold text-cyan-200 hover:text-cyan-100">
              Sign in
            </Link>
          </p>
        </div>
      </section>

      <section className="flex flex-col justify-center">
        <p className="badge max-w-max border-emerald-300/20 bg-emerald-300/10 text-emerald-100">Feature Coverage</p>
        <h2 className="mt-6 max-w-2xl text-5xl font-bold leading-tight text-white">
          Built around the backend workflows already shipped in FastAPI.
        </h2>
        <div className="mt-8 grid gap-4">
          {[
            'JWT login and role-aware routing',
            'Resume parsing with AI analysis',
            'Job posting and applied-candidate ranking',
            'Shortlist and rejection management',
            'Candidate application status tracking',
          ].map((item) => (
            <div key={item} className="glass-panel p-5">
              <p className="text-base font-medium text-slate-100">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Signup;
