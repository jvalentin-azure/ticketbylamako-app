import {
  clearWebSessionNonce,
  getWebSessionNonce,
  setWebSessionNonce,
} from "./web-session.web";

const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";
const WEB_SESSION_TOKEN = "wordpress-cookie-session";

export type UserRole = "customer" | "shop_manager" | "administrator";

export interface User {
  id: number;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  avatar?: string;
}

interface WebSessionResponse {
  authenticated: boolean;
  nonce?: string;
  user?: User;
  message?: string;
}

let cachedUser: User | null = null;
let sessionRequest: Promise<WebSessionResponse> | null = null;

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  return response.json().catch(() => ({}));
}

function responseMessage(
  data: Record<string, unknown>,
  fallback: string,
): string {
  return typeof data.message === "string" ? data.message : fallback;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = 15_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Le serveur met trop de temps à répondre.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function sessionHeaders(includeJson = false): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const nonce = getWebSessionNonce();
  if (nonce) headers["X-WP-Nonce"] = nonce;
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}

function acceptSession(data: WebSessionResponse): WebSessionResponse {
  if (data.authenticated && data.user && data.nonce) {
    cachedUser = data.user;
    setWebSessionNonce(data.nonce);
    return data;
  }
  cachedUser = null;
  clearWebSessionNonce();
  return { authenticated: false };
}

async function fetchSession(force = false): Promise<WebSessionResponse> {
  if (!force && sessionRequest) return sessionRequest;

  sessionRequest = fetchWithTimeout(
    `${SITE_URL}/wp-json/lamako-mobile/v2/web-session`,
    {
      headers: sessionHeaders(),
      credentials: "include",
      cache: "no-store",
    },
    8_000,
  )
    .then(async (response) => {
      if (!response.ok) return acceptSession({ authenticated: false });
      return acceptSession(
        (await parseJson(response)) as unknown as WebSessionResponse,
      );
    })
    .catch(() => ({ authenticated: false }));

  try {
    return await sessionRequest;
  } finally {
    sessionRequest = null;
  }
}

async function sessionMutation(
  endpoint: "login" | "register",
  body: Record<string, string>,
): Promise<User> {
  // A stale nonce would make WordPress reject an otherwise valid account
  // switch before the same-origin login/register handler can run.
  cachedUser = null;
  clearWebSessionNonce();
  const response = await fetchWithTimeout(
    `${SITE_URL}/wp-json/lamako-mobile/v2/web-session/${endpoint}`,
    {
      method: "POST",
      headers: sessionHeaders(true),
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify(body),
    },
  );
  const raw = await parseJson(response);
  const data = raw as unknown as WebSessionResponse;
  if (!response.ok || !data.authenticated || !data.user) {
    throw new Error(responseMessage(raw, "Impossible d'ouvrir la session."));
  }

  // The nonce produced in the same response as wp_set_auth_cookie() is not
  // yet bound to the new cookie's session token. Bootstrap once more without
  // a nonce so WordPress can validate the HttpOnly cookie and mint a nonce
  // that protected REST requests can actually use.
  cachedUser = data.user;
  const verifiedSession = await fetchSession(true);
  if (
    !verifiedSession.authenticated ||
    !verifiedSession.user ||
    verifiedSession.user.id !== data.user.id
  ) {
    cachedUser = null;
    clearWebSessionNonce();
    throw new Error("La session sécurisée n'a pas pu être confirmée.");
  }
  return verifiedSession.user;
}

export async function storeUser(user: User): Promise<void> {
  // Profile data may be cached in memory, but browser storage never receives
  // the authentication credential. The HttpOnly WordPress cookie owns it.
  cachedUser = user;
}

export async function login(username: string, password: string): Promise<User> {
  return sessionMutation("login", { username, password });
}

export async function register(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
): Promise<User> {
  return sessionMutation("register", {
    email,
    password,
    first_name: firstName,
    last_name: lastName,
  });
}

export async function requestPasswordReset(
  loginOrEmail: string,
): Promise<string> {
  const response = await fetchWithTimeout(
    `${SITE_URL}/wp-json/lamako-mobile/v1/password-reset`,
    {
      method: "POST",
      headers: sessionHeaders(true),
      credentials: "include",
      body: JSON.stringify({ login: loginOrEmail }),
    },
  );
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(
      responseMessage(data, "Impossible d'envoyer l'email de réinitialisation"),
    );
  }
  return responseMessage(
    data,
    "Si un compte existe, un email de réinitialisation vient d'être envoyé.",
  );
}

export async function getStoredUser(): Promise<User | null> {
  if (cachedUser && getWebSessionNonce()) return cachedUser;
  const session = await fetchSession();
  return session.authenticated && session.user ? session.user : null;
}

export async function getStoredToken(): Promise<string | null> {
  const session = await fetchSession();
  return session.authenticated ? WEB_SESSION_TOKEN : null;
}

export async function validateToken(_storedToken?: string): Promise<boolean> {
  const session = await fetchSession(true);
  return session.authenticated;
}

export async function logout(): Promise<void> {
  const response = await fetchWithTimeout(
    `${SITE_URL}/wp-json/lamako-mobile/v2/web-session/logout`,
    {
      method: "POST",
      headers: sessionHeaders(true),
      credentials: "include",
      cache: "no-store",
      body: "{}",
    },
  );
  // An expired session is already logged out. Network failures and every
  // other server rejection keep the local state intact so refresh cannot
  // unexpectedly restore a cookie that was never invalidated server-side.
  if (!response.ok && response.status !== 401) {
    throw new Error(
      "Impossible de fermer la session. Vérifiez votre connexion puis réessayez.",
    );
  }
  cachedUser = null;
  clearWebSessionNonce();
}

export async function requestAccountDeletion(): Promise<number> {
  await fetchSession(true);
  const response = await fetchWithTimeout(
    `${SITE_URL}/wp-json/ticketbylamako-compliance/v1/account-deletion-requests`,
    {
      method: "POST",
      headers: sessionHeaders(true),
      credentials: "include",
      body: "{}",
    },
  );
  const data = await parseJson(response);
  if (!response.ok || data.success !== true) {
    throw new Error(
      responseMessage(
        data,
        "La demande de suppression n’a pas pu être enregistrée.",
      ),
    );
  }
  return Number(data.request_id);
}

export async function updateProfile(
  _token: string,
  userId: number,
  data: { first_name?: string; last_name?: string },
): Promise<void> {
  await fetchSession(true);
  const response = await fetchWithTimeout(
    `${SITE_URL}/wp-json/wp/v2/users/${userId}`,
    {
      method: "POST",
      headers: sessionHeaders(true),
      credentials: "include",
      body: JSON.stringify(data),
    },
  );
  if (!response.ok) throw new Error("Erreur lors de la mise à jour");
}
