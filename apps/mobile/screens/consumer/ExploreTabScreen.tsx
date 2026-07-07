import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { BusinessCard } from "../../components/BusinessCard";
import { DISCOVERY_CATEGORY_OPTIONS } from "../../lib/constants";
import type { DiscoveryCategoryId, PublicBusinessSummary } from "../../lib/types";

export type { DiscoveryCategoryId };

export function ExploreTabScreen({
  businesses,
  loading,
  onSearchQueryChange,
  onSelectBusiness,
  onSelectCategory,
  searchQuery,
  selectedCategory
}: {
  businesses: PublicBusinessSummary[];
  loading: boolean;
  onSearchQueryChange: (value: string) => void;
  onSelectBusiness: (business: PublicBusinessSummary) => void;
  onSelectCategory: (category: DiscoveryCategoryId | null) => void;
  searchQuery: string;
  selectedCategory: DiscoveryCategoryId | null;
}) {
  const trimmedSearch = searchQuery.trim();
  const resultsLabel =
    trimmedSearch.length > 0
      ? `Results for "${trimmedSearch}"`
      : selectedCategory
        ? (DISCOVERY_CATEGORY_OPTIONS.find((option) => option.id === selectedCategory)?.label ?? "Businesses")
        : "All businesses";

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Explore</Text>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onSearchQueryChange}
        placeholder="Search by business name"
        returnKeyType="search"
        style={styles.searchInput}
        value={searchQuery}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
        <Pressable
          onPress={() => onSelectCategory(null)}
          style={[styles.categoryChip, selectedCategory === null && styles.categoryChipSelected]}
        >
          <Text style={[styles.categoryChipText, selectedCategory === null && styles.categoryChipTextSelected]}>All</Text>
        </Pressable>
        {DISCOVERY_CATEGORY_OPTIONS.map((category) => {
          const selected = selectedCategory === category.id;

          return (
            <Pressable
              key={category.id}
              onPress={() => onSelectCategory(category.id)}
              style={[styles.categoryChip, selected && styles.categoryChipSelected]}
            >
              <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{category.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.resultsHeader}>
        <Text style={styles.resultsLabel}>{resultsLabel}</Text>
        {loading ? <ActivityIndicator color="#2563eb" size="small" /> : null}
      </View>

      {!loading && businesses.length === 0 ? (
        <Text style={styles.empty}>
          {trimmedSearch.length > 0
            ? "No businesses match your search yet."
            : "No businesses listed here yet. Try another category or check back soon."}
        </Text>
      ) : (
        businesses.map((business) => (
          <BusinessCard key={business.id} business={business} onPress={() => onSelectBusiness(business)} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  categoryChip: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  categoryChipSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb"
  },
  categoryChipText: {
    color: "#334155",
    fontWeight: "600"
  },
  categoryChipTextSelected: {
    color: "#1d4ed8"
  },
  categoryRow: {
    marginTop: 12
  },
  content: {
    padding: 16,
    paddingBottom: 32
  },
  empty: {
    color: "#64748b",
    lineHeight: 22,
    marginTop: 16
  },
  resultsHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    marginTop: 20
  },
  resultsLabel: {
    color: "#334155",
    flex: 1,
    fontSize: 14,
    fontWeight: "700"
  },
  searchInput: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  title: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "700"
  }
});
