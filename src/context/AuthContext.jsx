import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { portalApi } from '../services/portalApi';

const AuthContext = createContext(null);

const storageKey = 'wsi-auth-user';

const detectClientSessionMeta = () => {
  if (typeof window === 'undefined') {
    return {};
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language || 'en-US';
  const platform = navigator.platform || 'Unknown device';

  return {
    locationLabel: timezone ? timezone.replace('_', ' ') : language,
    deviceLabel: platform,
    userAgent: navigator.userAgent,
  };
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : null;
  });
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(portalApi.getStoredToken()));
  const [security, setSecurity] = useState({ twoFactorEnabled: false, sessions: [] });
  // Inactivity logout settings
  // inactivity limit before warning/logout (5 minutes)
  const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes
  // show warning 30s before logout
  const WARNING_DURATION = 30 * 1000;
  const [showIdleWarning, setShowIdleWarning] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState(0);
  const warningTimerRef = useRef(null);
  const logoutTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  const persistUser = (nextUser) => {
    setUser(nextUser);
    if (nextUser) {
      localStorage.setItem(storageKey, JSON.stringify(nextUser));
      return;
    }
    localStorage.removeItem(storageKey);
  };

  const clearInactivityTimers = () => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setShowIdleWarning(false);
    setIdleCountdown(0);
  };

  const startInactivityTimers = () => {
    clearInactivityTimers();
    // schedule warning
    warningTimerRef.current = setTimeout(() => {
      setShowIdleWarning(true);
      setIdleCountdown(Math.ceil(WARNING_DURATION / 1000));
      countdownIntervalRef.current = setInterval(() => {
        setIdleCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            return 0;
          }
          return c - 1;
        });
      }, 1000);

      logoutTimerRef.current = setTimeout(() => {
        // perform logout when countdown finishes
        clearInactivityTimers();
        logout();
      }, WARNING_DURATION);
    }, Math.max(0, INACTIVITY_LIMIT - WARNING_DURATION));
  };

  const resetInactivityTimers = () => {
    // restart timers when user interacts
    if (!portalApi.getStoredToken()) return;
    startInactivityTimers();
  };

  // listen for user interactions to reset timer
  useEffect(() => {
    const events = [ 'touchstart', 'click'];
    const onActivity = () => resetInactivityTimers();

    if (portalApi.getStoredToken()) {
      events.forEach((ev) => window.addEventListener(ev, onActivity));
      // start timers initially
      startInactivityTimers();
    }

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      clearInactivityTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const token = portalApi.getStoredToken();

      if (!token) {
        setIsAuthLoading(false);
        return;
      }

      try {
        const currentUser = await portalApi.getCurrentUser();
        persistUser(currentUser);
      } catch {
        portalApi.clearAuthToken();
        persistUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  const loadSecuritySettings = useCallback(async () => {
    if (!portalApi.getStoredToken()) {
      setSecurity({ twoFactorEnabled: false, sessions: [] });
      return;
    }

    try {
      const data = await portalApi.getSecuritySettings();
      setSecurity({
        twoFactorEnabled: Boolean(data.twoFactorEnabled),
        sessions: data.sessions ?? [],
      });
    } catch {
      setSecurity((current) => ({ ...current, sessions: [] }));
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setSecurity({ twoFactorEnabled: false, sessions: [] });
      return;
    }

    loadSecuritySettings();
  }, [user]);

  const login = async ({ email, password, role = 'customer' }) => {
    try {
      const response = await portalApi.login({ email, password, role, sessionMeta: detectClientSessionMeta() });

      if (response.requiresTwoFactor) {
        return {
          success: false,
          requiresTwoFactor: true,
          challengeId: response.challengeId,
          demoCode: response.demoCode,
          message: response.message,
        };
      }

      portalApi.setAuthToken(response.token);
      persistUser(response.user);
      setSecurity((current) => ({ ...current, twoFactorEnabled: Boolean(response.user?.twoFactorEnabled) }));
      return { success: true, user: response.user };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const verifyTwoFactorLogin = async ({ email, password, role = 'customer', challengeId, twoFactorCode }) => {
    try {
      const response = await portalApi.login({
        email,
        password,
        role,
        challengeId,
        twoFactorCode,
        sessionMeta: detectClientSessionMeta(),
      });

      if (response.requiresTwoFactor) {
        return {
          success: false,
          requiresTwoFactor: true,
          challengeId: response.challengeId,
          demoCode: response.demoCode,
          message: response.message,
        };
      }

      portalApi.setAuthToken(response.token);
      persistUser(response.user);
      return { success: true, user: response.user };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const register = async (payload) => {
    try {
      const response = await portalApi.register({ ...payload, sessionMeta: detectClientSessionMeta() });

      if (response.pendingApproval) {
        portalApi.clearAuthToken();
        persistUser(null);
        return { success: true, pendingApproval: true, message: response.message, user: response.user };
      }

      portalApi.setAuthToken(response.token);
      persistUser(response.user);
      return { success: true, user: response.user, message: response.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const logout = () => {
    portalApi.clearAuthToken();
    persistUser(null);
    setSecurity({ twoFactorEnabled: false, sessions: [] });
  };

  const updateProfile = async (payload) => {
    try {
      const response = await portalApi.updateProfile(payload);
      persistUser(response.user);
      return { success: true, user: response.user, message: response.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const updatePassword = async (payload) => {
    try {
      const response = await portalApi.updatePassword(payload);
      return { success: true, message: response.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const updateTwoFactor = async (enabled) => {
    try {
      const response = await portalApi.updateTwoFactor({ enabled });
      if (user) {
        persistUser({ ...user, twoFactorEnabled: response.twoFactorEnabled });
      }
      setSecurity((current) => ({ ...current, twoFactorEnabled: response.twoFactorEnabled }));
      return { success: true, message: response.message, enabled: response.twoFactorEnabled };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const revokeSession = async (sessionId) => {
    try {
      const response = await portalApi.revokeSession(sessionId);

      if (response.loggedOutCurrentSession) {
        logout();
        return { success: true, message: response.message, loggedOutCurrentSession: true };
      }

      await loadSecuritySettings();
      return { success: true, message: response.message, loggedOutCurrentSession: false };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const revokeOtherSessions = async () => {
    try {
      const response = await portalApi.revokeOtherSessions();
      await loadSecuritySettings();
      return { success: true, message: response.message };
    } catch (error) {
      return { success: false, message: error.message };
    }
  };

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isAdmin: user?.role === 'admin',
      isAuthLoading,
      security,
      login,
      verifyTwoFactorLogin,
      register,
      updateProfile,
      updatePassword,
      updateTwoFactor,
      revokeSession,
      revokeOtherSessions,
      loadSecuritySettings,
      logout,
      // idle logout UI
      showIdleWarning,
      idleCountdown,
      resetInactivityTimers,
    }),
    [user, isAuthLoading, security, showIdleWarning, idleCountdown, resetInactivityTimers, logout, login, verifyTwoFactorLogin, register, updateProfile, updatePassword, updateTwoFactor, revokeSession, revokeOtherSessions, loadSecuritySettings],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
