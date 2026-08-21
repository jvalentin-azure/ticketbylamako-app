import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, login as apiLogin, register as apiRegister, logout as apiLogout, getStoredUser, storeUser, validateToken } from "./api/auth";
import { invalidateAllCaches } from "./api/cache";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  loginWithUser: (user: User) => void;
  updateCurrentUser: (user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function syncPushTokenForAuthenticatedUser() {
  import("./notifications")
    .then(({ registerPushTokenWithBackend }) => registerPushTokenWithBackend())
    .catch((error) => console.warn("Push token sync after auth failed:", error));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const user = await getStoredUser();
        if (user) {
          const valid = await validateToken();
          if (valid) {
            setState({ user, isLoading: false, isAuthenticated: true });
            syncPushTokenForAuthenticatedUser();
            return;
          }
        }
      } catch {}
      setState(s => ({ ...s, isLoading: false }));
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const user = await apiLogin(username, password);
    setState({ user, isLoading: false, isAuthenticated: true });
    syncPushTokenForAuthenticatedUser();
  }, []);

  const register = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    const user = await apiRegister(email, password, firstName, lastName);
    setState({ user, isLoading: false, isAuthenticated: true });
    syncPushTokenForAuthenticatedUser();
  }, []);

  const logout = useCallback(async () => {
    try {
      const { unregisterPushTokenWithBackend } = await import("./notifications");
      await Promise.race([
        unregisterPushTokenWithBackend(),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500)),
      ]);
      await apiLogout();
    } finally {
      await invalidateAllCaches();
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  const loginWithUser = useCallback((user: User) => {
    setState({ user, isLoading: false, isAuthenticated: true });
    syncPushTokenForAuthenticatedUser();
  }, []);

  const updateCurrentUser = useCallback(async (user: User) => {
    await storeUser(user);
    setState({ user, isLoading: false, isAuthenticated: true });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, loginWithUser, updateCurrentUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
