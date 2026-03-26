import { useEffect, useMemo, useState } from 'react';
import { KeyRound, LayoutGrid, List, PencilLine, Power, Search, UsersRound } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { usePortal } from '../../context/PortalContext';

const roleClasses = {
  Admin: 'bg-sky-300 text-white',
  'Technical Support': 'bg-sky-600 text-white',
  Sales: 'bg-orange-400 text-white',
};

const statusClasses = {
  Enabled: 'bg-emerald-400 text-white',
  Disabled: 'bg-rose-400 text-white',
};

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'technical_support', label: 'Technical Support' },
  { value: 'sales', label: 'Sales' },
];

export default function UsersPage() {
  const { adminUsers, updateAdminUser, resetAdminUserPassword, updateAdminUserStatus } = usePortal();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedEditUser, setSelectedEditUser] = useState(null);
  const [selectedPasswordUser, setSelectedPasswordUser] = useState(null);
  const [statusConfirmUser, setStatusConfirmUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'admin' });
  const [passwordForm, setPasswordForm] = useState({ password: '', passwordConfirmation: '' });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState('');
  const [usersSearch, setUsersSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [usersView, setUsersView] = useState('list');

  useEffect(() => {
    if (!selectedEditUser) {
      return;
    }

    setEditForm({
      name: selectedEditUser.name,
      email: selectedEditUser.email,
      role: selectedEditUser.roleKey,
    });
  }, [selectedEditUser]);

  const summary = useMemo(() => {
    const enabled = adminUsers.filter((user) => user.status === 'Enabled').length;
    const disabled = adminUsers.length - enabled;

    return {
      total: adminUsers.length,
      enabled,
      disabled,
    };
  }, [adminUsers]);

  const filteredUsers = useMemo(() => {
    return adminUsers.filter((user) => {
      const matchesSearch = [user.name, user.email, user.role]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(usersSearch.toLowerCase()));

      const matchesRole = roleFilter === 'All' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'All' || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [adminUsers, roleFilter, statusFilter, usersSearch]);

  const showMessage = (text) => {
    setError('');
    setMessage(text);
    window.setTimeout(() => {
      setMessage((current) => (current === text ? '' : current));
    }, 2500);
  };

  const handleUpdateDetails = (user) => {
    setError('');
    setMessage('');
    setSelectedEditUser(user);
  };

  const handleResetPassword = (user) => {
    setError('');
    setMessage('');
    setPasswordForm({ password: '', passwordConfirmation: '' });
    setSelectedPasswordUser(user);
  };

  const handleToggleStatus = (user) => {
    setStatusConfirmUser(user);
  };

  const handleConfirmToggleStatus = async () => {
    if (!statusConfirmUser) {
      return;
    }

    const nextStatus = statusConfirmUser.status === 'Enabled' ? 'Disabled' : 'Enabled';

    setError('');
    setMessage('');
    setTogglingUserId(statusConfirmUser.id);

    try {
      const response = await updateAdminUserStatus(statusConfirmUser.id, nextStatus === 'Enabled');
      showMessage(response.message);
      setStatusConfirmUser(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setTogglingUserId('');
    }
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();

    if (!selectedEditUser) {
      return;
    }

    setError('');
    setMessage('');
    setIsSavingEdit(true);

    try {
      const response = await updateAdminUser(selectedEditUser.id, editForm);
      showMessage(response.message);
      setSelectedEditUser(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    if (!selectedPasswordUser) {
      return;
    }

    if (passwordForm.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (passwordForm.password !== passwordForm.passwordConfirmation) {
      setError('Password confirmation does not match.');
      return;
    }

    setError('');
    setMessage('');
    setIsSavingPassword(true);

    try {
      const response = await resetAdminUserPassword(selectedPasswordUser.id, {
        password: passwordForm.password,
        password_confirmation: passwordForm.passwordConfirmation,
      });

      showMessage(response.message);
      setSelectedPasswordUser(null);
      setPasswordForm({ password: '', passwordConfirmation: '' });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div>
      {statusConfirmUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="panel w-full max-w-lg p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Confirm Action</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {statusConfirmUser.status === 'Enabled' ? 'Disable account' : 'Enable account'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setStatusConfirmUser(null)}
                className="btn-secondary px-4"
              >
                Close
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-slate-300">
                Are you sure you want to {statusConfirmUser.status === 'Enabled' ? 'disable' : 'enable'}{' '}
                <span className="font-semibold text-white">{statusConfirmUser.name}</span>?
              </p>
              <p className="mt-3 text-sm text-slate-400">
                {statusConfirmUser.status === 'Enabled'
                  ? 'This user will lose access to the admin portal until the account is enabled again.'
                  : 'This user will regain access to the admin portal immediately.'}
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setStatusConfirmUser(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleStatus}
                disabled={togglingUserId === statusConfirmUser.id}
                className={`btn-primary disabled:opacity-60 ${statusConfirmUser.status === 'Enabled' ? '!bg-rose-500 hover:!bg-rose-400' : ''}`}
              >
                {togglingUserId === statusConfirmUser.id
                  ? 'Saving...'
                  : statusConfirmUser.status === 'Enabled'
                    ? 'Disable Account'
                    : 'Enable Account'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PageHeader
        eyebrow="Admin Users"
        title="Users"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="panel-muted rounded-3xl p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total Users</p>
          <p className="mt-3 text-3xl font-semibold text-white">{summary.total}</p>
        </div>
        <div className="panel-muted rounded-3xl p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Enabled</p>
          <p className="mt-3 text-3xl font-semibold text-emerald-500">{summary.enabled}</p>
        </div>
        <div className="panel-muted rounded-3xl p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Disabled</p>
          <p className="mt-3 text-3xl font-semibold text-rose-500">{summary.disabled}</p>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-6 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">
          {message}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search users</span>
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={usersSearch}
              onChange={(event) => setUsersSearch(event.target.value)}
              placeholder="Search user, email, or role"
              className="input pl-11"
            />
          </label>

          <select className="input lg:w-48" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="All">All roles</option>
            <option value="Admin">Admin</option>
            <option value="Technical Support">Technical Support</option>
            <option value="Sales">Sales</option>
          </select>

          <select className="input lg:w-44" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All statuses</option>
            <option value="Enabled">Enabled</option>
            <option value="Disabled">Disabled</option>
          </select>
        </div>

        <div className="inline-flex items-center gap-2 self-end rounded-2xl border border-white/10 bg-slate-900/70 p-1">
          <button
            type="button"
            onClick={() => setUsersView('grid')}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${usersView === 'grid' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            aria-label="Grid view"
            title="Grid view"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            type="button"
            onClick={() => setUsersView('list')}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition ${usersView === 'list' ? 'bg-orange-400 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            aria-label="List view"
            title="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {usersView === 'list' ? (
        <div className="panel mt-6 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left">
              <thead className="bg-white/5 text-sm text-slate-400">
                <tr>
                  <th className="px-5 py-4 font-semibold text-white">User Details</th>
                  <th className="px-5 py-4 font-semibold text-white">Role</th>
                  <th className="px-5 py-4 font-semibold text-white">Status</th>
                  <th className="px-5 py-4 text-right font-semibold text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 bg-transparent text-sm text-slate-200">
                {filteredUsers.length ? filteredUsers.map((user) => {
                const statusActionLabel = user.status === 'Enabled' ? 'Disable Account' : 'Enable Account';
                const statusActionClass = user.status === 'Enabled'
                  ? 'bg-rose-400 text-white hover:bg-rose-500'
                  : 'bg-emerald-400 text-white hover:bg-emerald-500';

                return (
                  <tr key={user.id} className="hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                          <UsersRound size={18} />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{user.name}</p>
                          <p className="mt-1 text-sm text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${roleClasses[user.role] ?? 'border-white/10 bg-white/10 text-slate-100'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClasses[user.status] ?? 'border-white/10 bg-white/10 text-slate-100'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateDetails(user)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10 disabled:bg-white/10 disabled:border-white/6 disabled:text-slate-400 disabled:opacity-80"
                          title={`Update details for ${user.name}`}
                          aria-label={`Update details for ${user.name}`}
                        >
                          <PencilLine size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetPassword(user)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10 disabled:bg-white/10 disabled:border-white/6 disabled:text-slate-400 disabled:opacity-80"
                          title={`Reset password for ${user.name}`}
                          aria-label={`Reset password for ${user.name}`}
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(user)}
                          disabled={togglingUserId === user.id}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition disabled:bg-white/10 disabled:border-white/6 disabled:text-slate-400 disabled:opacity-80 ${statusActionClass}`}
                          title={`${statusActionLabel} for ${user.name}`}
                          aria-label={`${statusActionLabel} for ${user.name}`}
                        >
                          <Power size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
                }) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-slate-400">No users match the current search and filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : filteredUsers.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredUsers.map((user) => {
            const statusActionLabel = user.status === 'Enabled' ? 'Disable Account' : 'Enable Account';
            const statusActionClass = user.status === 'Enabled'
              ? 'bg-rose-400 text-white hover:bg-rose-500'
              : 'bg-emerald-400 text-white hover:bg-emerald-500';

            return (
              <div key={user.id} className="panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                      <UsersRound size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{user.name}</p>
                      <p className="mt-1 text-sm text-slate-400 break-all">{user.email}</p>
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClasses[user.status] ?? 'border-white/10 bg-white/10 text-slate-100'}`}>
                    {user.status}
                  </span>
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Role</p>
                  <p className="mt-2">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${roleClasses[user.role] ?? 'border-white/10 bg-white/10 text-slate-100'}`}>
                      {user.role}
                    </span>
                  </p>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateDetails(user)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10 disabled:bg-white/10 disabled:border-white/6 disabled:text-slate-400 disabled:opacity-80"
                    title={`Update details for ${user.name}`}
                    aria-label={`Update details for ${user.name}`}
                  >
                    <PencilLine size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResetPassword(user)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-100 transition hover:bg-white/10 disabled:bg-white/10 disabled:border-white/6 disabled:text-slate-400 disabled:opacity-80"
                    title={`Reset password for ${user.name}`}
                    aria-label={`Reset password for ${user.name}`}
                  >
                    <KeyRound size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(user)}
                    disabled={togglingUserId === user.id}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border transition disabled:bg-white/10 disabled:border-white/6 disabled:text-slate-400 disabled:opacity-80 ${statusActionClass}`}
                    title={`${statusActionLabel} for ${user.name}`}
                    aria-label={`${statusActionLabel} for ${user.name}`}
                  >
                    <Power size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel mt-6 px-5 py-12 text-center text-sm text-slate-400">No users match the current search and filters.</div>
      )}

      {selectedEditUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <form onSubmit={handleEditSubmit} className="panel w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Update Details</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedEditUser.name}</h2>
              </div>
              <button type="button" onClick={() => setSelectedEditUser(null)} className="btn-secondary px-4">Close</button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="block text-sm text-slate-300">
                Full Name
                <input
                  className="input mt-2"
                  value={editForm.name}
                  onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label className="block text-sm text-slate-300">
                Email
                <input
                  type="email"
                  className="input mt-2"
                  value={editForm.email}
                  onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                />
              </label>
              <label className="block text-sm text-slate-300">
                Role
                <select
                  className="input mt-2"
                  value={editForm.role}
                  onChange={(event) => setEditForm((current) => ({ ...current, role: event.target.value }))}
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setSelectedEditUser(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isSavingEdit} className="btn-primary disabled:opacity-60">
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {selectedPasswordUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <form onSubmit={handlePasswordSubmit} className="panel w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-300">Reset Password</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{selectedPasswordUser.name}</h2>
              </div>
              <button type="button" onClick={() => setSelectedPasswordUser(null)} className="btn-secondary px-4">Close</button>
            </div>

            <div className="mt-6 grid gap-4">
              <label className="block text-sm text-slate-300">
                New Password
                <input
                  type="password"
                  className="input mt-2"
                  value={passwordForm.password}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))}
                />
              </label>
              <label className="block text-sm text-slate-300">
                Confirm Password
                <input
                  type="password"
                  className="input mt-2"
                  value={passwordForm.passwordConfirmation}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, passwordConfirmation: event.target.value }))}
                />
              </label>
            </div>

            <p className="mt-4 text-sm text-slate-400">Saving a new password will sign this user out from any active sessions.</p>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setSelectedPasswordUser(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isSavingPassword} className="btn-primary disabled:opacity-60">
                {isSavingPassword ? 'Saving...' : 'Reset Password'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
