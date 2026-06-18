import { useState } from 'react';
import { ArrowRight, Lock, Mail, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { login, verifyTwoFactorLogin } = useAuth();
  const [form, setForm] = useState({ email: 'admin@wsiportal.com', password: 'password' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [challengeId, setChallengeId] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);

  const attemptLogin = async (payload) => {
    const result = requiresTwoFactor
      ? await verifyTwoFactorLogin({ ...payload, role: 'admin', challengeId, twoFactorCode })
      : await login({ ...payload, role: 'admin' });

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

    navigate('/admin');
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    setIsSubmitting(true);
    await attemptLogin(form);
    setIsSubmitting(false);
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-slate-950 shadow-2xl shadow-slate-950/10 lg:p-9">

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-sky-700">
          <ShieldCheck size={14} /> Admin login
        </div>
        <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">Access the Operations Console</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Use admin credentials below.</p>

        <div className="mt-7 flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          <span className="h-px flex-1 bg-slate-200" />
          <span>Sign in with email</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-bold text-slate-700">
            Email
            <div className="relative mt-2">
              <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-11 text-sm text-slate-950 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </div>
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Password
            <div className="relative mt-2">
              <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 pl-11 text-sm text-slate-950 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
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
            {isSubmitting ? 'Entering...' : requiresTwoFactor ? 'Verify & enter' : 'Enter admin portal'} {!isSubmitting ? <ArrowRight size={16} /> : null}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-600">
          <Link to="/auth/login" className="font-bold text-sky-700 hover:text-sky-600">Back to Customer Login</Link>
        </div>
      </div>
    </div>
  );
}
