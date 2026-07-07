import { Pressable, Text, View } from "react-native";
import { getBusinessInitial } from "../lib/business-profile";
import { formatBusinessLocation, formatBusinessType } from "../lib/formatters";
import { styles } from "../lib/styles";
import type { PublicBusinessSummary } from "../lib/types";

export function BusinessCard({
  business,
  onPress
}: {
  business: PublicBusinessSummary;
  onPress: () => void;
}) {
  const locationLabel = formatBusinessLocation(business.city, business.address);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.businessCard}>
      <View style={styles.businessCardRow}>
        <View style={styles.businessAvatar}>
          <Text style={styles.businessAvatarText}>{getBusinessInitial(business.name)}</Text>
        </View>
        <View style={styles.businessCardBody}>
          <Text style={styles.cardTitle}>{business.name}</Text>
          <Text style={styles.cardMeta}>{formatBusinessType(business.businessType)}</Text>
          {locationLabel ? <Text style={styles.cardMeta}>{locationLabel}</Text> : null}
        </View>
      </View>
      <Text style={styles.businessCardHint}>View profile</Text>
    </Pressable>
  );
}
