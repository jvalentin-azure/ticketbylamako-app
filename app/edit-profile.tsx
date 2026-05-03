import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getStoredToken } from "@/lib/api/auth";

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";

export default function EditProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  // Password section
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const storedToken = await getStoredToken();
      if (!storedToken) throw new Error("Non authentifié");
      const res = await fetch(`${SITE_URL}/wp-json/wp/v2/users/${user.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${storedToken}`,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: email,
          meta: {
            billing_phone: phone,
            billing_address_1: address,
            billing_city: city,
          },
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      Alert.alert("Succès", "Profil mis à jour avec succès");
    } catch (e) {
      Alert.alert("Erreur", "Impossible de mettre à jour le profil");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user) return;
    if (newPassword !== confirmPassword) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Erreur", "Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setSavingPassword(true);
    try {
      const storedToken = await getStoredToken();
      if (!storedToken) throw new Error("Non authentifié");
      const res = await fetch(`${SITE_URL}/wp-json/lamako-mobile/v1/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${storedToken}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur");
      Alert.alert("Succès", "Mot de passe modifié avec succès");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible de modifier le mot de passe");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <IconSymbol name="chevron.left.forwardslash.chevron.right" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "700" }}>Modifier le profil</Text>
        </View>

        {/* Personal Info Section */}
        <View style={{ marginHorizontal: 16, marginTop: 12 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginBottom: 12 }}>Informations personnelles</Text>

          <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
            <View>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Prénom</Text>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                style={{ backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Nom</Text>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                style={{ backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{ backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Téléphone</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="034 XX XXX XX"
                style={{ backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border }}
                placeholderTextColor={colors.muted}
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={saving}
              style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4, opacity: saving ? 0.6 : 1 }}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Enregistrer</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* Address Section */}
        <View style={{ marginHorizontal: 16, marginTop: 24 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginBottom: 12 }}>Adresse de livraison</Text>

          <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
            <View>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Adresse</Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Rue, numéro..."
                style={{ backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Ville</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Antananarivo"
                style={{ backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border }}
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>
        </View>

        {/* Password Section */}
        <View style={{ marginHorizontal: 16, marginTop: 24 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700", marginBottom: 12 }}>Modifier le mot de passe</Text>

          <View style={{ backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 14 }}>
            <View>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Mot de passe actuel</Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                style={{ backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Nouveau mot de passe</Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                style={{ backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Confirmer le mot de passe</Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                style={{ backgroundColor: colors.background, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 15, borderWidth: 1, borderColor: colors.border }}
                placeholderTextColor={colors.muted}
              />
            </View>

            <TouchableOpacity
              onPress={handleChangePassword}
              disabled={savingPassword || !currentPassword || !newPassword}
              style={{ backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 4, opacity: (savingPassword || !currentPassword || !newPassword) ? 0.6 : 1 }}
            >
              {savingPassword ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Changer le mot de passe</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
