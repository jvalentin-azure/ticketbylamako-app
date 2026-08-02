import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import { User } from "./auth";

WebBrowser.maybeCompleteAuthSession();

const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || "";
const SITE_URL_BASE = SITE_URL.replace(/\/$/, "");

const TOKEN_KEY = "jwt_token";
const USER_KEY = "user_data";
const OAUTH_STATE_PREFIX = "lamako_oauth_state_";
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const SOCIAL_REQUEST_TIMEOUT_MS = 15_000;

export type SocialProvider = "google" | "apple" | "facebook";

export interface SocialCredential {
  token: string;
  nonce?: string;
  firstName?: string;
  lastName?: string;
}

interface StoredOAuthState {
  stateId: string;
  oidcNonce: string;
  issuedAt: number;
}

interface OAuthStatePayload extends StoredOAuthState {
  provider: "google" | "facebook";
  returnUrl: string;
}

interface SocialLoginResponse {
  success: boolean;
  token: string;
  user: {
    id: number;
    email: string;
    display_name: string;
    first_name: string;
    last_name: string;
    role: string;
    avatar_url?: string;
  };
  is_new_user: boolean;
  linked_existing: boolean;
  message?: string;
}

async function secureSet(key: string, value: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
    return;
  }

  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(key, value);
}

async function randomToken(byteLength = 32): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(byteLength);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function createOAuthState(
  provider: "google" | "facebook",
  returnUrl: string,
): Promise<{ state: string; stored: StoredOAuthState }> {
  const stored: StoredOAuthState = {
    stateId: await randomToken(),
    oidcNonce: await randomToken(),
    issuedAt: Date.now(),
  };
  const payload: OAuthStatePayload = {
    provider,
    returnUrl,
    ...stored,
  };

  await AsyncStorage.setItem(
    `${OAUTH_STATE_PREFIX}${provider}`,
    JSON.stringify(stored),
  );

  return { state: JSON.stringify(payload), stored };
}

function getOAuthParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const fragment = parsed.hash.startsWith("#")
    ? parsed.hash.slice(1)
    : parsed.hash;
  return new URLSearchParams(fragment || parsed.search.replace(/^\?/, ""));
}

function parseOAuthState(value: string): OAuthStatePayload | null {
  try {
    return JSON.parse(value) as OAuthStatePayload;
  } catch {
    try {
      return JSON.parse(decodeURIComponent(value)) as OAuthStatePayload;
    } catch {
      return null;
    }
  }
}

