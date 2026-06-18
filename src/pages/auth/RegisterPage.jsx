import { useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
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

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: '',
    company: '',
    address: '',
    mobileNumber: '',
    email: '',
    password: '',
    passwordConfirmation: '',
    profilePhotoUrl: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultGoogleSignup = {
    name: 'Google Demo User',
    company: 'WSI New Client',
    address: 'Davao City, Davao del Sur, Philippines',
    mobileNumber: '+63 912 000 1111',
    email: `google.demo.${Date.now()}@wsiportal.com`,
    password: 'password123',
    passwordConfirmation: 'password123',
    profilePhotoUrl: '',
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if ([form.name, form.company, form.address, form.mobileNumber, form.email, form.password, form.passwordConfirmation].some((value) => !value.trim())) {
      setError('Please complete all required registration details.');
      return;
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (form.password !== form.passwordConfirmation) {
      setError('Password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);
    const result = await register(form);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    if (result.pendingApproval) {
      setMessage(result.message);
      setForm({
        name: '',
        company: '',
        address: '',
        mobileNumber: '',
        email: '',
        password: '',
        passwordConfirmation: '',
        profilePhotoUrl: '',
      });
      return;
    }

    const returnTo = typeof location.state?.returnTo === 'string' ? location.state.returnTo : '/dashboard';
    navigate(returnTo);
  };

  const handleGoogleSignup = async () => {
    setError('');
    setMessage('');
    setForm(defaultGoogleSignup);
    setIsSubmitting(true);
    const result = await register(defaultGoogleSignup);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setMessage(result.message);
  };

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-8 text-slate-950 shadow-2xl shadow-slate-950/10 lg:p-9">

      <div className="relative">
        <p className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-sky-700">
          <ShieldCheck size={14} /> Create account
        </p>
        <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-950">Create your customer portal access</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">Submit your account details. Your registration will be reviewed by the admin before sign in is enabled.</p>


        <div className="mt-6 space-y-3">
          <button type="button" onClick={handleGoogleSignup} className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50">
            <span className="facebook-icon-mark flex h-6 w-6 items-center justify-center rounded-full text-sm font-black">f</span>
            Continue with Facebook
          </button>
          <button type="button" onClick={handleGoogleSignup} className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50">
            <GoogleIcon />
            Continue with Google
          </button>
          <a href="#register-email-form" className="flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-slate-50">
            Continue with Email
          </a>
        </div>

        <div className="mt-6 flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          <span className="h-px flex-1 bg-slate-200" />
          <span>Register Here</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form id="register-email-form" className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block text-sm font-bold text-slate-700 md:col-span-2">
          Full Name
          <input className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <label className="block text-sm font-bold text-slate-700">
          Company
          <input className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100" value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} />
        </label>
        <label className="block text-sm font-bold text-slate-700">
          Mobile Number
          <input className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100" value={form.mobileNumber} onChange={(event) => setForm((current) => ({ ...current, mobileNumber: event.target.value }))} placeholder="+63 912 345 6789" />
        </label>
        <label className="block text-sm font-bold text-slate-700 md:col-span-2">
          Address
          <input className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Street, city, province, country" />
        </label>
        <label className="block text-sm font-bold text-slate-700 md:col-span-2">
          Email
          <input type="email" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
        </label>
        <label className="block text-sm font-bold text-slate-700 md:col-span-2">
          Password
          <input type="password" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
        </label>
        <label className="block text-sm font-bold text-slate-700 md:col-span-2">
          Confirm Password
          <input type="password" className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100" value={form.passwordConfirmation} onChange={(event) => setForm((current) => ({ ...current, passwordConfirmation: event.target.value }))} />
        </label>

        {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 md:col-span-2">{error}</p> : null}
        {message ? <p className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-700 md:col-span-2">{message}</p> : null}

          <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 md:col-span-2 disabled:cursor-not-allowed disabled:opacity-60 force-white">
            {isSubmitting ? 'Submitting registration...' : 'Create account'} {!isSubmitting ? <ArrowRight size={16} /> : null}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 text-sky-700" />
            <div>
              <p className="font-black text-slate-950">Approval notice</p>
              <p className="mt-1">After registration, the admin will review your account in Clients. Approval or rejection updates will be sent to your registered email.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm text-slate-600">
          Already registered? <Link to="/auth/login" state={location.state} className="font-bold text-sky-700 hover:text-sky-600">Return to login</Link>
        </div>
      </div>
    </div>
  );
}
