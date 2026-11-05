import React, { createContext, useState, useContext, useEffect } from 'react';
import { studio } from '@/api/studioClient';

const AuthContext = createContext();

// Role hierarchy (higher number = more access):
//   superadmin (CEO) — sees every user's data and all admin tools
//   admin           — team manager, admin-only sections
//   user            — only their own data
const ROLE_LEVEL = { superadmin: 3, admin: 2, user: 1 };
const atLeast = (role, min) => (ROLE_LEVEL[role] || 1) >= (ROLE_LEVEL[min] || 1);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // Contains only { id, public_settings }

  useEffect(() => {
    checkAppState();
    const handleFocus = () => {
      if (localStorage.getItem("studio_access_token")) {
        refreshUser();
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const refreshUser = async () => {
    try {
      const currentUser = await studio.auth.me();
      if (currentUser && currentUser.is_active !== false) {
        setUser(currentUser);
        setIsAuthenticated(true);
        return currentUser;
      }
    } catch {
      // Ignore background refresh errors
    }
  };

  const checkAppState = async () => {
    setAppPublicSettings({ id: 'studio', public_settings: {} });
    setIsLoadingPublicSettings(false);
    await checkUserAuth();
  };

  const checkUserAuth = async () => {
    try {
      // Now check if the user is authenticated
      setIsLoadingAuth(true);
      const currentUser = await studio.auth.me();

      // Check if user is deactivated
      if (currentUser.is_active === false) {
        setUser(null);
        setIsAuthenticated(false);
        setIsLoadingAuth(false);
        setAuthChecked(true);
        setAuthError({
          type: 'user_deactivated',
          message: 'حساب کاربری شما غیرفعال شده است. با مدیر تماس بگیرید.'
        });
        return;
      }

      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      // A successful session check overrides any earlier app-level error
      // (e.g. a failed public-settings probe), so ProtectedRoute doesn't
      // bounce a validly authenticated user back to login.
      setAuthError(null);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      setAuthChecked(true);

      // If user auth fails, it might be an expired token
      if (error.status === 401 || error.status === 403) {
        setAuthError({
          type: 'auth_required',
          message: 'Authentication required'
        });
      }
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    setAuthChecked(true);
    return studio.auth.logout();
  };

  const navigateToLogin = () => studio.auth.redirectToLogin();

  // Role helpers for the rest of the app. Superadmin satisfies "admin" checks
  // too, so admin-only sections stay accessible to the CEO.
  const role = user?.role || "user";
  const isAdmin = atLeast(role, "admin");
  const isSuperadmin = role === "superadmin";
  const isActive = user?.is_active !== false;

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      isAdmin,
      isSuperadmin,
      isActive,
      logout,
      navigateToLogin,
      refreshUser,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
