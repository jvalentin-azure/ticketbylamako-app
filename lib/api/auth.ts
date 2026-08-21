import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseStoredUser } from "@/lib/auth-user";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";
const TOKEN_KEY = "jwt_token";
const USER_KEY = "user_data";

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

interface JWTResponse {
  token: string;
  user_email: string;
  user_nicename: string;
  user_display_name: string;
}

interface MobileAuthResponse {
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
  message?: string;
}

// Secure storage helpers (fallback to AsyncStorage on web)
async function secureSet(key: string, value: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

export async function storeUser(user: User): Promise<void> {
  await secureSet(USER_KEY, JSON.stringify(user));
}

async function secureGet(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function secureDelete(key: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

export async function login(username: string, password: string): Promise<User> {
  // Step 1: Get JWT token
  const tokenRes = await fetch(`${SITE_URL}/wp-json/jwt-auth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.json().catch(() => ({}));
    throw new Error(err.message || "Identifiants incorrects");
  }

  const jwt: JWTResponse = await tokenRes.json();
  await secureSet(TOKEN_KEY, jwt.token);

  // Step 2: Get user details including role
  const userRes = await fetch(`${SITE_URL}/wp-json/wp/v2/users/me?context=edit`, {
    headers: { Authorization: `Bearer ${jwt.token}` },
  });

  if (!userRes.ok) throw new Error("Impossible de récupérer le profil");

  const wpUser = await userRes.json();
  const roles: string[] = wpUser.roles || [];
  let role: UserRole = "customer";
  if (roles.includes("administrator")) role = "administrator";
  else if (roles.includes("shop_manager")) role = "shop_manager";

  const user: User = {
    id: wpUser.id,
    email: wpUser.email || jwt.user_email,
    displayName: jwt.user_display_name,
    firstName: wpUser.first_name || "",
    lastName: wpUser.last_name || "",
    role,
    avatar: wpUser.avatar_urls?.["96"],
  };

  await storeUser(user);
  return user;
}

export async function register(email: string, password: string, firstName: string, lastName: string): Promise<User> {
  const res = await fetch(`${SITE_URL}/wp-json/lamako-mobile/v1/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      first_name: firstName,
      last_name: lastName,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Erreur lors de l'inscription");
  }

  const data: MobileAuthResponse = await res.json();
  if (!data.success || !data.token) {
    throw new Error(data.message || "Erreur lors de l'inscription");
  }

  await secureSet(TOKEN_KEY, data.token);

  const roles = data.user.role || "customer";
  let role: UserRole = "customer";
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

  await storeUser(user);
  return user;
}

export async function requestPasswordReset(loginOrEmail: string): Promise<string> {
  const res = await fetch(`${SITE_URL}/wp-json/lamako-mobile/v1/password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: loginOrEmail }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Impossible d'envoyer l'email de réinitialisation");
  }

  return data.message || "Si un compte existe, un email de réinitialisation vient d'être envoyé.";
}

export async function getStoredUser(): Promise<User | null> {
  try {
    const data = await secureGet(USER_KEY);
    if (!data) return null;
    const user = parseStoredUser(data);
    if (!user) {
      await secureDelete(USER_KEY).catch(() => undefined);
      return null;
    }
    return user;
  } catch {
    return null;
  }
}

export async function getStoredToken(): Promise<string | null> {
  return secureGet(TOKEN_KEY);
}

export async function validateToken(): Promise<boolean> {
  const token = await getStoredToken();
  if (!token) return false;

  try {
    const res = await fetch(`${SITE_URL}/wp-json/jwt-auth/v1/token/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  await secureDelete(TOKEN_KEY);
  await secureDelete(USER_KEY);
}

export async function requestAccountDeletion(): Promise<number> {
  const token = await getStoredToken();
  if (!token) {
    throw new Error("Vous devez être connecté pour demander la suppression du compte.");
  }

  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 20000) : null;
  let res: Response;

  try {
    res = await fetch(`${SITE_URL}/wp-json/ticketbylamako-compliance/v1/account-deletion-requests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller?.signal,
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error("La demande a expiré. Vérifiez votre connexion puis réessayez.");
    }
    throw new Error("Impossible de contacter le serveur. Vérifiez votre connexion puis réessayez.");
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || "La demande de suppression n’a pas pu être enregistrée.");
  }

  return Number(data.request_id);
}

export async function updateProfile(token: string, userId: number, data: { first_name?: string; last_name?: string }): Promise<void> {
  const res = await fetch(`${SITE_URL}/wp-json/wp/v2/users/${userId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour");
}
