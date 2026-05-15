import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { User } from "./auth";

const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || "";
const SITE_URL_BASE = SITE_URL.replace(/\/$/, "");

const TOKEN_KEY = "jwt_token";
const USER_KEY = "user_data";
const OAUTH_STATE_PREFIX = "lamako_oauth_state_";

export type SocialProvider = "google" | "apple" | "facebook";

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

// Secure storage helpers (same as auth.ts)
async function secureSet(key: string, value: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(key, value);
  }
}

function createOAuthState(
  provider: "google" | "facebook",
  returnUrl: string,
): { state: string; nonce: string } {
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return {
    nonce,
    state: JSON.stringify({
      provider,
      nonce,
      returnUrl,
      ts: Date.now(),
    }),
  };
}

function getOAuthParams(url: string): URLSearchParams {
  const parsed = new URL(url);
  const fragment = parsed.hash.startsWith("#")
    ? parsed.hash.slice(1)
    : parsed.hash;
  return new URLSearchParams(fragment || parsed.search.replace(/^\?/, ""));
}

async function rememberOAuthState(
  provider: "google" | "facebook",
  nonce: string,
) {
  await AsyncStorage.setItem(`${OAUTH_STATE_PREFIX}${provider}`, nonce);
}

async function validateOAuthState(
  provider: "google" | "facebook",
  params: URLSearchParams,
) {
  const returnedState = params.get("state");
  const expectedNonce = await AsyncStorage.getItem(
    `${OAUTH_STATE_PREFIX}${provider}`,
  );

  if (!returnedState || !expectedNonce) {
    throw new Error("Session de connexion expirée. Veuillez réessayer.");
  }

  let decoded: any = null;
  try {
    decoded = JSON.parse(returnedState);
  } catch {
    try {
      decoded = JSON.parse(decodeURIComponent(returnedState));
    } catch {
      decoded = null;
    }
  }

  await AsyncStorage.removeItem(`${OAUTH_STATE_PREFIX}${provider}`);

  if (
    !decoded ||
    decoded.provider !== provider ||
    decoded.nonce !== expectedNonce
  ) {
    throw new Error("Retour de connexion invalide. Veuillez réessayer.");
  }
}

/**
 * Social login flow:
 * 1. Get OAuth token from provider (Google/Apple/Facebook)
 * 2. Send token to WordPress backend endpoint
 * 3. Backend verifies token, finds/creates user, links accounts by email
 * 4. Returns JWT token for the app
 */
export async function socialLogin(
  provider: SocialProvider,
  token: string,
  userData?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  },
): Promise<User> {
  // Call the WordPress social login endpoint
  const res = await fetch(`${SITE_URL}/wp-json/lamako-mobile/v1/social-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      token,
      email: userData?.email,
      first_name: userData?.firstName,
      last_name: userData?.lastName,
      name: userData?.name,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Erreur de connexion ${provider}`);
  }

  const data: SocialLoginResponse = await res.json();

  if (!data.success || !data.token) {
    throw new Error(data.message || "Ã‰chec de l'authentification");
  }

  // Store JWT token
  await secureSet(TOKEN_KEY, data.token);

  // Build user object
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

/**
 * Google Sign-In through a HTTPS callback page.
 * Google web OAuth clients only accept http/https redirect URIs, so WordPress
 * receives the HTTPS redirect and forwards the fragment back to the app.
 */
export async function startGoogleLogin(): Promise<{
  token: string;
  email?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
} | null> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google Client ID non configuré");
  }

  const appRedirectUri = Linking.createURL("oauth/google-callback");
  const webRedirectUri = `${SITE_URL_BASE}/lamako-mobile/oauth/google-callback`;
  const { state, nonce } = createOAuthState("google", appRedirectUri);
  await rememberOAuthState("google", nonce);

  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(webRedirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    `&state=${state}` +
    `&prompt=select_account`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, appRedirectUri);

  if (result.type === "success" && result.url) {
    const params = getOAuthParams(result.url);
    await validateOAuthState("google", params);
    const accessToken = params.get("access_token");

    if (accessToken) {
      try {
        const userInfoRes = await fetch(
          "https://www.googleapis.com/oauth2/v3/userinfo",
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        const userInfo = await userInfoRes.json();
        return {
          token: accessToken,
          email: userInfo.email,
          name: userInfo.name,
          firstName: userInfo.given_name,
          lastName: userInfo.family_name,
        };
      } catch (e: any) {
        console.warn("Google userinfo error:", e);
        throw new Error(
          e.message || "Erreur lors de l'authentification Google",
        );
      }
    }
  }

  return null;
}
/**
 * Apple Sign-In using the native Apple Authentication module.
 */
export async function startAppleLogin(): Promise<{
  token: string;
  email?: string;
  firstName?: string;
  lastName?: string;
} | null> {
  if (Platform.OS === "web") {
    throw new Error("Apple Sign-In n'est pas disponible sur le web");
  }

  try {
    const AppleAuthentication = await import("expo-apple-authentication");
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (credential.identityToken) {
      return {
        token: credential.identityToken,
        email: credential.email || undefined,
        firstName: credential.fullName?.givenName || undefined,
        lastName: credential.fullName?.familyName || undefined,
      };
    }
  } catch (e: any) {
    if (e.code === "ERR_REQUEST_CANCELED") {
      return null; // User cancelled
    }
    throw e;
  }

  return null;
}

/**
 * Facebook Login using OAuth web flow.
 */
export async function startFacebookLogin(): Promise<{
  token: string;
  email?: string;
  name?: string;
} | null> {
  if (!FACEBOOK_APP_ID) {
    throw new Error("Facebook App ID non configurÃ©");
  }

  const appRedirectUri = Linking.createURL("oauth/facebook-callback");
  const webRedirectUri = `${SITE_URL_BASE}/lamako-mobile/oauth/facebook-callback`;
  const { state, nonce } = createOAuthState("facebook", appRedirectUri);
  await rememberOAuthState("facebook", nonce);

  const authUrl =
    `https://www.facebook.com/v18.0/dialog/oauth?` +
    `client_id=${encodeURIComponent(FACEBOOK_APP_ID)}` +
    `&redirect_uri=${encodeURIComponent(webRedirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent("email,public_profile")}` +
    `&state=${state}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, appRedirectUri);

  if (result.type === "success" && result.url) {
    const params = getOAuthParams(result.url);
    await validateOAuthState("facebook", params);
    const accessToken = params.get("access_token");

    if (accessToken) {
      // Get user info from Facebook
      try {
        const userInfoRes = await fetch(
          `https://graph.facebook.com/me?fields=email,name,first_name,last_name&access_token=${accessToken}`,
        );
        const userInfo = await userInfoRes.json();
        return {
          token: accessToken,
          email: userInfo.email,
          name: userInfo.name,
        };
      } catch {
        return { token: accessToken };
      }
    }
  }

  return null;
}
