import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import CandidateDashboard from './pages/CandidateDashboard';
import RecruiterDashboard from './pages/RecruiterDashboard';
import JobListing from './pages/JobListing';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import ApplicationTracker from './pages/ApplicationTracker';
import { API_BASE_URL } from './lib/api';

const getStoredToken = () => localStorage.getItem('token');

async function fetchCurrentUser(token) {
  const response = await fetch(`${API_BASE_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Session expired');
  }

  return response.json();
}

function ProtectedRoute({ user, loading, children, allowedRole }) {
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="rounded-3xl border border-white/10 bg-slate-950/60 px-6 py-4 text-sm text-slate-200 shadow-2xl backdrop-blur">
          Loading workspace...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'recruiter' ? '/recruiter-dashboard' : '/candidate-dashboard'} replace />;
  }

  return children;
}

function App() {
  const [authState, setAuthState] = useState({
    token: getStoredToken(),
    user: null,
    loading: true,
  });

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      const token = getStoredToken();

      if (!token) {
        if (isMounted) {
          setAuthState({ token: null, user: null, loading: false });
        }
        return;
      }

      try {
        const user = await fetchCurrentUser(token);
        if (isMounted) {
          setAuthState({ token, user, loading: false });
        }
      } catch (error) {
        localStorage.removeItem('token');
        if (isMounted) {
          setAuthState({ token: null, user: null, loading: false });
        }
      }
    }

    hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAuthenticated = async (token) => {
    localStorage.setItem('token', token);
    const user = await fetchCurrentUser(token);
    setAuthState({ token, user, loading: false });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setAuthState({ token: null, user: null, loading: false });
  };

  return (
    <Router>
      <div className="min-h-screen bg-app text-slate-100">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute left-[8%] top-[-8rem] h-80 w-80 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute right-[6%] top-24 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
          <div className="absolute bottom-[-10rem] left-1/3 h-96 w-96 rounded-full bg-amber-300/10 blur-3xl" />
        </div>
        <div className="relative">
          <Navbar user={authState.user} onLogout={handleLogout} />
          <Routes>
            <Route
              path="/"
              element={
                authState.user ? (
                  <Navigate
                    to={authState.user.role === 'recruiter' ? '/recruiter-dashboard' : '/candidate-dashboard'}
                    replace
                  />
                ) : (
                  <Login onAuthenticated={handleAuthenticated} />
                )
              }
            />
            <Route
              path="/signup"
              element={
                authState.user ? (
                  <Navigate
                    to={authState.user.role === 'recruiter' ? '/recruiter-dashboard' : '/candidate-dashboard'}
                    replace
                  />
                ) : (
                  <Signup onAuthenticated={handleAuthenticated} />
                )
              }
            />
            <Route
              path="/candidate-dashboard"
              element={
                <ProtectedRoute user={authState.user} loading={authState.loading} allowedRole="candidate">
                  <CandidateDashboard user={authState.user} token={authState.token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiter-dashboard"
              element={
                <ProtectedRoute user={authState.user} loading={authState.loading} allowedRole="recruiter">
                  <RecruiterDashboard user={authState.user} token={authState.token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs"
              element={
                <ProtectedRoute user={authState.user} loading={authState.loading}>
                  <JobListing user={authState.user} token={authState.token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resume-analyzer"
              element={
                <ProtectedRoute user={authState.user} loading={authState.loading} allowedRole="candidate">
                  <ResumeAnalyzer token={authState.token} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applications"
              element={
                <ProtectedRoute user={authState.user} loading={authState.loading} allowedRole="candidate">
                  <ApplicationTracker token={authState.token} />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
