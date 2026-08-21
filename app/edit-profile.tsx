import { useState, useEffect, useRef } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/lib/auth-provider";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getStoredToken } from "@/lib/api/auth";
import {
  getMobileProfile,
  MobileApiError,
  updateMobileProfile,
} from "@/lib/api/mobile";

const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL || "https://www.ticketbylamako.com";

export default function EditProfileScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, updateCurrentUser } = useAuth();

  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const profileRequestId = useRef(0);

  // Load the server profile first; local billing data is only a fallback.
  useEffect(() => {
    const activeRequest = ++profileRequestId.current;
    (async () => {
      try {
        const profile = await getMobileProfile();
        if (profileRequestId.current !== activeRequest) return;
        setFirstName(profile.firstName);
        setLastName(profile.lastName);
        setEmail(profile.email);
        setPhone(profile.billing.phone);
        setAddress(profile.billing.address_1);
        setCity(profile.billing.city);
        await AsyncStorage.setItem(
          "billing_info",
          JSON.stringify({
            phone: profile.billing.phone,
            address: profile.billing.address_1,
            city: profile.billing.city,
          }),
        );
      } catch {
        const saved = await AsyncStorage.getItem("billing_info");
        if (profileRequestId.current !== activeRequest || !saved) return;
        try {
          const data = JSON.parse(saved);
          if (data.phone) setPhone(data.phone);
          if (data.address) setAddress(data.address);
          if (data.city) setCity(data.city);
        } catch {
          // Invalid local fallback: keep the authenticated identity fields.
        }
      } finally {
        if (profileRequestId.current === activeRequest) {
          setLoadingProfile(false);
        }
      }
    })();
    return () => {
      profileRequestId.current += 1;
    };
  }, []);
  const [saving, setSaving] = useState(false);

  // Password section
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!email.trim()) {
      Alert.alert("Adresse e-mail requise", "Saisissez une adresse e-mail.");
      return;
    }
    setSaving(true);
    try {
      const profile = await updateMobileProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        billing: {
          phone: phone.trim(),
          address_1: address.trim(),
          city: city.trim(),
          country: "MG",
        },
      });
      await AsyncStorage.setItem(
        "billing_info",
        JSON.stringify({
          phone: profile.billing.phone,
          address: profile.billing.address_1,
          city: profile.billing.city,
        }),
      );
      await updateCurrentUser({
        ...user,
        email: profile.email,
        displayName: profile.displayName,
        firstName: profile.firstName,
        lastName: profile.lastName,
      });
      Alert.alert("Succès", "Profil mis à jour avec succès");
    } catch (error) {
      const message =
        error instanceof MobileApiError && error.status === 409
          ? "Cette adresse e-mail est déjà utilisée."
          : error instanceof MobileApiError && error.status === 401
            ? "Votre session a expiré. Reconnectez-vous."
            : "Impossible de mettre à jour le profil. Vérifiez votre connexion.";
      Alert.alert("Erreur", message);
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
      Alert.alert(
        "Erreur",
        "Le mot de passe doit contenir au moins 6 caractères",
      );
      return;
    }
    setSavingPassword(true);
    try {
      const storedToken = await getStoredToken();
      if (!storedToken) throw new Error("Non authentifié");
      const res = await fetch(
        `${SITE_URL}/wp-json/lamako-mobile/v1/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${storedToken}`,
          },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Erreur");
      Alert.alert("Succès", "Mot de passe modifié avec succès");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        e.message || "Impossible de modifier le mot de passe",
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 12 }}
          >
            <IconSymbol
              name="chevron.left"
              size={22}
              color={colors.foreground}
            />
          </TouchableOpacity>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 20,
              fontWeight: "700",
            }}
          >
            Modifier le profil
          </Text>
        </View>

        {/* Personal Info Section */}
        <View style={{ marginHorizontal: 16, marginTop: 12 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 16,
              fontWeight: "700",
              marginBottom: 12,
            }}
          >
            Informations personnelles
          </Text>

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 14,
            }}
          >
            <View>
              <Text
                style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}
              >
                Prénom
              </Text>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text
                style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}
              >
                Nom
              </Text>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text
                style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}
              >
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text
                style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}
              >
                Téléphone
              </Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="034 XX XXX XX"
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                placeholderTextColor={colors.muted}
              />
            </View>

            <TouchableOpacity
              onPress={handleSaveProfile}
              disabled={saving || loadingProfile}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 4,
                opacity: saving || loadingProfile ? 0.6 : 1,
              }}
            >
              {saving || loadingProfile ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}
                >
                  Enregistrer
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Address Section */}
        <View style={{ marginHorizontal: 16, marginTop: 24 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 16,
              fontWeight: "700",
              marginBottom: 12,
            }}
          >
            Adresse de livraison
          </Text>

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 14,
            }}
          >
            <View>
              <Text
                style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}
              >
                Adresse
              </Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                placeholder="Rue, numéro..."
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text
                style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}
              >
                Ville
              </Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Antananarivo"
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>
        </View>

        {/* Password Section */}
        <View style={{ marginHorizontal: 16, marginTop: 24 }}>
          <Text
            style={{
              color: colors.foreground,
              fontSize: 16,
              fontWeight: "700",
              marginBottom: 12,
            }}
          >
            Modifier le mot de passe
          </Text>

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 14,
            }}
          >
            <View>
              <Text
                style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}
              >
                Mot de passe actuel
              </Text>
              <TextInput
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text
                style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}
              >
                Nouveau mot de passe
              </Text>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                placeholderTextColor={colors.muted}
              />
            </View>
            <View>
              <Text
                style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}
              >
                Confirmer le mot de passe
              </Text>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
                placeholderTextColor={colors.muted}
              />
            </View>

            <TouchableOpacity
              onPress={handleChangePassword}
              disabled={savingPassword || !currentPassword || !newPassword}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
                marginTop: 4,
                opacity:
                  savingPassword || !currentPassword || !newPassword ? 0.6 : 1,
              }}
            >
              {savingPassword ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text
                  style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}
                >
                  Changer le mot de passe
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
