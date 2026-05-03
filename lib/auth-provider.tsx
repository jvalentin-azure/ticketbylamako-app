import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User, PortalType, login as apiLogin, register as apiRegister, logout as apiLogout, getStoredUser, validateToken } from "./api/auth";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  portal: PortalType;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  loginWithUser: (user: User) => void;
  logout: () => Promise<void>;
  switchPortal: (portal: PortalType) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    portal: "client",
  });

  useEffect(() => {
    (async () => {
      try {
        const user = await getStoredUser();
        if (user) {
          const valid = await validateToken();
          if (valid) {
            setState({ user, isLoading: false, isAuthenticated: true, portal: user.portal });
            return;
          }
        }
      } catch {}
      setState(s => ({ ...s, isLoading: false }));
    })();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const user = await apiLogin(username, password);
    setState({ user, isLoading: false, isAuthenticated: true, portal: user.portal });
  }, []);

  const register = useCallback(async (email: string, password: string, firstName: string, lastName: string) => {
    const user = await apiRegister(email, password, firstName, lastName);
    setState({ user, isLoading: false, isAuthenticated: true, portal: user.portal });
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setState({ user: null, isLoading: false, isAuthenticated: false, portal: "client" });
  }, []);

  const loginWithUser = useCallback((user: User) => {
    setState({ user, isLoading: false, isAuthenticated: true, portal: user.portal });
  }, []);

  const switchPortal = useCallback((portal: PortalType) => {
    setState(s => ({ ...s, portal }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, loginWithUser, logout, switchPortal }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
