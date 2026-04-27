import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function RegisterScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const router = useRouter();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRegister = async () => {
    if (!email.trim() || !password.trim() || !firstName.trim()) { setError("Veuillez remplir tous les champs obligatoires"); return; }
    setError("");
    setLoading(true);
    try {
      await register(email.trim(), password, firstName.trim(), lastName.trim());
      router.replace("/(tabs)/" as any);
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'inscription");
    } finally { setLoading(false); }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }} keyboardShouldPersistTaps="handled">
          {/* Back button */}
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
            <IconSymbol name="chevron.left" size={22} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontSize: 15, fontFamily: "Raleway-Medium", marginLeft: 4 }}>Retour</Text>
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
            <Text style={[styles.titleText, { color: colors.foreground }]}>Créer un compte</Text>
            <Text style={[styles.subtitleText, { color: colors.muted }]}>Inscrivez-vous pour acheter des billets</Text>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: colors.error + "15" }]}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.error} />
              <Text style={{ color: colors.error, fontSize: 13, marginLeft: 8, flex: 1, fontFamily: "Raleway-Medium" }}>{error}</Text>
            </View>
          ) : null}

          {/* Name fields */}
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Prénom *</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput placeholder="Prénom" placeholderTextColor={colors.muted} value={firstName} onChangeText={setFirstName}
                  style={[styles.input, { color: colors.foreground }]} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: colors.foreground }]}>Nom</Text>
              <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput placeholder="Nom" placeholderTextColor={colors.muted} value={lastName} onChangeText={setLastName}
                  style={[styles.input, { color: colors.foreground }]} />
              </View>
            </View>
          </View>

          {/* Email */}
          <View style={{ marginBottom: 14 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Email *</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="paperplane.fill" size={18} color={colors.muted} />
              <TextInput placeholder="votre@email.com" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail}
                autoCapitalize="none" keyboardType="email-address"
                style={[styles.input, { color: colors.foreground }]} />
            </View>
          </View>

          {/* Password */}
          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.inputLabel, { color: colors.foreground }]}>Mot de passe *</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="lock.fill" size={18} color={colors.muted} />
              <TextInput placeholder="Min. 6 caractères" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword}
                secureTextEntry={!showPw} returnKeyType="done" onSubmitEditing={handleRegister}
                style={[styles.input, { color: colors.foreground }]} />
              <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                <IconSymbol name={showPw ? "eye.slash.fill" : "eye.fill"} size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Register button */}
          <TouchableOpacity onPress={handleRegister} disabled={loading}
            style={[styles.registerButton, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.registerButtonText}>S'inscrire</Text>}
          </TouchableOpacity>

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={{ color: colors.muted, fontSize: 14, fontFamily: "Raleway-Regular" }}>Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login" as any)}>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600", fontFamily: "Raleway-SemiBold" }}>Se connecter</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 28,
  },
  logo: {
    width: 160,
    height: 50,
    marginBottom: 16,
  },
  titleText: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "Raleway-Bold",
  },
  subtitleText: {
    fontSize: 14,
    marginTop: 4,
    fontFamily: "Raleway-Regular",
  },
  errorBox: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  nameRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    fontFamily: "Raleway-SemiBold",
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
    fontFamily: "Raleway-Regular",
  },
  registerButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  registerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Raleway-Bold",
  },
  loginRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
});
