import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";

export default function RegisterScreen() {
  const colors = useColors();
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
          <TouchableOpacity onPress={() => router.back()} style={{ position: "absolute", top: 16, left: 24 }}>
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </TouchableOpacity>

          <View style={{ alignItems: "center", marginBottom: 32 }}>
            <View style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Text style={{ color: "#fff", fontSize: 32, fontWeight: "800" }}>L</Text>
            </View>
            <Text style={{ color: colors.foreground, fontSize: 26, fontWeight: "700" }}>Créer un compte</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>Inscrivez-vous pour acheter des billets</Text>
          </View>

          {error ? (
            <View style={{ backgroundColor: colors.error + "15", padding: 12, borderRadius: 10, marginBottom: 16, flexDirection: "row", alignItems: "center" }}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.error} />
              <Text style={{ color: colors.error, fontSize: 13, marginLeft: 8, flex: 1 }}>{error}</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: 12, marginBottom: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Prénom *</Text>
              <TextInput placeholder="Prénom" placeholderTextColor={colors.muted} value={firstName} onChangeText={setFirstName}
                style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, paddingHorizontal: 14, color: colors.foreground, fontSize: 15 }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Nom</Text>
              <TextInput placeholder="Nom" placeholderTextColor={colors.muted} value={lastName} onChangeText={setLastName}
                style={{ backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, paddingHorizontal: 14, color: colors.foreground, fontSize: 15 }} />
            </View>
          </View>

          <View style={{ marginBottom: 14 }}>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Email *</Text>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }}>
              <IconSymbol name="paperplane.fill" size={18} color={colors.muted} />
              <TextInput placeholder="votre@email.com" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail}
                autoCapitalize="none" keyboardType="email-address"
                style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, color: colors.foreground, fontSize: 15 }} />
            </View>
          </View>

          <View style={{ marginBottom: 20 }}>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600", marginBottom: 6 }}>Mot de passe *</Text>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 }}>
              <IconSymbol name="lock.fill" size={18} color={colors.muted} />
              <TextInput placeholder="Min. 6 caractères" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword}
                secureTextEntry={!showPw} returnKeyType="done" onSubmitEditing={handleRegister}
                style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 10, color: colors.foreground, fontSize: 15 }} />
              <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                <IconSymbol name={showPw ? "eye.slash.fill" : "eye.fill"} size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity onPress={handleRegister} disabled={loading}
            style={{ backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center", opacity: loading ? 0.7 : 1 }}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>S'inscrire</Text>}
          </TouchableOpacity>

          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 20 }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>Déjà un compte ? </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login" as any)}>
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "600" }}>Se connecter</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
