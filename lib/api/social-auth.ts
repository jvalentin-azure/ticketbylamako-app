import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { User, getStoredToken } from "./auth";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
const FACEBOOK_APP_ID = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID || "";

const TOKEN_KEY = "jwt_token";
const USER_KEY = "user_data";

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
  userData?: { email?: string; firstName?: string; lastName?: string; name?: string }
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
    throw new Error(data.message || "Échec de l'authentification");
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
 * Generate a random code verifier for PKCE
 */
function generateCodeVerifier(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate code challenge from verifier (S256 method)
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  if (Platform.OS === "web") {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  } else {
    // On native, use expo-crypto
    const Crypto = await import("expo-crypto");
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      verifier,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    return digest
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
}

/**
 * Google Sign-In using OAuth2 Authorization Code flow with PKCE.
 * This is the recommended approach for mobile apps (implicit flow is deprecated).
 */
export async function startGoogleLogin(): Promise<{ token: string; email?: string; name?: string; firstName?: string; lastName?: string } | null> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Google Client ID non configuré");
  }

  // Use the app scheme for redirect
  const redirectUri = Linking.createURL("oauth/google-callback");
  const state = Math.random().toString(36).substring(7);

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Use authorization code flow with PKCE (not implicit flow)
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent("openid email profile")}` +
    `&state=${state}` +
    `&code_challenge=${encodeURIComponent(codeChallenge)}` +
    `&code_challenge_method=S256` +
    `&access_type=offline` +
    `&prompt=select_account`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type === "success" && result.url) {
    // Parse the authorization code from the URL
    const url = new URL(result.url);
    const code = url.searchParams.get("code") || new URLSearchParams(url.hash.substring(1)).get("code");

    if (code) {
      // Exchange code for tokens using Google's token endpoint
      try {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            code,
            code_verifier: codeVerifier,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          }).toString(),
        });

        const tokenData = await tokenRes.json();

        if (tokenData.access_token) {
          // Get user info from Google
          const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const userInfo = await userInfoRes.json();
          return {
            token: tokenData.access_token,
            email: userInfo.email,
            name: userInfo.name,
            firstName: userInfo.given_name,
            lastName: userInfo.family_name,
          };
        } else if (tokenData.id_token) {
          // Fallback: use id_token if access_token not available
          return { token: tokenData.id_token };
        } else {
          console.warn("Google token exchange failed:", tokenData);
          throw new Error(tokenData.error_description || "Échec de l'échange de code Google");
        }
      } catch (e: any) {
        console.warn("Google token exchange error:", e);
        throw new Error(e.message || "Erreur lors de l'authentification Google");
      }
    }
  }

  return null;
}

/**
 * Apple Sign-In using the native Apple Authentication module.
 */
export async function startAppleLogin(): Promise<{ token: string; email?: string; firstName?: string; lastName?: string } | null> {
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
export async function startFacebookLogin(): Promise<{ token: string; email?: string; name?: string } | null> {
  if (!FACEBOOK_APP_ID) {
    throw new Error("Facebook App ID non configuré");
  }

  const redirectUri = Linking.createURL("oauth/facebook-callback");
  const state = Math.random().toString(36).substring(7);

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
    `client_id=${encodeURIComponent(FACEBOOK_APP_ID)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=token` +
    `&scope=${encodeURIComponent("email,public_profile")}` +
    `&state=${state}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type === "success" && result.url) {
    const url = new URL(result.url);
    const fragment = url.hash.substring(1);
    const params = new URLSearchParams(fragment);
    const accessToken = params.get("access_token");

    if (accessToken) {
      // Get user info from Facebook
      try {
        const userInfoRes = await fetch(`https://graph.facebook.com/me?fields=email,name,first_name,last_name&access_token=${accessToken}`);
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
