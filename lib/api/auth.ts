import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";
const TOKEN_KEY = "jwt_token";
const USER_KEY = "user_data";

export type UserRole = "customer" | "shop_manager" | "administrator";
export type PortalType = "client" | "organisateur" | "admin";

export interface User {
  id: number;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  portal: PortalType;
  avatar?: string;
}

interface JWTResponse {
  token: string;
  user_email: string;
  user_nicename: string;
  user_display_name: string;
}

// Secure storage helpers (fallback to AsyncStorage on web)
async function secureSet(key: string, value: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
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

function roleToPortal(role: UserRole): PortalType {
  switch (role) {
    case "administrator": return "admin";
    case "shop_manager": return "organisateur";
    default: return "client";
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
    portal: roleToPortal(role),
    avatar: wpUser.avatar_urls?.["96"],
  };

  await secureSet(USER_KEY, JSON.stringify(user));
  return user;
}

export async function register(email: string, password: string, firstName: string, lastName: string): Promise<User> {
  // Register via WP REST API
  const res = await fetch(`${SITE_URL}/wp-json/wp/v2/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: email,
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

  // Auto-login after registration
  return login(email, password);
}

export async function getStoredUser(): Promise<User | null> {
  try {
    const data = await secureGet(USER_KEY);
    if (!data) return null;
    return JSON.parse(data);
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
