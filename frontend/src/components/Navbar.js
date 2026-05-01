import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const navItemClass = (active) =>
  `rounded-full px-4 py-2 text-sm font-medium transition ${
    active ? 'bg-cyan-300 text-slate-950' : 'text-slate-300 hover:bg-white/5 hover:text-white'
  }`;

const Navbar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const candidateLinks = [
    { to: '/candidate-dashboard', label: 'Dashboard' },
    { to: '/jobs', label: 'Explore Jobs' },
    { to: '/applications', label: 'Applications' },
    { to: '/resume-analyzer', label: 'Resume Lab' },
  ];

  const recruiterLinks = [
    { to: '/recruiter-dashboard', label: 'Dashboard' },
    { to: '/jobs', label: 'Job Board' },
  ];

  const links = user?.role === 'recruiter' ? recruiterLinks : candidateLinks;

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link to={user ? (user.role === 'recruiter' ? '/recruiter-dashboard' : '/candidate-dashboard') : '/'} className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300 text-lg font-bold text-slate-950">
              GR
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">Genesis Recruit</p>
              <p className="text-lg font-semibold text-white">AI Candidate Analysis</p>
            </div>
          </Link>
          {user && (
            <span className="badge border-cyan-300/20 bg-cyan-300/10 text-cyan-100 md:hidden">
              {user.role}
            </span>
          )}
        </div>

        {user ? (
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <nav className="flex flex-wrap gap-2">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={navItemClass(location.pathname === link.to)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2">
              <div className="hidden text-right md:block">
                <p className="text-sm font-semibold text-white">{user.username}</p>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{user.role}</p>
              </div>
              <button type="button" onClick={handleLogout} className="secondary-button !rounded-full !px-4 !py-2">
                Logout
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Link to="/" className={navItemClass(location.pathname === '/')}>
              Login
            </Link>
            <Link to="/signup" className="primary-button !rounded-full !px-4 !py-2">
              Create account
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
