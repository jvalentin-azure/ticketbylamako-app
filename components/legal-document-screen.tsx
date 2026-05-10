import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export interface LegalSection {
  title: string;
  body: string;
}

export function LegalDocumentScreen({ title, updatedAt, sections }: { title: string; updatedAt: string; sections: LegalSection[] }) {
  const colors = useColors();
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.surface }]}>
          <IconSymbol name="chevron.left" size={20} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontSize: 14, marginLeft: 4 }}>Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{title}</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={[styles.lastUpdated, { color: colors.muted }]}>{updatedAt}</Text>
        {sections.map((section, index) => (
          <View key={section.title} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{index + 1}. {section.title}</Text>
            <Text style={[styles.paragraph, { color: colors.foreground }]}>{section.body}</Text>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  backButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", paddingHorizontal: 8 },
  content: { padding: 20 },
  lastUpdated: { fontSize: 12, marginBottom: 20 },
  section: { marginBottom: 18 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  paragraph: { fontSize: 14, lineHeight: 22 },
});
