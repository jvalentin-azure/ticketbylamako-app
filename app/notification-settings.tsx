import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, ScrollView, Switch, StyleSheet, Platform, Linking, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  getStoredPushToken,
  registerForPushNotificationsAsync,
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
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<string>("undetermined");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [p, token, perm] = await Promise.all([
        getNotificationPreferences(),
        getStoredPushToken(),
        Notifications.getPermissionsAsync(),
      ]);
      setPrefs(p);
      setPushToken(token);
      setPermissionStatus(perm.status);
      setLoading(false);
    }
    load();
  }, []);

  const handleToggle = async (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    await saveNotificationPreferences(updated);
  };

  const handleEnableNotifications = async () => {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      setPushToken(token);
      setPermissionStatus("granted");
    } else {
      if (Platform.OS !== "web") {
        Linking.openSettings();
      }
    }
  };

  const handleClearAll = async () => {
    await cancelAllNotifications();
  };

  if (loading) {
    return (
      <ScreenContainer className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
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
            style={[styles.permissionBanner, { backgroundColor: "#F59E0B" + "15" }]}
            activeOpacity={0.8}
          >
            <IconSymbol name="bell.fill" size={24} color="#F59E0B" />
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
          <View style={[styles.permissionBanner, { backgroundColor: "#22C55E" + "10" }]}>
            <IconSymbol name="checkmark.circle.fill" size={24} color="#22C55E" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.permissionTitle, { color: "#22C55E" }]}>Notifications activées</Text>
              {pushToken ? (
                <Text style={[styles.permissionSub, { color: colors.muted }]} numberOfLines={1}>
                  Token: {pushToken.substring(0, 30)}...
                </Text>
              ) : null}
            </View>
          </View>
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
                value={prefs[setting.key]}
                onValueChange={() => handleToggle(setting.key)}
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
});
