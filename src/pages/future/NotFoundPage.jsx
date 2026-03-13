import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel max-w-xl p-10 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-orange-300">404</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Page not found</h1>
        <p className="mt-4 text-sm leading-7 text-slate-400">The requested page does not exist in the current WSI portal routing map.</p>
        <Link to="/auth/login" className="btn-primary mt-6 inline-flex">Return to portal</Link>
      </div>
    </div>
  );
}
