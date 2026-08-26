import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { CatalogImage } from "@/components/catalog-image";
import { EventPosterCard } from "@/components/event-poster-card";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  getEventsData,
  type TCEvent,
  type EventCategory,
} from "@/lib/api/catalog";
import { prefetchCatalogImages } from "@/lib/catalog-image-prefetch";
import { useFavorites } from "@/lib/favorites-provider";
import { formatDateShort, decodeHtmlEntities } from "@/lib/format";
import {
  consumePendingCategory,
  subscribeToPendingCategory,
} from "@/lib/filter-state";
import { CATEGORY_COLOR_MAP } from "@/constants/category-colors";
import { OrganizerEventCta } from "@/components/organizer-event-cta";

export default function EventsScreen() {
  const colors = useColors();
  const router = useRouter();
  const [events, setEvents] = useState<TCEvent[]>([]);
  const [filtered, setFiltered] = useState<TCEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "week" | "month" | "upcoming"
  >("all");
  const { isFavorite, toggleFavorite } = useFavorites();

  const [pastEvents, setPastEvents] = useState<TCEvent[]>([]);

  const load = useCallback(async (forceRefresh = false) => {
    setLoadError(null);
    try {
      const { events: ev, categories: freshCats } = await getEventsData({
        forceRefresh,
      });
      // Separate active (upcoming) from past events
      const now = new Date();
      const upcoming: TCEvent[] = [];
      const past: TCEvent[] = [];
      ev.forEach((e) => {
        const dateStr = e.mobileFields?.event_date_time || e.date;
        const eventDate = new Date(dateStr.replace(" ", "T"));
        if (
          e.salesClosed === true ||
          e.isPastEvent === true ||
          e.ticketingStatus === "ended" ||
          eventDate < now
        ) {
          past.push(e);
        } else {
          upcoming.push(e);
        }
      });
      void prefetchCatalogImages(upcoming.map((event) => event.featuredImage));
      setEvents(upcoming);
      setFiltered(upcoming);
      setPastEvents(past);
      setCategories(freshCats);
    } catch {
      setLoadError(
        "Impossible de charger les événements. Vérifiez votre connexion puis réessayez.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Apply category from global filter state (when navigating from home page filter chips)
  useEffect(() => {
    if (categories.length === 0) return;
    // Check for pending category on mount
    const pending = consumePendingCategory();
    if (pending) {
      applyCategory(pending);
    }
    // Subscribe to future changes (if user navigates back and taps another chip)
    const unsub = subscribeToPendingCategory((cat) => {
      if (cat && categories.length > 0) {
        applyCategory(cat);
      } else {
        setSelectedCat(null);
      }
    });
    return unsub;
  }, [categories]);

  const applyCategory = (catName: string) => {
    const lower = catName.toLowerCase();
    const found = categories.find(
      (c) =>
        c.name.toLowerCase().includes(lower) ||
        c.slug?.toLowerCase().includes(lower),
    );
    if (found) {
      setSelectedCat(found.id);
    }
  };

  // Get only parent categories (parent === 0) for the filter chips
  const parentCategories = useMemo(() => {
    return categories.filter((c) => c.parent === 0);
  }, [categories]);

  // Get ALL descendant category IDs for a given parent (recursive)
  const getDescendantCategoryIds = useCallback(
    (parentId: number): number[] => {
      const result = [parentId];
      const findChildren = (pid: number) => {
        categories.forEach((c) => {
          if (c.parent === pid) {
            result.push(c.id);
            findChildren(c.id); // recurse into grandchildren
          }
        });
      };
      findChildren(parentId);
      return result;
    },
    [categories],
  );

  // Filter events
  useEffect(() => {
    let result = events;

    // Category filter (recursive - includes grandchildren)
    if (selectedCat) {
      const catIds = getDescendantCategoryIds(selectedCat);
      result = result.filter((e) =>
        e.event_category?.some((catId) => catIds.includes(catId)),
      );
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      result = result.filter((e) => {
        const eventDate = new Date(
          (e.mobileFields?.event_date_time || e.date).replace(" ", "T"),
        );
        switch (dateFilter) {
          case "today":
            return (
              eventDate >= today &&
              eventDate < new Date(today.getTime() + 86400000)
            );
          case "week": {
            const weekEnd = new Date(today.getTime() + 7 * 86400000);
            return eventDate >= today && eventDate < weekEnd;
          }
          case "month": {
            const monthEnd = new Date(today.getTime() + 30 * 86400000);
            return eventDate >= today && eventDate < monthEnd;
          }
          case "upcoming":
            return eventDate >= today;
          default:
            return true;
        }
      });
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        decodeHtmlEntities(e.title.rendered).toLowerCase().includes(q),
      );
    }

    setFiltered(result);
  }, [search, events, selectedCat, dateFilter, getDescendantCategoryIds]);

  const dateFilterLabel = useMemo(() => {
    switch (dateFilter) {
      case "today":
        return "Aujourd'hui";
      case "week":
        return "Cette semaine";
      case "month":
        return "Ce mois";
      case "upcoming":
        return "À venir";
      default:
        return "Date";
    }
  }, [dateFilter]);

  const dateOptions: { key: typeof dateFilter; label: string }[] = [
    { key: "all", label: "Toutes les dates" },
    { key: "today", label: "Aujourd'hui" },
    { key: "week", label: "Cette semaine" },
    { key: "month", label: "Ce mois-ci" },
    { key: "upcoming", label: "À venir" },
  ];

  const renderEvent = ({ item }: { item: TCEvent }) => {
    const name = decodeHtmlEntities(item.title.rendered);
    return (
      <View style={styles.catalogCard}>
        <EventPosterCard
          event={item}
          width="100%"
          favorite={isFavorite(item.id, "event")}
          onPress={() => router.push(`/event/${item.id}` as any)}
          onToggleFavorite={() =>
            toggleFavorite({
              id: item.id,
              type: "event",
              name,
              image: item.featuredImage,
            })
          }
        />
      </View>
    );
  };

  const activeFilterCount =
    (selectedCat ? 1 : 0) + (dateFilter !== "all" ? 1 : 0);

  return (
    <ScreenContainer edges={["left", "right"]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Événements
        </Text>
        {activeFilterCount > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSelectedCat(null);
              setDateFilter("all");
            }}
            style={[
              styles.clearFiltersBtn,
              { backgroundColor: colors.primary + "15" },
            ]}
          >
            <Text style={[styles.clearFiltersText, { color: colors.primary }]}>
              Effacer ({activeFilterCount})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View
        style={[
          styles.searchBar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
        <TextInput
          accessibilityLabel="Rechercher un événement"
          placeholder="Rechercher un événement..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          style={[styles.searchInput, { color: colors.foreground }]}
        />
      </View>

      {/* Date Filter Chips */}
      <View style={styles.dateFilterRow}>
        <TouchableOpacity
          onPress={() => setShowDateFilter(true)}
          style={[
            styles.dateChip,
            {
              backgroundColor:
                dateFilter !== "all" ? colors.primary : colors.surface,
              borderColor:
                dateFilter !== "all" ? colors.primary : colors.border,
            },
          ]}
        >
          <IconSymbol
            name="calendar"
            size={14}
            color={dateFilter !== "all" ? "#fff" : colors.muted}
          />
          <Text
            style={[
              styles.dateChipText,
              { color: dateFilter !== "all" ? "#fff" : colors.foreground },
            ]}
          >
            {dateFilterLabel}
          </Text>
          <IconSymbol
            name="chevron.right"
            size={12}
            color={dateFilter !== "all" ? "#fff" : colors.muted}
          />
        </TouchableOpacity>
      </View>

      {/* Category Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContainer}
      >
        <TouchableOpacity
          onPress={() => setSelectedCat(null)}
          style={[
            styles.chip,
            {
              backgroundColor: !selectedCat ? colors.primary : colors.surface,
              borderColor: !selectedCat ? colors.primary : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.chipText,
              { color: !selectedCat ? "#fff" : colors.foreground },
            ]}
          >
            Tous
          </Text>
        </TouchableOpacity>
        {parentCategories.map((cat) => {
          const catColor = CATEGORY_COLOR_MAP[cat.id] || colors.primary;
          const isSelected = selectedCat === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => setSelectedCat(isSelected ? null : cat.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? catColor : catColor + "18",
                  borderColor: catColor,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? "#fff" : catColor },
                ]}
              >
                {decodeHtmlEntities(cat.name)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : loadError && events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <IconSymbol
            name="exclamationmark.triangle.fill"
            size={42}
            color={colors.primary}
          />
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            {loadError}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Réessayer de charger les événements"
            onPress={() => {
              setLoading(true);
              void load(true);
            }}
            style={[styles.resetBtn, { borderColor: colors.primary }]}
          >
            <Text style={[styles.resetBtnText, { color: colors.primary }]}>
              Réessayer
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEvent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor={colors.primary}
            />
          }
          ListFooterComponent={
            <View style={styles.eventsFooter}>
              <OrganizerEventCta style={styles.organizerCta} />
              {pastEvents.length > 0 ? (
                <View style={{ marginTop: 24 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 16,
                      marginBottom: 12,
                    }}
                  >
                    <Text
                      style={[
                        styles.headerTitle,
                        { color: colors.foreground, fontSize: 18 },
                      ]}
                    >
                      Événements passés
                    </Text>
                  </View>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={pastEvents}
                    keyExtractor={(item) => String(item.id)}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                    renderItem={({ item }) => {
                      const name = decodeHtmlEntities(item.title.rendered);
                      return (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() =>
                            router.push(`/event/${item.id}` as any)
                          }
                          style={{
                            width: 220,
                            borderRadius: 14,
                            overflow: "hidden",
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <CatalogImage
                            uri={item.featuredImage}
                            style={{ width: 220, height: 120 }}
                            accessibilityLabel={`Affiche de ${name}`}
                            recyclingKey={`events-past-${item.id}`}
                          />
                          <View style={{ padding: 10 }}>
                            <Text
                              style={{
                                color: colors.foreground,
                                fontSize: 13,
                                fontWeight: "600",
                              }}
                              numberOfLines={2}
                            >
                              {name}
                            </Text>
                            <Text
                              style={{
                                color: colors.muted,
                                fontSize: 11,
                                marginTop: 4,
                              }}
                            >
                              {formatDateShort(
                                item.mobileFields?.event_date_time || item.date,
                              )}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol name="calendar" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                Aucun événement à venir
              </Text>
              {(selectedCat || dateFilter !== "all" || search) && (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCat(null);
                    setDateFilter("all");
                    setSearch("");
                  }}
                  style={[styles.resetBtn, { borderColor: colors.primary }]}
                >
                  <Text
                    style={[styles.resetBtnText, { color: colors.primary }]}
                  >
                    Réinitialiser les filtres
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Date Filter Modal */}
      <Modal
        visible={showDateFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateFilter(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowDateFilter(false)}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Filtrer par date
            </Text>
            {dateOptions.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  setDateFilter(opt.key);
                  setShowDateFilter(false);
                }}
                style={[
                  styles.modalOption,
                  {
                    backgroundColor:
                      dateFilter === opt.key
                        ? colors.primary + "15"
                        : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    {
                      color:
                        dateFilter === opt.key
                          ? colors.primary
                          : colors.foreground,
                      fontWeight: dateFilter === opt.key ? "700" : "400",
                    },
                  ]}
                >
                  {opt.label}
                </Text>
                {dateFilter === opt.key && (
                  <IconSymbol
                    name="checkmark.circle.fill"
                    size={20}
                    color={colors.primary}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  clearFiltersBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  clearFiltersText: { fontSize: 12, fontWeight: "600" },
  searchBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 15,
  },
  dateFilterRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14 },
  dateChip: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  dateChipText: { fontSize: 13, fontWeight: "600", lineHeight: 16 },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 13, fontWeight: "600", lineHeight: 16 },
  eventsFooter: { marginTop: 10, marginBottom: 40 },
  organizerCta: { marginHorizontal: 16 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  catalogCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  emptyContainer: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 15, marginTop: 12 },
  resetBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  resetBtnText: { fontSize: 13, fontWeight: "600" },
  // Date filter modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  modalOptionText: { fontSize: 15 },
});
