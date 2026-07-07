import { Button, Pressable, ScrollView, Text } from "react-native";
import { formatBusinessLocation, formatBusinessType } from "../../lib/formatters";
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
        <Text style={styles.empty}>No businesses found in this category yet.</Text>
      ) : (
        businesses.map((business) => {
          const locationLabel = formatBusinessLocation(business.city, business.address);

          return (
            <Pressable key={business.id} onPress={() => onSelectBusiness(business)} style={styles.card}>
              <Text style={styles.cardTitle}>{business.name}</Text>
              <Text style={styles.cardMeta}>{formatBusinessType(business.businessType)}</Text>
              {locationLabel ? <Text style={styles.cardMeta}>{locationLabel}</Text> : null}
              <Text style={styles.linkButtonText}>View</Text>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}
