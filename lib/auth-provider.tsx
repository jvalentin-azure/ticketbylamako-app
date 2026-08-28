import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  User,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getStoredToken,
  getStoredUser,
  storeUser,
  validateToken,
  confirmAuthenticatedUser,
} from "./api/auth";
import { invalidateAllCaches } from "./api/cache";
import { clearTicketDetailCache } from "./ticket-detail-cache";
import { isJwtLocallyUsable } from "./jwt-session";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
  ) => Promise<void>;
  loginWithUser: (user: User) => void;
  updateCurrentUser: (user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function syncPushTokenForAuthenticatedUser() {
  import("./notifications")
    .then(({ registerPushTokenWithBackend }) => registerPushTokenWithBackend())
    .catch((error) =>
      console.warn("Push token sync after auth failed:", error),
    );
}

function hasExternalWebAuthReturn(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("lamako_auth");
}

function clearExternalWebAuthReturn(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("lamako_auth");
  window.history.replaceState(window.history.state, "", url.toString());
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (hasExternalWebAuthReturn()) {
          const returnedUser = await confirmAuthenticatedUser();
          if (returnedUser && !cancelled) {
            clearExternalWebAuthReturn();
            setState({
              user: returnedUser,
              isLoading: false,
              isAuthenticated: true,
            });
            syncPushTokenForAuthenticatedUser();
            return;
          }
        }

        const [user, token] = await Promise.all([
          getStoredUser(),
          getStoredToken(),
        ]);

        if (!user || !token || cancelled) {
          if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
          return;
        }

        if (isJwtLocallyUsable(token)) {
          setState({ user, isLoading: false, isAuthenticated: true });
          syncPushTokenForAuthenticatedUser();

          void validateToken(token).then(async (valid) => {
            if (valid || cancelled) return;

            // Do not let validation of an older token erase a session created
            // while the background request was still running.
            const currentToken = await getStoredToken().catch(() => null);
            if (cancelled || currentToken !== token) return;

            await apiLogout().catch(() => undefined);
            if (!cancelled) {
              setState({
                user: null,
                isLoading: false,
                isAuthenticated: false,
              });
            }
          });
          return;
        }

        const valid = await validateToken(token);
        if (valid && !cancelled) {
          setState({ user, isLoading: false, isAuthenticated: true });
          syncPushTokenForAuthenticatedUser();
          return;
        }

        const currentToken = await getStoredToken().catch(() => null);
        if (currentToken === token) {
          await apiLogout().catch(() => undefined);
        }
      } catch {
        // Keep startup resilient; storage/network failures are retried on the
        // next launch and never trigger an unsafe AsyncStorage token fallback.
      }

      if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const user = await apiLogin(username, password);
    setState({ user, isLoading: false, isAuthenticated: true });
    syncPushTokenForAuthenticatedUser();
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      firstName: string,
      lastName: string,
    ) => {
      const user = await apiRegister(email, password, firstName, lastName);
      setState({ user, isLoading: false, isAuthenticated: true });
      syncPushTokenForAuthenticatedUser();
    },
    [],
  );

  const logout = useCallback(async () => {
    const currentUserId = state.user?.id;
    const { unregisterPushTokenWithBackend } = await import("./notifications");
    await Promise.race([
      unregisterPushTokenWithBackend(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 1500)),
    ]).catch(() => false);
    await apiLogout();
    try {
      await invalidateAllCaches();
      if (currentUserId) await clearTicketDetailCache(currentUserId);
    } finally {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, [state.user?.id]);

  const loginWithUser = useCallback((user: User) => {
    setState({ user, isLoading: false, isAuthenticated: true });
    syncPushTokenForAuthenticatedUser();
  }, []);

  const updateCurrentUser = useCallback(async (user: User) => {
    await storeUser(user);
    setState({ user, isLoading: false, isAuthenticated: true });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        loginWithUser,
        updateCurrentUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
