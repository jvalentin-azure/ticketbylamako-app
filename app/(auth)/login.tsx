import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Alert, Linking } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { socialLogin, startGoogleLogin, startAppleLogin, startFacebookLogin, type SocialProvider } from "@/lib/api/social-auth";

export default function LoginScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const router = useRouter();
  const { login, loginWithUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError("Veuillez remplir tous les champs"); return; }
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/" as any);
    } catch (e: any) {
      setError(e.message || "Identifiants incorrects");
    } finally { setLoading(false); }
  };

  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const handleSocialLogin = async (provider: SocialProvider) => {
    setSocialLoading(provider);
    setError("");
    try {
      let result: { token: string; email?: string; name?: string; firstName?: string; lastName?: string } | null = null;

      switch (provider) {
        case "google":
          result = await startGoogleLogin();
          break;
        case "apple":
          result = await startAppleLogin();
          break;
        case "facebook":
          result = await startFacebookLogin();
          break;
      }

      if (!result) {
        setSocialLoading(null);
        return; // User cancelled
      }

      // Send token to backend for verification and account linking
      const user = await socialLogin(provider, result.token, {
        email: result.email,
        firstName: result.firstName,
        lastName: result.lastName,
        name: result.name,
      });

      // Update auth state and navigate
      loginWithUser(user);
      router.replace("/(tabs)/" as any);
    } catch (e: any) {
      setError(e.message || `Erreur de connexion ${provider}`);
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }} keyboardShouldPersistTaps="handled">
          {/* Back button */}
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
            <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontSize: 15, marginLeft: 4 }}>Retour</Text>
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
            <Text style={[styles.welcomeText, { color: colors.foreground }]}>Bienvenue</Text>
            <Text style={[styles.subtitleText, { color: colors.muted }]}>Connectez-vous à votre compte</Text>
          </View>

          {/* Social Login Buttons */}
          <View style={styles.socialContainer}>
            {/* Facebook */}
            <TouchableOpacity
              onPress={() => handleSocialLogin("facebook")}
              style={[styles.socialButton, { backgroundColor: "#1877F2" }]}
              activeOpacity={0.8}
            >
              <MaterialIcons name="facebook" size={22} color="#fff" />
              <Text style={styles.socialButtonText}>Facebook</Text>
            </TouchableOpacity>

            {/* Apple */}
            <TouchableOpacity
              onPress={() => handleSocialLogin("apple")}
              style={[styles.socialButton, { backgroundColor: scheme === "dark" ? "#fff" : "#000" }]}
              activeOpacity={0.8}
            >
              <MaterialIcons name="apple" size={22} color={scheme === "dark" ? "#000" : "#fff"} />
              <Text style={[styles.socialButtonText, { color: scheme === "dark" ? "#000" : "#fff" }]}>Apple</Text>
            </TouchableOpacity>

            {/* Google */}
            <TouchableOpacity
              onPress={() => handleSocialLogin("google")}
              style={[styles.socialButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#4285F4" }}>G</Text>
              <Text style={[styles.socialButtonText, { color: colors.foreground }]}>Google</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.muted }]}>ou</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Error */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.error + "15" }]}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.error} />
              <Text style={{ color: colors.error, fontSize: 13, marginLeft: 8, flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={{ marginBottom: 14 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Email ou nom d'utilisateur</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="person.fill" size={18} color={colors.muted} />
              <TextInput
                placeholder="votre@email.com"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                style={[styles.input, { color: colors.foreground }]}
              />
            </View>
          </View>

          {/* Password */}
          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Mot de passe</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="lock.fill" size={18} color={colors.muted} />
              <TextInput
                placeholder="Votre mot de passe"
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                style={[styles.input, { color: colors.foreground }]}
              />
              <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                <IconSymbol name={showPw ? "eye.slash.fill" : "eye.fill"} size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Login button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading}
            style={[styles.loginButton, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Se connecter</Text>}
          </TouchableOpacity>

          {/* Register link */}
          <View style={styles.registerRow}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>Pas encore de compte ? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/register" as any)}>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>S'inscrire</Text>
            </TouchableOpacity>
          </View>

          {/* Privacy link */}
          <TouchableOpacity onPress={() => Linking.openURL("https://www.ticketbylamako.com/politique-de-confidentialite/")} style={styles.privacyLink}>
            <Text style={{ color: colors.muted, fontSize: 12, textDecorationLine: "underline" }}>Politique de confidentialité</Text>
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
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  socialButton: {
    flex: 1,
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
  loginButton: {
    borderRadius: 14,
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
    justifyContent: "center",
    marginTop: 20,
  },
  privacyLink: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 20,
  },
});
