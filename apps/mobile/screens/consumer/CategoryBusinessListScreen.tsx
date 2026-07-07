import { Button, ScrollView, Text } from "react-native";
import { BusinessCard } from "../../components/BusinessCard";
import { styles } from "../../lib/styles";
import type { PublicBusinessSummary } from "../../lib/types";

export function CategoryBusinessListScreen({
  businesses,
  categoryLabel,
  onBack,
  onSelectBusiness
}: {
  businesses: PublicBusinessSummary[];
  categoryLabel: string;
  onBack: () => void;
  onSelectBusiness: (business: PublicBusinessSummary) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{categoryLabel}</Text>
      <Button title="Back" onPress={onBack} />
      {businesses.length === 0 ? (
        <Text style={styles.empty}>
          No businesses found in this category yet. Try another category or check back soon.
        </Text>
      ) : (
        businesses.map((business) => (
          <BusinessCard key={business.id} business={business} onPress={() => onSelectBusiness(business)} />
        ))
      )}
    </ScrollView>
  );
}
