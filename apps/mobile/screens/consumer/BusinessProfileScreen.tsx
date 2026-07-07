import { Pressable, ScrollView, Text, View } from "react-native";
import { formatBusinessOpenStatus, formatBusinessHoursSummary } from "../../lib/business-hours";
import { getBookingUnavailableMessage, getBusinessInitial, isBusinessBookable } from "../../lib/business-profile";
import {
  formatBusinessLocation,
  formatBusinessType,
  formatServicePriceDisplay
} from "../../lib/formatters";
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
  const hoursSummary = formatBusinessHoursSummary(business.businessHours);
  const openStatus = formatBusinessOpenStatus(business.businessHours, business.timezone);
  const bookable = isBusinessBookable(business);
  const bookingUnavailableMessage = getBookingUnavailableMessage(business);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={onBack} style={styles.linkButton}>
        <Text style={styles.linkButtonText}>Back</Text>
      </Pressable>

      <View style={styles.profileHeader}>
        <View style={styles.businessAvatarLarge}>
          <Text style={styles.businessAvatarLargeText}>{getBusinessInitial(business.name)}</Text>
        </View>
        <View style={styles.profileHeaderBody}>
          <Text style={styles.sectionTitle}>{business.name}</Text>
          <Text style={styles.profileCategory}>{formatBusinessType(business.businessType)}</Text>
          {locationLabel ? <Text style={styles.profileLocation}>{locationLabel}</Text> : null}
        </View>
      </View>

      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Hours</Text>
        <Text style={styles.settingsValue}>{openStatus}</Text>
        <Text style={styles.settingsMeta}>{hoursSummary}</Text>
      </View>

      <Text style={styles.sectionLabel}>Services</Text>
      {business.services.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No services yet</Text>
          <Text style={styles.emptyStateBody}>This business has not added any services for booking yet.</Text>
        </View>
      ) : (
        business.services.map((service) => {
          const priceLabel = formatServicePriceDisplay(service.price);

          return (
            <View key={service.id} style={styles.selectionButton}>
              <Text style={styles.selectionButtonTitle}>{service.name}</Text>
              <Text style={styles.selectionButtonMeta}>
                {service.durationMinutes} min{priceLabel ? ` · ${priceLabel}` : ""}
              </Text>
            </View>
          );
        })
      )}

      <Text style={styles.sectionLabel}>Staff</Text>
      {business.staff.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No staff yet</Text>
          <Text style={styles.emptyStateBody}>This business has not added any staff for booking yet.</Text>
        </View>
      ) : (
        business.staff.map((staffMember) => (
          <View key={staffMember.id} style={styles.selectionButton}>
            <Text style={styles.selectionButtonTitle}>{staffMember.displayName}</Text>
          </View>
        ))
      )}

      {bookable ? (
        <Pressable onPress={onBook} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Book appointment</Text>
        </Pressable>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Booking not available yet</Text>
          <Text style={styles.emptyStateBody}>{bookingUnavailableMessage}</Text>
        </View>
      )}
    </ScrollView>
  );
}
