import { useCallback, useEffect, useState } from "react";
import { Text, View, TouchableOpacity, ScrollView, Switch, StyleSheet, Platform, Linking, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  getStoredPushToken,
  registerForPushNotificationsAsync,
  registerPushTokenWithBackend,
  cancelAllNotifications,
  type NotificationPreferences,
} from "@/lib/notifications";
import * as Notifications from "expo-notifications";

interface SettingItem {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
  icon: string;
}

const SETTINGS: SettingItem[] = [
  {
    key: "newEvents",
    title: "Nouveaux événements",
    description: "Soyez informé des nouveaux événements publiés",
    icon: "calendar",
  },
  {
    key: "orderUpdates",
    title: "Mises à jour commandes",
    description: "Recevez les confirmations et changements de statut",
    icon: "bag.fill",
  },
  {
    key: "eventReminders",
    title: "Rappels d'événements",
    description: "Rappel 1 heure avant le début de l'événement",
    icon: "clock.fill",
  },
  {
    key: "promotions",
    title: "Promotions & offres",
    description: "Offres spéciales, codes promo et réductions",
    icon: "tag.fill",
  },
];

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [hasPushToken, setHasPushToken] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string>("undetermined");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [savingKey, setSavingKey] = useState<keyof NotificationPreferences | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [p, token, perm] = await Promise.all([
        getNotificationPreferences(),
        getStoredPushToken(),
        Notifications.getPermissionsAsync(),
      ]);
      setPrefs(p);
      setHasPushToken(Boolean(token));
      setPermissionStatus(perm.status);
    } catch {
      setLoadError(
        "Impossible de charger les paramètres de notifications. Vérifiez votre connexion puis réessayez.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleToggle = async (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    const previous = prefs;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSavingKey(key);
    try {
      await saveNotificationPreferences(updated);
    } catch {
      setPrefs(previous);
      Alert.alert(
        "Modification non enregistrée",
        "Ce réglage n'a pas pu être sauvegardé. Réessayez.",
      );
    } finally {
      setSavingKey(null);
    }
  };

  const handleEnableNotifications = async () => {
    if (enabling) return;
    setEnabling(true);
    try {
      const token = await registerForPushNotificationsAsync();
      const permission = await Notifications.getPermissionsAsync();
      setPermissionStatus(permission.status);
      if (token) {
        setHasPushToken(true);
        const registered = await registerPushTokenWithBackend();
        if (!registered) {
          Alert.alert(
            "Synchronisation en attente",
            "Les notifications sont autorisées sur cet appareil, mais la synchronisation avec votre compte devra être réessayée.",
          );
        }
      } else if (permission.status !== "granted" && Platform.OS !== "web") {
        Alert.alert(
          "Autorisation requise",
          "Activez les notifications dans les paramètres de votre appareil.",
          [
            { text: "Annuler", style: "cancel" },
            { text: "Ouvrir les paramètres", onPress: () => Linking.openSettings() },
          ],
        );
      } else {
        Alert.alert(
          "Notifications indisponibles",
          "Le service de notifications n'a pas pu être initialisé. Réessayez plus tard.",
        );
      }
    } catch {
      Alert.alert(
        "Notifications indisponibles",
        "Impossible d'activer les notifications pour le moment.",
      );
    } finally {
      setEnabling(false);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      "Effacer les rappels planifiés ?",
      "Les rappels déjà programmés sur cet appareil seront supprimés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelAllNotifications();
              Alert.alert("Rappels effacés", "Les rappels planifiés ont été supprimés.");
            } catch {
              Alert.alert("Erreur", "Impossible d'effacer les rappels planifiés.");
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (loadError || !prefs) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center px-6">
        <IconSymbol name="exclamationmark.triangle.fill" size={38} color={colors.primary} />
        <Text style={[styles.errorTitle, { color: colors.foreground }]}>Notifications indisponibles</Text>
        <Text style={[styles.errorMessage, { color: colors.muted }]}>{loadError}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Réessayer de charger les paramètres de notifications"
          onPress={() => void loadSettings()}
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
        >
          <IconSymbol name="arrow.clockwise" size={18} color="#fff" />
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Permission Status */}
        {permissionStatus !== "granted" && (
          <TouchableOpacity
            onPress={handleEnableNotifications}
            disabled={enabling}
            style={[styles.permissionBanner, { backgroundColor: "#F59E0B" + "15" }]}
            activeOpacity={0.8}
          >
            {enabling ? (
              <ActivityIndicator size="small" color="#F59E0B" />
            ) : (
              <IconSymbol name="bell.fill" size={24} color="#F59E0B" />
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.permissionTitle, { color: "#F59E0B" }]}>Notifications désactivées</Text>
              <Text style={[styles.permissionSub, { color: colors.muted }]}>
                Appuyez pour activer les notifications push
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color="#F59E0B" />
          </TouchableOpacity>
        )}

        {permissionStatus === "granted" && (
          <TouchableOpacity
            accessibilityRole={hasPushToken ? undefined : "button"}
            accessibilityLabel={hasPushToken ? undefined : "Réessayer la synchronisation des notifications"}
            onPress={hasPushToken ? undefined : handleEnableNotifications}
            disabled={hasPushToken || enabling}
            activeOpacity={0.8}
            style={[styles.permissionBanner, { backgroundColor: "#22C55E" + "10" }]}
          >
            {enabling ? (
              <ActivityIndicator size="small" color="#22C55E" />
            ) : (
              <IconSymbol
                name={hasPushToken ? "checkmark.circle.fill" : "arrow.clockwise"}
                size={24}
                color="#22C55E"
              />
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.permissionTitle, { color: "#22C55E" }]}>
                {hasPushToken ? "Notifications activées" : "Synchronisation en attente"}
              </Text>
              <Text style={[styles.permissionSub, { color: colors.muted }]}>
                {hasPushToken
                  ? "Cet appareil est prêt à recevoir vos alertes."
                  : "Appuyez pour réessayer la connexion de cet appareil."}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Notification Categories */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Catégories de notifications</Text>
          <Text style={[styles.sectionSub, { color: colors.muted }]}>
            Choisissez les types de notifications que vous souhaitez recevoir
          </Text>

          {prefs && SETTINGS.map((setting, i) => (
            <View key={setting.key} style={[styles.settingRow, i < SETTINGS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
              <View style={[styles.settingIcon, { backgroundColor: colors.primary + "12" }]}>
                <IconSymbol name={setting.icon as any} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.settingTitle, { color: colors.foreground }]}>{setting.title}</Text>
                <Text style={[styles.settingDesc, { color: colors.muted }]}>{setting.description}</Text>
              </View>
              <Switch
                accessibilityLabel={setting.title}
                accessibilityHint={setting.description}
                value={prefs[setting.key]}
                onValueChange={() => handleToggle(setting.key)}
                disabled={savingKey !== null}
                trackColor={{ false: colors.border, true: colors.primary + "60" }}
                thumbColor={prefs[setting.key] ? colors.primary : colors.muted}
              />
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Actions</Text>

          <TouchableOpacity
            onPress={handleClearAll}
            style={[styles.actionRow, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
          >
            <View style={[styles.settingIcon, { backgroundColor: "#EF4444" + "12" }]}>
              <IconSymbol name="trash.fill" size={18} color="#EF4444" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.settingTitle, { color: "#EF4444" }]}>Effacer les rappels planifiés</Text>
              <Text style={[styles.settingDesc, { color: colors.muted }]}>Annuler tous les rappels d'événements</Text>
            </View>
            <IconSymbol name="chevron.right" size={14} color={colors.muted} />
          </TouchableOpacity>

          {Platform.OS !== "web" && (
            <TouchableOpacity
              onPress={() => Linking.openSettings()}
              style={styles.actionRow}
              activeOpacity={0.7}
            >
              <View style={[styles.settingIcon, { backgroundColor: colors.muted + "15" }]}>
                <IconSymbol name="gearshape.fill" size={18} color={colors.muted} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.settingTitle, { color: colors.foreground }]}>Paramètres système</Text>
                <Text style={[styles.settingDesc, { color: colors.muted }]}>Ouvrir les paramètres de l'appareil</Text>
              </View>
              <IconSymbol name="chevron.right" size={14} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Info */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <Text style={[styles.infoText, { color: colors.muted }]}>
            Les notifications push nécessitent un appareil physique. Les rappels d'événements sont programmés localement sur votre appareil.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  permissionBanner: { flexDirection: "row", alignItems: "center", padding: 16, marginHorizontal: 16, marginTop: 16, borderRadius: 14 },
  permissionTitle: { fontSize: 15, fontWeight: "700" },
  permissionSub: { fontSize: 12, marginTop: 2 },
  section: { marginHorizontal: 16, marginTop: 16, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  sectionTitle: { fontSize: 15, fontWeight: "700", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  sectionSub: { fontSize: 12, paddingHorizontal: 16, paddingBottom: 8 },
  settingRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  settingIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingTitle: { fontSize: 14, fontWeight: "600" },
  settingDesc: { fontSize: 12, marginTop: 2 },
  actionRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  infoText: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  errorTitle: { fontSize: 20, fontWeight: "800", marginTop: 14 },
  errorMessage: { fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
  retryButton: { minHeight: 48, marginTop: 18, paddingHorizontal: 20, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  retryButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
