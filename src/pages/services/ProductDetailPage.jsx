import { Navigate, useParams } from 'react-router-dom';

/** Redirect legacy product URLs to inline plans on browse products. */
export default function ProductDetailPage() {
  const { serviceId } = useParams();
  return <Navigate to={`/services?plan=${serviceId}`} replace />;
}
