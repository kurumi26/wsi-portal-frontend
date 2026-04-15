import { Navigate, Route, Routes } from 'react-router-dom';
import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './layouts/AdminLayout';
import PortalLayout from './layouts/PortalLayout';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import AdminLoginPage from './pages/auth/AdminLoginPage';
import AboutPage from './pages/AboutPage';
import CustomerDashboardPage from './pages/dashboard/CustomerDashboardPage';
import MyServicesPage from './pages/dashboard/MyServicesPage';
import BillingPage from './pages/dashboard/BillingPage';
import AccountProfilePage from './pages/dashboard/AccountProfilePage';
import OrderHistoryPage from './pages/dashboard/OrderHistoryPage';
import ServicesPage from './pages/services/ServicesPage';
import CheckoutPage from './pages/checkout/CheckoutPage';
import NotificationsPage from './pages/dashboard/NotificationsPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import ClientsPage from './pages/admin/ClientsPage';
import ManageServicesPage from './pages/admin/ManageServicesPage';
import ApprovalsPage from './pages/admin/ApprovalsPage';
import ClientServicesPage from './pages/admin/ClientServicesPage';
import PurchasesPage from './pages/admin/PurchasesPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';
import UsersPage from './pages/admin/UsersPage';
import AdminAccountPage from './pages/admin/AdminAccountPage';
import PhaseTwoPage from './pages/future/PhaseTwoPage';
import NotFoundPage from './pages/future/NotFoundPage';

function ProtectedRoute({ children, adminOnly = false }) {
  const { isAuthenticated, isAdmin, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-300">Loading portal session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isAdmin, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-300">Loading portal session...</div>;
  }

  if (!isAuthenticated) {
    return children;
  }

  return <Navigate to={isAdmin ? '/admin' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to="/auth/login" replace />}
      />

      <Route element={<PublicOnlyRoute><AuthLayout /></PublicOnlyRoute>}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/auth/admin" element={<AdminLoginPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <PortalLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<CustomerDashboardPage />} />
        <Route path="/dashboard/services" element={<MyServicesPage />} />
        <Route path="/dashboard/billing" element={<BillingPage />} />
        <Route path="/dashboard/account" element={<AccountProfilePage />} />
        <Route path="/dashboard/orders" element={<OrderHistoryPage />} />
        <Route path="/dashboard/notifications" element={<NotificationsPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/contracts" element={<PhaseTwoPage moduleName="Contract & Agreement System" />} />
        <Route path="/support" element={<PhaseTwoPage moduleName="Support & Helpdesk" />} />
      </Route>

      <Route
        element={
          <ProtectedRoute adminOnly>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/clients" element={<ClientsPage />} />
        <Route path="/admin/users" element={<UsersPage />} />
        <Route path="/admin/services" element={<ManageServicesPage />} />
        <Route path="/admin/approvals" element={<ApprovalsPage />} />
        <Route path="/admin/client-services" element={<ClientServicesPage />} />
        <Route path="/admin/purchases" element={<PurchasesPage />} />
        <Route path="/admin/notifications" element={<AdminNotificationsPage />} />
        <Route path="/admin/account" element={<AdminAccountPage />} />
        <Route path="/admin/reports" element={<PhaseTwoPage moduleName="Admin Reports Center" />} />
        <Route path="/admin/user-management" element={<Navigate to="/admin/users" replace />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
