import { Button, Pressable, ScrollView, Text, View } from "react-native";
import { styles } from "../../lib/styles";
import type { Business } from "../../lib/types";

export function BusinessesScreen({
  businesses,
  formatBusinessStatus,
  formatBusinessType,
  onBack,
  onCreateBusiness,
  onRefresh,
  onSelectBusiness
}: {
  businesses: Business[];
  formatBusinessStatus: (status: string) => string;
  formatBusinessType: (businessType: string) => string;
  onBack: () => void;
  onCreateBusiness: () => void;
  onRefresh: () => void;
  onSelectBusiness: (business: Business) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Your businesses</Text>
      <Button title="Back" onPress={onBack} />
      <View style={styles.row}>
        <Button title="Refresh" onPress={onRefresh} />
        <Button title="Create business" onPress={onCreateBusiness} />
      </View>
      {businesses.map((business) => (
        <Pressable key={business.id} onPress={() => onSelectBusiness(business)} style={styles.card}>
          <Text style={styles.cardTitle}>{business.name}</Text>
          <Text style={styles.cardMeta}>{formatBusinessType(business.businessType)}</Text>
          <Text style={styles.cardMeta}>{formatBusinessStatus(business.status)}</Text>
        </Pressable>
      ))}
      {businesses.length === 0 ? <Text style={styles.empty}>Create your first business to get started.</Text> : null}
    </ScrollView>
  );
}
