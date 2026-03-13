import { Link } from 'react-router-dom';

export default function AboutPage() {
  return (
    <div className="panel relative overflow-hidden p-8 lg:p-12">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold text-white md:text-4xl">About WSI Portal</h1>
        <p className="mt-4 text-slate-300">WSI Portal is a lightweight operations and billing portal built to demonstrate service provisioning, invoicing, and customer workflows. This demo includes basic account management, billing, and provisioning flows for testing and development.</p>

        <div className="mt-8">
          <Link to="/auth/login" className="btn-primary rounded-full px-4 py-2">Return to portal</Link>
        </div>
      </div>
    </div>
  );
}
