import { useEffect, useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { requestPasswordReset } from "@/lib/api/auth";
import { goBackOrFallback } from "@/lib/navigation";

export default function LoginScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const { login, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated) return;
    if (params.returnTo) router.replace(params.returnTo as any);
    else router.replace("/(tabs)/" as any);
  }, [isAuthLoading, isAuthenticated, params.returnTo, router]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError("Veuillez remplir tous les champs");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      if (params.returnTo) {
        router.replace(params.returnTo as any);
      } else {
        router.replace("/(tabs)/" as any);
      }
    } catch (e: any) {
      setError(e.message || "Identifiants incorrects");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const loginOrEmail = email.trim();
    setResetMessage("");
    setError("");
    if (!loginOrEmail) {
      setError(
        "Renseignez votre email ou nom d'utilisateur pour recevoir le lien de réinitialisation.",
      );
      return;
    }

    setResetLoading(true);
    try {
      const message = await requestPasswordReset(loginOrEmail);
      setResetMessage(message);
    } catch (e: any) {
      setError(e.message || "Impossible d'envoyer l'email de réinitialisation");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: 24,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <TouchableOpacity
            onPress={() => goBackOrFallback(router, "/(tabs)/")}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            style={[styles.backButton, { backgroundColor: colors.surface }]}
          >
            <IconSymbol
              name="chevron.left"
              size={22}
              color={colors.foreground}
            />
            <Text
              style={{ color: colors.foreground, fontSize: 15, marginLeft: 4 }}
            >
              Retour
            </Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={styles.logoArea}>
            <Image
              source={
                scheme === "dark"
                  ? require("@/assets/images/logo-white.png")
                  : require("@/assets/images/logo-dark.png")
              }
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={[styles.welcomeText, { color: colors.foreground }]}>
              Bienvenue
            </Text>
            <Text style={[styles.subtitleText, { color: colors.muted }]}>
              Connectez-vous à votre compte
            </Text>
          </View>

          <SocialAuthButtons
            onError={setError}
            onAuthenticated={() => {
              if (params.returnTo) router.replace(params.returnTo as any);
              else router.replace("/(tabs)/" as any);
            }}
          />

          <View style={styles.divider}>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.border }]}
            />
            <Text style={[styles.dividerText, { color: colors.muted }]}>
              ou
            </Text>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.border }]}
            />
          </View>

          {/* Error */}
          {error ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={[
                styles.errorBox,
                { backgroundColor: colors.error + "15" },
              ]}
            >
              <IconSymbol
                name="xmark.circle.fill"
                size={18}
                color={colors.error}
              />
              <Text
                style={{
                  color: colors.error,
                  fontSize: 13,
                  marginLeft: 8,
                  flex: 1,
                }}
              >
                {error}
              </Text>
            </View>
          ) : null}

          {resetMessage ? (
            <View
              accessible
              accessibilityLabel={resetMessage}
              accessibilityLiveRegion="polite"
              style={[
                styles.errorBox,
                { backgroundColor: colors.success + "15" },
              ]}
            >
              <IconSymbol
                name="checkmark.circle.fill"
                size={18}
                color={colors.success}
              />
              <Text
                style={{
                  color: colors.success,
                  fontSize: 13,
                  marginLeft: 8,
                  flex: 1,
                }}
              >
                {resetMessage}
              </Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={{ marginBottom: 14 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>
              Email ou nom d'utilisateur
            </Text>
            <View
              style={[
                styles.inputRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <IconSymbol name="person.fill" size={18} color={colors.muted} />
              <TextInput
                accessibilityLabel="Email ou nom d'utilisateur"
                placeholder="votre@email.com"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoComplete="username"
                keyboardType="email-address"
                textContentType="username"
                returnKeyType="next"
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
          </View>

          {/* Password */}
          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>
              Mot de passe
            </Text>
            <View
              style={[
                styles.inputRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <IconSymbol name="lock.fill" size={18} color={colors.muted} />
              <TextInput
                accessibilityLabel="Mot de passe"
                placeholder="Votre mot de passe"
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
                autoComplete="current-password"
                secureTextEntry={!showPw}
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                style={[styles.input, { color: colors.foreground }]}
              />
              <TouchableOpacity
                onPress={() => setShowPw(!showPw)}
                accessibilityRole="button"
                accessibilityLabel={
                  showPw
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
                hitSlop={8}
                style={styles.passwordToggle}
              >
                <IconSymbol
                  name={showPw ? "eye.slash.fill" : "eye.fill"}
                  size={20}
                  color={colors.muted}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={handlePasswordReset}
              disabled={resetLoading}
              accessibilityRole="button"
              accessibilityLabel="Mot de passe oublié"
              accessibilityState={{
                disabled: resetLoading,
                busy: resetLoading,
              }}
              style={styles.forgotPasswordButton}
            >
              {resetLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text
                  style={[styles.forgotPasswordText, { color: colors.primary }]}
                >
                  Mot de passe oublié ?
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Login button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Se connecter"
            accessibilityState={{ disabled: loading, busy: loading }}
            style={[
              styles.loginButton,
              { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Se connecter</Text>
            )}
          </TouchableOpacity>

          {/* Register link */}
          <View style={styles.registerRow}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              Pas encore de compte ?{" "}
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/register" as any)}
              accessibilityRole="link"
              accessibilityLabel="Créer un compte"
              style={styles.inlineLink}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                S'inscrire
              </Text>
            </TouchableOpacity>
          </View>

          {/* Privacy link */}
          <TouchableOpacity
            onPress={() => router.push("/privacy" as any)}
            accessibilityRole="link"
            accessibilityLabel="Politique de confidentialité"
            style={styles.privacyLink}
          >
            <Text
              style={{
                color: colors.muted,
                fontSize: 12,
                textDecorationLine: "underline",
              }}
            >
              Politique de confidentialité
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    borderRadius: 10,
    marginBottom: 20,
  },
  logoArea: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    width: 180,
    height: 60,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 26,
    fontWeight: "700",
  },
  subtitleText: {
    fontSize: 14,
    marginTop: 4,
  },
  socialContainer: {
    gap: 10,
    marginBottom: 20,
  },
  socialButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  appleButtonWrap: {
    position: "relative",
    width: "100%",
    height: 46,
  },
  appleButton: {
    width: "100%",
    height: 46,
  },
  appleLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
  },
  socialButton: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  socialButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  googleMark: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4285F4",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 13,
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    fontSize: 15,
  },
  forgotPasswordButton: {
    alignSelf: "flex-end",
    minHeight: 44,
    justifyContent: "center",
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: "700",
  },
  loginButton: {
    borderRadius: 14,
    minHeight: 52,
    paddingVertical: 16,
    alignItems: "center",
  },
  loginButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  registerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  inlineLink: {
    minHeight: 44,
    justifyContent: "center",
  },
  passwordToggle: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -8,
  },
  privacyLink: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    marginTop: 16,
    marginBottom: 20,
  },
});
