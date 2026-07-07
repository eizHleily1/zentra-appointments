import { Button, Pressable, ScrollView, Text, View } from "react-native";
import { formatBusinessHoursSummary } from "../../lib/business-hours";
import { formatBusinessLocation, formatBusinessType, formatServicePriceLabel } from "../../lib/formatters";
import { styles } from "../../lib/styles";
import type { PublicBusinessProfile } from "../../lib/types";

export function BusinessProfileScreen({
  business,
  onBack,
  onBook
}: {
  business: PublicBusinessProfile;
  onBack: () => void;
  onBook: () => void;
}) {
  const locationLabel = formatBusinessLocation(business.city, business.address);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{business.name}</Text>
      <Button title="Back" onPress={onBack} />
      <Text style={styles.cardMeta}>{formatBusinessType(business.businessType)}</Text>
      {locationLabel ? <Text style={styles.cardMeta}>{locationLabel}</Text> : null}
      <Text style={styles.fieldLabel}>Hours</Text>
      <Text style={styles.cardMeta}>{formatBusinessHoursSummary(business.businessHours)}</Text>
      <Text style={styles.fieldLabel}>Services</Text>
      {business.services.length === 0 ? (
        <Text style={styles.empty}>No services available yet.</Text>
      ) : (
        business.services.map((service) => (
          <View key={service.id} style={styles.selectionButton}>
            <Text style={styles.selectionButtonTitle}>{service.name}</Text>
            <Text style={styles.selectionButtonMeta}>
              {service.durationMinutes} min
              {formatServicePriceLabel(service.price) ? ` · ${formatServicePriceLabel(service.price)}` : ""}
            </Text>
          </View>
        ))
      )}
      <Text style={styles.fieldLabel}>Staff</Text>
      {business.staff.length === 0 ? (
        <Text style={styles.empty}>No staff listed yet.</Text>
      ) : (
        business.staff.map((staffMember) => (
          <View key={staffMember.id} style={styles.selectionButton}>
            <Text style={styles.selectionButtonTitle}>{staffMember.displayName}</Text>
          </View>
        ))
      )}
      <Pressable onPress={onBook} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Book appointment</Text>
      </Pressable>
    </ScrollView>
  );
}
