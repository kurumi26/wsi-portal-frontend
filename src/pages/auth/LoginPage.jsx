import { useState } from 'react';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.6 14.5 2.7 12 2.7 6.9 2.7 2.8 6.9 2.8 12S6.9 21.3 12 21.3c6.9 0 8.6-4.8 8.6-7.3 0-.5 0-.8-.1-1.2H12Z" />
      <path fill="#34A853" d="M2.8 7.3l3.2 2.3c.9-2.6 3.3-4.5 6-4.5 1.8 0 3 .8 3.7 1.5l2.5-2.4C16.6 3.6 14.5 2.7 12 2.7 8.4 2.7 5.3 4.8 3.8 7.9Z" />
      <path fill="#FBBC05" d="M12 21.3c2.4 0 4.5-.8 6-2.3l-2.8-2.2c-.8.5-1.8.9-3.2.9-3.8 0-5.1-2.6-5.4-3.8l-3.3 2.5c1.5 3.1 4.7 4.9 8.7 4.9Z" />
      <path fill="#4285F4" d="M20.6 12.8H12v-3.9h8.4c.1.4.2.8.2 1.3 0 .5-.1 1-.1 1.4Z" />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, verifyTwoFactorLogin } = useAuth();
  const [form, setForm] = useState({ email: 'customer@wsiportal.com', password: 'password' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);

  const attemptLogin = async (payload) => {
    const result = requiresTwoFactor
      ? await verifyTwoFactorLogin({ ...payload, role: 'customer', challengeId, twoFactorCode })
      : await login({ ...payload, role: 'customer' });

    if (!result.success) {
      if (result.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setChallengeId(result.challengeId);
        setDemoCode(result.demoCode ?? '');
        setError(result.message);
        return false;
      }

      setError(result.message);
      return false;
    }

    const returnTo = typeof location.state?.returnTo === 'string' ? location.state.returnTo : '/dashboard';
    navigate(returnTo);
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.email || !form.password) {
      setError('Email and password are required.');
      return;
    }

    setIsSubmitting(true);
    await attemptLogin(form);
    setIsSubmitting(false);
  };

  const handleSocialDemoLogin = async () => {
    setError('');
    setForm({ email: 'customer@wsiportal.com', password: 'password' });
    setIsSubmitting(true);
    await attemptLogin({ email: 'customer@wsiportal.com', password: 'password' });
    setIsSubmitting(false);
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-slate-950 shadow-2xl shadow-slate-950/10 lg:p-9">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-sky-700">
          <ShieldCheck size={14} /> Customer login
        </div>
        <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">Sign in to your Portal</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Continue checkout, review contracts, and manage your WSI services.</p>

        <div className="mt-7 space-y-3">
          <button type="button" onClick={handleSocialDemoLogin} className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50">
            <span className="facebook-icon-mark flex h-6 w-6 items-center justify-center rounded-full text-sm font-black">f</span>
            Continue with Facebook
          </button>
          <button type="button" onClick={handleSocialDemoLogin} className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50">
            <GoogleIcon />
            Continue with Google
          </button>
          <a href="#customer-email-login" className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50">
            <Mail size={18} />
            Continue with Email
          </a>
        </div>

        <form id="customer-email-login" className="mt-7 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-bold text-slate-700">
            Email
            <div className="relative mt-2">
              <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-11 text-sm text-slate-950 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Password
            <div className="relative mt-2">
              <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-11 text-sm text-slate-950 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              />
            </div>
          </label>

          {requiresTwoFactor ? (
            <label className="block text-sm font-bold text-slate-700">
              Verification Code
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                placeholder="Enter 6-digit code"
              />
              {demoCode ? <span className="mt-2 block text-xs font-bold text-sky-700">Demo code: {demoCode}</span> : null}
            </label>
          ) : null}

          {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}

          <button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 force-white">
            {isSubmitting ? 'Signing in...' : requiresTwoFactor ? 'Verify & sign in' : 'Sign in'} {!isSubmitting ? <ArrowRight size={16} /> : null}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-sm text-slate-600">
          <Link to="/auth/register" state={location.state} className="font-bold text-sky-700 hover:text-sky-600">New user? Create an account</Link>
          <Link to="/auth/admin" className="font-bold text-slate-950 hover:text-sky-700">Admin Login</Link>
        </div>
      </div>
    </div>
  );
}
