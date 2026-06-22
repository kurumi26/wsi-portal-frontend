import { Navigate, useSearchParams } from 'react-router-dom';

/** Legacy route — redirects to inline results on the domains page. */
export default function DomainAvailabilityPage() {
  const [searchParams] = useSearchParams();
  const domain = searchParams.get('domain') || 'my-business.com';

  return <Navigate to={`/domains?domain=${encodeURIComponent(domain)}`} replace />;
}