async function validateOAuthState(
  provider: "google" | "facebook",
  params: URLSearchParams,
): Promise<StoredOAuthState> {
  const returnedState = params.get("state");
  const storageKey = `${OAUTH_STATE_PREFIX}${provider}`;
  const expectedRaw = await AsyncStorage.getItem(storageKey);
  await AsyncStorage.removeItem(storageKey);

  if (!returnedState || !expectedRaw) {
    throw new Error("Session de connexion expirée. Veuillez réessayer.");
  }

  const returned = parseOAuthState(returnedState);
  let expected: StoredOAuthState | null = null;
  try {
    expected = JSON.parse(expectedRaw) as StoredOAuthState;
  } catch {
    expected = null;
  }

  if (
    !returned ||
    !expected ||
    returned.provider !== provider ||
    returned.stateId !== expected.stateId ||
    returned.oidcNonce !== expected.oidcNonce ||
    returned.issuedAt !== expected.issuedAt ||
    Date.now() - expected.issuedAt > OAUTH_STATE_MAX_AGE_MS
  ) {
    throw new Error("Retour de connexion invalide. Veuillez réessayer.");
  }

  const providerError = params.get("error_description") || params.get("error");
  if (providerError) {
    throw new Error(providerError);
  }

  return expected;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = SOCIAL_REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("Le service de connexion met trop de temps à répondre.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function socialLogin(
  provider: SocialProvider,
  credential: SocialCredential,
): Promise<User> {
  const res = await fetchWithTimeout(
    `${SITE_URL_BASE}/wp-json/lamako-mobile/v1/social-login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider,
        token: credential.token,
        nonce: credential.nonce,
        first_name: provider === "apple" ? credential.firstName : undefined,
        last_name: provider === "apple" ? credential.lastName : undefined,
      }),
    },
  );

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.message || `Erreur de connexion ${provider} (${res.status})`,
    );
  }

  const data: SocialLoginResponse = await res.json();
  if (!data.success || !data.token) {
    throw new Error(data.message || "Échec de l'authentification");
  }

  await secureSet(TOKEN_KEY, data.token);

  const roles = data.user.role || "customer";
  let role: "customer" | "shop_manager" | "administrator" = "customer";
  if (roles.includes("administrator")) role = "administrator";
  else if (roles.includes("shop_manager")) role = "shop_manager";

  const user: User = {
    id: data.user.id,
    email: data.user.email,
    displayName: data.user.display_name,
    firstName: data.user.first_name || "",
    lastName: data.user.last_name || "",
    role,
    avatar: data.user.avatar_url,
  };

  await secureSet(USER_KEY, JSON.stringify(user));
  return user;
}

export async function startGoogleLogin(): Promise<SocialCredential | null> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google Client ID non configuré");
  }

  const appRedirectUri = Linking.createURL("oauth/google-callback");
  const webRedirectUri = `${SITE_URL_BASE}/lamako-mobile/oauth/google-callback`;
  const { state, stored } = await createOAuthState("google", appRedirectUri);
  const authParams = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: webRedirectUri,
    response_type: "id_token",
    scope: "openid email profile",
    state,
    nonce: stored.oidcNonce,
    prompt: "select_account",
  });

  const result = await WebBrowser.openAuthSessionAsync(
    `https://accounts.google.com/o/oauth2/v2/auth?${authParams.toString()}`,
    appRedirectUri,
  );
  if (result.type !== "success" || !result.url) {
    await AsyncStorage.removeItem(`${OAUTH_STATE_PREFIX}google`);
    return null;
  }

  const params = getOAuthParams(result.url);
  const validatedState = await validateOAuthState("google", params);
  const identityToken = params.get("id_token");
  if (!identityToken) {
    throw new Error("Google n'a pas retourné de preuve d'identité.");
  }

  return { token: identityToken, nonce: validatedState.oidcNonce };
}

export async function startAppleLogin(): Promise<SocialCredential | null> {
  if (Platform.OS !== "ios") {
    throw new Error("La connexion Apple est disponible uniquement sur iOS.");
  }

  const AppleAuthentication = await import("expo-apple-authentication");
  const state = await randomToken();
  const nonce = await randomToken();

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      state,
      nonce,
    });

    if (credential.state !== state) {
      throw new Error("Retour Apple invalide. Veuillez réessayer.");
    }
    if (!credential.identityToken) {
      throw new Error("Apple n'a pas retourné de preuve d'identité.");
    }

    return {
      token: credential.identityToken,
      nonce,
      firstName: credential.fullName?.givenName || undefined,
      lastName: credential.fullName?.familyName || undefined,
    };
  } catch (error: any) {
    if (error?.code === "ERR_REQUEST_CANCELED") return null;
    throw error;
  }
}

export async function startFacebookLogin(): Promise<SocialCredential | null> {
  if (!FACEBOOK_APP_ID) {
    throw new Error("Facebook App ID non configuré");
  }

  const appRedirectUri = Linking.createURL("oauth/facebook-callback");
  const webRedirectUri = `${SITE_URL_BASE}/lamako-mobile/oauth/facebook-callback`;
  const { state } = await createOAuthState("facebook", appRedirectUri);
  const authParams = new URLSearchParams({
    client_id: FACEBOOK_APP_ID,
    redirect_uri: webRedirectUri,
    response_type: "token",
    scope: "email,public_profile",
    state,
  });

  const result = await WebBrowser.openAuthSessionAsync(
    `https://www.facebook.com/v18.0/dialog/oauth?${authParams.toString()}`,
    appRedirectUri,
  );
  if (result.type !== "success" || !result.url) {
    await AsyncStorage.removeItem(`${OAUTH_STATE_PREFIX}facebook`);
    return null;
  }

  const params = getOAuthParams(result.url);
  await validateOAuthState("facebook", params);
  const accessToken = params.get("access_token");
  if (!accessToken) {
    throw new Error("Facebook n'a pas retourné de preuve d'identité.");
  }

  return { token: accessToken };
}
