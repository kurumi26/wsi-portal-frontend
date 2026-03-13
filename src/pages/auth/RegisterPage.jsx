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

export default function RegisterPage() {
  const navigate = useNavigate();
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

    navigate('/dashboard');
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
    <div className="panel relative overflow-hidden p-8 lg:p-9">
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-sky-400/10 via-white/0 to-orange-400/10" />

      <div className="relative">
        <p className="text-sm uppercase tracking-[0.2em] text-orange-300">New User Registration</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Create your customer portal access</h2>
        <p className="mt-3 text-sm text-slate-400">Submit your full account details. Your registration will be reviewed by the admin before sign in is enabled.</p>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition hover:border-sky-300/30 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white">
              <GoogleIcon />
            </span>
            <span>Create account with Google</span>
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-500">
          <span className="h-px flex-1 bg-white/10" />
          <span>Or register manually</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-300 md:col-span-2">
          Full Name
          <input className="input mt-2" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <label className="block text-sm text-slate-300">
          Company
          <input className="input mt-2" value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} />
        </label>
        <label className="block text-sm text-slate-300">
          Mobile Number
          <input className="input mt-2" value={form.mobileNumber} onChange={(event) => setForm((current) => ({ ...current, mobileNumber: event.target.value }))} placeholder="+63 912 345 6789" />
        </label>
        <label className="block text-sm text-slate-300 md:col-span-2">
          Address
          <input className="input mt-2" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Street, city, province, country" />
        </label>
        <label className="block text-sm text-slate-300">
          Email
          <input type="email" className="input mt-2" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
        </label>
        <label className="block text-sm text-slate-300">
          Profile Picture URL (optional)
          <input className="input mt-2" value={form.profilePhotoUrl} onChange={(event) => setForm((current) => ({ ...current, profilePhotoUrl: event.target.value }))} placeholder="https://example.com/photo.jpg" />
        </label>
        <label className="block text-sm text-slate-300 md:col-span-2">
          Password
          <input type="password" className="input mt-2" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
        </label>
        <label className="block text-sm text-slate-300 md:col-span-2">
          Confirm Password
          <input type="password" className="input mt-2" value={form.passwordConfirmation} onChange={(event) => setForm((current) => ({ ...current, passwordConfirmation: event.target.value }))} />
        </label>

        {error ? <p className="rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-sm text-orange-100 md:col-span-2">{error}</p> : null}
        {message ? <p className="rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm text-sky-100 md:col-span-2">{message}</p> : null}

          <button type="submit" disabled={isSubmitting} className="btn-primary gap-2 md:col-span-2 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? 'Submitting registration...' : 'Create account'} {!isSubmitting ? <ArrowRight size={16} /> : null}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-400">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="mt-0.5 text-sky-300" />
            <div>
              <p className="font-medium text-white">Approval notice</p>
              <p className="mt-1">After registration, the admin will review your account in Clients. Approval or rejection updates will be sent to your registered email.</p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-sm text-slate-400">
          Already registered? <Link to="/auth/login" className="text-sky-300 hover:text-sky-200">Return to login</Link>
        </div>
      </div>
    </div>
  );
}
