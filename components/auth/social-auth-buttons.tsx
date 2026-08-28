import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as AppleAuthentication from "expo-apple-authentication";

import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import {
  socialLogin,
  startAppleLogin,
  startFacebookLogin,
  startGoogleLogin,
  type SocialCredential,
  type SocialProvider,
} from "@/lib/api/social-auth";
import type { User } from "@/lib/api/auth";

export function SocialAuthButtons({
  onAuthenticated,
  onError,
}: {
  onAuthenticated: (user: User) => void;
  onError: (message: string) => void;
}) {
  const colors = useColors();
  const { loginWithUser } = useAuth();
  const [loading, setLoading] = useState<SocialProvider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === "web");

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    let mounted = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) setAppleAvailable(available);
      })
      .catch(() => {
        if (mounted) setAppleAvailable(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleProvider = async (provider: SocialProvider) => {
    setLoading(provider);
    onError("");
    try {
      let credential: SocialCredential | null;
      if (provider === "google") credential = await startGoogleLogin();
      else if (provider === "facebook") credential = await startFacebookLogin();
      else credential = await startAppleLogin();
      if (!credential) return;

      const user = await socialLogin(provider, credential);
      loginWithUser(user);
      onAuthenticated(user);
    } catch (error: unknown) {
      onError(
        error instanceof Error
          ? error.message
          : `Erreur de connexion ${provider}`,
      );
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      {appleAvailable ? (
        Platform.OS === "ios" ? (
          <View
            style={styles.appleButtonWrap}
            pointerEvents={loading ? "none" : "auto"}
          >
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
              }
              buttonStyle={
                AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={12}
              style={styles.appleButton}
              onPress={() => void handleProvider("apple")}
            />
            {loading === "apple" ? (
              <View style={styles.appleLoadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : null}
          </View>
        ) : (
          <TouchableOpacity
            onPress={() => void handleProvider("apple")}
            disabled={!!loading}
            accessibilityRole="button"
            accessibilityLabel="Continuer avec Apple"
            accessibilityState={{
              disabled: !!loading,
              busy: loading === "apple",
            }}
            style={[styles.appleWebButton, { opacity: loading ? 0.7 : 1 }]}
          >
            {loading === "apple" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialIcons name="apple" size={23} color="#fff" />
            )}
            <Text style={styles.socialButtonText}>Continuer avec Apple</Text>
          </TouchableOpacity>
        )
      ) : null}

      <View style={styles.row}>
        <TouchableOpacity
          onPress={() => void handleProvider("facebook")}
          disabled={!!loading}
          accessibilityRole="button"
          accessibilityLabel="Continuer avec Facebook"
          accessibilityState={{
            disabled: !!loading,
            busy: loading === "facebook",
          }}
          style={[
            styles.socialButton,
            { backgroundColor: "#1877F2", opacity: loading ? 0.7 : 1 },
          ]}
        >
          {loading === "facebook" ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialIcons name="facebook" size={22} color="#fff" />
          )}
          <Text style={styles.socialButtonText}>Facebook</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => void handleProvider("google")}
          disabled={!!loading}
          accessibilityRole="button"
          accessibilityLabel="Continuer avec Google"
          accessibilityState={{
            disabled: !!loading,
            busy: loading === "google",
          }}
          style={[
            styles.socialButton,
            {
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: loading ? 0.7 : 1,
            },
          ]}
        >
          {loading === "google" ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.googleMark}>G</Text>
          )}
          <Text style={[styles.socialButtonText, { color: colors.foreground }]}>
            Google
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  row: { flexDirection: "row", gap: 10 },
  socialButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  socialButtonText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Raleway_700Bold",
  },
  googleMark: {
    color: "#4285F4",
    fontSize: 20,
    fontFamily: "Raleway_800ExtraBold",
  },
  appleWebButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 16,
  },
  appleButtonWrap: { height: 50, position: "relative" },
  appleButton: { width: "100%", height: 50 },
  appleLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
});
