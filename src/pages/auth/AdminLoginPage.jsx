import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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

  const handleSocialDemoLogin = async () => {
    setError('');
    setForm({ email: 'admin@wsiportal.com', password: 'password' });
    setIsSubmitting(true);
    await attemptLogin({ email: 'admin@wsiportal.com', password: 'password' });
    setIsSubmitting(false);
  };

  return (
    <div className="panel auth-panel relative overflow-hidden p-8 lg:p-9">

      <div className="relative">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-orange-300">
          Admin login
        </div>
        <h2 className="mt-4 text-3xl font-semibold text-white">Access the Operations Console</h2>
        <p className="mt-3 text-sm leading-6 text-slate-400">Use admin credentials or continue with Google below.</p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleSocialDemoLogin}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-sky-300/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white">
              <GoogleIcon />
            </span>
            <span>Continue with Google</span>
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          <span>Or sign in with email</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-300">
            Email
            <input className="input mt-2" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label className="block text-sm text-slate-300">
            Password
            <input className="input mt-2" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
          </label>

          {requiresTwoFactor ? (
            <label className="block text-sm text-slate-300">
              Verification Code
              <input
                className="input mt-2"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
                placeholder="Enter 6-digit code"
              />
              {demoCode ? <span className="mt-2 block text-xs text-sky-300">Demo code: {demoCode}</span> : null}
            </label>
          ) : null}

          {error ? <p className="rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">{error}</p> : null}

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full gap-2 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? 'Entering...' : requiresTwoFactor ? 'Verify & enter' : 'Enter admin portal'} {!isSubmitting ? <ArrowRight size={16} /> : null}
          </button>
        </form>



        <div className="mt-6 text-sm text-slate-400">
          <Link to="/auth/login" className="hover:text-white">Back to Customer Login</Link>
        </div>
      </div>
    </div>
  );
}
