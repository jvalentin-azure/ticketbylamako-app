import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from "react-native";

import { CatalogImage } from "@/components/catalog-image";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import type { TCEvent } from "@/lib/api/catalog";
import {
  decodeHtmlEntities,
  formatAriary,
  formatDateShort,
} from "@/lib/format";

interface EventPosterCardProps {
  event: TCEvent;
  onPress: () => void;
  width?: DimensionValue;
  favorite?: boolean;
  onToggleFavorite?: () => void;
}

export function EventPosterCard({
  event,
  onPress,
  width = 252,
  favorite = false,
  onToggleFavorite,
}: EventPosterCardProps) {
  const colors = useColors();
  const title = decodeHtmlEntities(event.title.rendered);
  const category = decodeHtmlEntities(event.categoryNames?.[0] || "Événement");
  const location = event.mobileFields?.event_location?.trim();
  const date = event.mobileFields?.event_date_time || event.date;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${formatDateShort(date)}${location ? `, ${location}` : ""}`}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.94 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View style={styles.media}>
        <CatalogImage
          uri={event.featuredImage}
          style={StyleSheet.absoluteFill}
          accessibilityLabel={`Affiche de ${title}`}
          recyclingKey={`event-poster-${event.id}`}
        />
        <View style={styles.mediaShade} />
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText} numberOfLines={1}>
            {category}
          </Text>
        </View>
        {event.hasSeatingChart ? (
          <View style={styles.seatingBadge}>
            <IconSymbol name="mappin" size={11} color="#fff" />
            <Text style={styles.seatingText}>Places numérotées</Text>
          </View>
        ) : null}
        {onToggleFavorite ? (
          <Pressable
            onPress={(pressEvent) => {
              pressEvent.stopPropagation();
              onToggleFavorite();
            }}
            accessibilityRole="button"
            accessibilityLabel={
              favorite ? "Retirer des favoris" : "Ajouter aux favoris"
            }
            hitSlop={8}
            style={({ pressed }) => [
              styles.favoriteButton,
              { opacity: pressed ? 0.72 : 1 },
            ]}
          >
            <IconSymbol
              name={favorite ? "heart.fill" : "heart"}
              size={18}
              color={favorite ? "#EF4444" : "#fff"}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={[styles.date, { color: colors.primary }]}>
          {formatDateShort(date)}
        </Text>
        <Text
          style={[styles.title, { color: colors.foreground }]}
          numberOfLines={2}
        >
          {title}
        </Text>
        {location ? (
          <View style={styles.metaRow}>
            <IconSymbol name="mappin" size={13} color={colors.muted} />
            <Text
              style={[styles.location, { color: colors.muted }]}
              numberOfLines={1}
            >
              {location}
            </Text>
          </View>
        ) : null}
        <View style={styles.footer}>
          <Text style={[styles.price, { color: colors.foreground }]}>
            {event.minPrice != null
              ? event.minPrice === event.maxPrice
                ? formatAriary(event.minPrice)
                : `Dès ${formatAriary(event.minPrice)}`
              : "Voir les billets"}
          </Text>
          <IconSymbol name="chevron.right" size={16} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  media: {
    width: "100%",
    aspectRatio: 4 / 5,
    position: "relative",
    backgroundColor: "#171717",
  },
  mediaShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  categoryBadge: {
    position: "absolute",
    left: 10,
    top: 10,
    maxWidth: "70%",
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "rgba(17,19,24,0.86)",
  },
  categoryText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  seatingBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: "rgba(17,19,24,0.86)",
  },
  seatingText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  favoriteButton: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(17,19,24,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 13 },
  date: { fontSize: 12, fontWeight: "700" },
  title: { fontSize: 16, lineHeight: 21, fontWeight: "700", marginTop: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  location: { flex: 1, fontSize: 12 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  price: { fontSize: 14, fontWeight: "700" },
});
