import { useEffect, useState } from 'react';
import { Building2, ImagePlus, LaptopMinimal, LockKeyhole, Mail, MapPin, Phone, Save, ShieldCheck, Trash2, UserCircle2 } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
// Pagination removed for active sessions (limit enforced to 5)
import UserAvatar from '../../components/common/UserAvatar';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export default function AdminAccountPage() {
  const { user, security, updateProfile, updatePassword, updateTwoFactor, revokeSession, revokeOtherSessions, loadSecuritySettings } = useAuth();

  const [profileForm, setProfileForm] = useState({ name: '', email: '', company: '', address: '', mobileNumber: '', profilePhotoUrl: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', newPasswordConfirmation: '' });
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingTwoFactor, setIsSavingTwoFactor] = useState(false);
  const [endingSessionId, setEndingSessionId] = useState('');
  const [isLoggingOutOthers, setIsLoggingOutOthers] = useState(false);
  // sessions pagination removed; we limit displayed sessions to SESSIONS_PER_PAGE

  const SESSIONS_PER_PAGE = 5;

  useEffect(() => {
    setProfileForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      company: user?.company ?? '',
      address: user?.address ?? '',
      mobileNumber: user?.mobileNumber ?? '',
      profilePhotoUrl: user?.profilePhotoUrl ?? '',
    });
  }, [user]);

  useEffect(() => {
    loadSecuritySettings();
  }, [loadSecuritySettings]);

  const { isDarkMode } = useTheme();

  // no-op: session page state removed

  const resizeImageFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 256;
        const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');

        if (!context) {
          reject(new Error('Image processing is not supported in this browser.'));
          return;
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };

      image.onerror = () => reject(new Error('Selected image could not be processed.'));
      image.src = String(reader.result ?? '');
    };

    reader.onerror = () => reject(new Error('Selected image could not be read.'));
    reader.readAsDataURL(file);
  });

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    setProfileError('');

    try {
      const optimizedImage = await resizeImageFile(file);
      setProfileForm((current) => ({ ...current, profilePhotoUrl: optimizedImage }));
    } catch (error) {
      setProfileError(error.message);
    }
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileError('');
    setProfileMessage('');

    if ([profileForm.name, profileForm.email, profileForm.company].some((value) => !value.trim())) {
      setProfileError('Name, email, and company are required.');
      return;
    }

    setIsSavingProfile(true);
    const result = await updateProfile(profileForm);
    setIsSavingProfile(false);

    if (!result.success) {
      setProfileError(result.message);
      return;
    }

    setProfileMessage(result.message);
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (Object.values(passwordForm).some((value) => !value.trim())) {
      setPasswordError('All password fields are required.');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.newPasswordConfirmation) {
      setPasswordError('New password confirmation does not match.');
      return;
    }

    setIsSavingPassword(true);
    const result = await updatePassword({
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
      newPassword_confirmation: passwordForm.newPasswordConfirmation,
    });
    setIsSavingPassword(false);

    if (!result.success) {
      setPasswordError(result.message);
      return;
    }

    setPasswordMessage(result.message);
    setPasswordForm({ currentPassword: '', newPassword: '', newPasswordConfirmation: '' });
  };

  const handleTwoFactorToggle = async () => {
    setSecurityError('');
    setSecurityMessage('');
    setIsSavingTwoFactor(true);

    const result = await updateTwoFactor(!security.twoFactorEnabled);

    setIsSavingTwoFactor(false);

    if (!result.success) {
      setSecurityError(result.message);
      return;
    }

    setSecurityMessage(result.message);
  };

  const handleEndSession = async (sessionId) => {
    setSecurityError('');
    setSecurityMessage('');
    setEndingSessionId(sessionId);

    const result = await revokeSession(sessionId);

    setEndingSessionId('');

    if (!result.success) {
      setSecurityError(result.message);
      return;
    }

    setSecurityMessage(result.message);
  };

  const handleLogoutOthers = async () => {
    setSecurityError('');
    setSecurityMessage('');
    setIsLoggingOutOthers(true);

    const result = await revokeOtherSessions();

    setIsLoggingOutOthers(false);

    if (!result.success) {
      setSecurityError(result.message);
      return;
    }

    setSecurityMessage(result.message);
  };

  const formatSessionTime = (value) => {
    if (!value) {
      return 'Recently active';
    }

    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  };

  const items = [
    { icon: UserCircle2, label: 'Admin Name', value: user?.name },
    { icon: Mail, label: 'Admin Email', value: user?.email },
    { icon: Building2, label: 'Department / Company', value: user?.company ?? 'WSI Portal Administration' },
    { icon: MapPin, label: 'Address', value: user?.address ?? 'Not set' },
    { icon: Phone, label: 'Mobile Number', value: user?.mobileNumber ?? 'Not set' },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Admin Account"
        title="Profile & security"
        description="Manage your admin identity, password, two-factor authentication, and active sessions."
      />

      {/* <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="panel p-6">
            <Icon className="text-sky-300" />
            <p className="mt-4 text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-lg font-medium text-white">{value}</p>
          </div>
        ))}
      </div> */}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <form onSubmit={handleProfileSubmit} className="panel p-6">
          <div className="flex items-center gap-3">
            <UserCircle2 className="text-sky-300" />
            <h2 className="text-xl font-semibold text-white">Update admin profile</h2>
          </div>

          <div className="mt-6 panel-muted p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <UserAvatar user={{ ...user, profilePhotoUrl: profileForm.profilePhotoUrl, name: profileForm.name }} size="h-20 w-20" textSize="text-2xl" />
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Profile picture</p>
                <p className="mt-1 text-sm text-slate-400">Upload or paste an image URL for your admin avatar.</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <label className="btn-secondary cursor-pointer gap-2">
                <ImagePlus size={16} /> Upload image
                <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageChange} />
              </label>
              {profileForm.profilePhotoUrl ? (
                <button
                  type="button"
                  onClick={() => setProfileForm((current) => ({ ...current, profilePhotoUrl: '' }))}
                  className="btn-secondary gap-2"
                >
                  <Trash2 size={16} /> Remove photo
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="block text-sm text-slate-300">
              Full Name
              <input className="input mt-2" value={profileForm.name} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label className="block text-sm text-slate-300">
              Email
              <input type="email" className="input mt-2" value={profileForm.email} onChange={(event) => setProfileForm((current) => ({ ...current, email: event.target.value }))} />
            </label>
            <label className="block text-sm text-slate-300">
              Company
              <input className="input mt-2" value={profileForm.company} onChange={(event) => setProfileForm((current) => ({ ...current, company: event.target.value }))} />
            </label>
            <label className="block text-sm text-slate-300">
              Address
              <input className="input mt-2" value={profileForm.address} onChange={(event) => setProfileForm((current) => ({ ...current, address: event.target.value }))} placeholder="Davao City, Davao del Sur, Philippines" />
            </label>
            <label className="block text-sm text-slate-300">
              Mobile Number
              <input className="input mt-2" value={profileForm.mobileNumber} onChange={(event) => setProfileForm((current) => ({ ...current, mobileNumber: event.target.value }))} placeholder="+63 912 345 6789" />
            </label>
            <label className="block text-sm text-slate-300">
              Profile Picture URL
              <input className="input mt-2" value={profileForm.profilePhotoUrl} onChange={(event) => setProfileForm((current) => ({ ...current, profilePhotoUrl: event.target.value }))} placeholder="https://example.com/profile-photo.jpg" />
            </label>
          </div>

          {profileError ? <p className="mt-4 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">{profileError}</p> : null}
          {profileMessage ? <p className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">{profileMessage}</p> : null}

          <button type="submit" disabled={isSavingProfile} className="btn-primary mt-6 gap-2 disabled:cursor-not-allowed disabled:opacity-60">
            <Save size={16} /> {isSavingProfile ? 'Saving...' : 'Save profile changes'}
          </button>
        </form>

        <form onSubmit={handlePasswordSubmit} className="panel p-6">
          <div className="flex items-center gap-3">
            <LockKeyhole className="text-sky-300" />
            <h2 className="text-xl font-semibold text-white">Change password</h2>
          </div>

          <div className="mt-6 grid gap-4">
            <label className="block text-sm text-slate-300">
              Current Password
              <input type="password" className="input mt-2" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} />
            </label>
            <label className="block text-sm text-slate-300">
              New Password
              <input type="password" className="input mt-2" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} />
            </label>
            <label className="block text-sm text-slate-300">
              Confirm New Password
              <input type="password" className="input mt-2" value={passwordForm.newPasswordConfirmation} onChange={(event) => setPasswordForm((current) => ({ ...current, newPasswordConfirmation: event.target.value }))} />
            </label>
          </div>

          {passwordError ? <p className="mt-4 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">{passwordError}</p> : null}
          {passwordMessage ? <p className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">{passwordMessage}</p> : null}

          <button type="submit" disabled={isSavingPassword} className="btn-primary mt-6 gap-2 disabled:cursor-not-allowed disabled:opacity-60">
            <LockKeyhole size={16} /> {isSavingPassword ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-sky-300" />
              <div>
                <h2 className="text-xl font-semibold text-white">Two-Factor Authentication (2FA)</h2>
                <p className="mt-2 text-sm text-slate-400">Add stronger protection to your admin access.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTwoFactorToggle}
              disabled={isSavingTwoFactor}
              role="switch"
              aria-checked={security.twoFactorEnabled}
              className={`inline-flex h-7 w-12 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${security.twoFactorEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white transition ${security.twoFactorEnabled ? 'translate-x-6 bg-emerald-50' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-medium text-white">Status</p>
            <p className="mt-2 text-sm text-slate-400">
              {security.twoFactorEnabled ? 'Protection is active for admin sign-ins.' : 'Turn this on to require verification for unusual admin logins.'}
            </p>
          </div>

          {securityError ? <p className="mt-4 rounded-2xl border border-orange-400/30 bg-orange-400/10 px-4 py-3 text-sm text-orange-100">{securityError}</p> : null}
          {securityMessage ? <p className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm text-sky-100">{securityMessage}</p> : null}
        </section>

        <section className="panel p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-center gap-3">
              <LaptopMinimal className="text-sky-300" />
              <div>
                <h2 className="text-xl font-semibold text-white">Active Sessions</h2>
                <p className="mt-2 text-sm text-slate-400">Review and end admin sessions you no longer recognize.</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogoutOthers}
              disabled={isLoggingOutOthers || security.sessions.filter((session) => !session.isCurrent).length === 0}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoggingOutOthers ? 'Logging out...' : 'LOG OUT OTHERS'}
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {(() => {
              const sessions = security.sessions || [];
              const paginatedSessions = sessions.slice(0, SESSIONS_PER_PAGE); // show only first 5 sessions

              return (
                <>
                  {paginatedSessions.map((session) => (
                    <div key={session.id} className="panel-muted rounded-3xl p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-white">{session.locationLabel}{session.isCurrent ? ' (This Device)' : ''}</p>
                            {session.isCurrent ? (
                              <span className={`badge ${isDarkMode ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}>
                                Current
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
                            <span className="inline-flex items-center gap-2"><LaptopMinimal size={14} /> {session.deviceLabel}</span>
                            <span className="inline-flex items-center gap-2"><MapPin size={14} /> {session.ipAddress ?? 'Unknown IP'}</span>
                          </div>
                          <p className="text-xs text-slate-500">Last active: {formatSessionTime(session.lastUsedAt ?? session.createdAt)}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleEndSession(session.id)}
                          disabled={session.isCurrent || endingSessionId === session.id}
                          className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {endingSessionId === session.id ? 'Ending...' : session.isCurrent ? 'Current session' : 'End session'}
                        </button>
                      </div>
                    </div>
                  ))}

                  {!sessions.length ? (
                    <div className="panel-muted rounded-3xl p-6 text-sm text-slate-400">No active sessions were found.</div>
                  ) : null}

                  {/* pagination removed for active sessions (limit enforced to 5) */}
                </>
              );
            })()}
          </div>
        </section>
      </div>
    </div>
  );
}
