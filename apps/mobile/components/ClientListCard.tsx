import { Pressable, Text, View } from "react-native";
import {
  formatAppointmentCountLabel,
  formatClientEmailLabel,
  formatClientPhoneLabel,
  formatLastAppointmentLabel
} from "../lib/formatters";
import { styles } from "../lib/styles";
import type { ClientSummary } from "../lib/types";

export function ClientListCard({
  client,
  onPress,
  timezone
}: {
  client: ClientSummary;
  onPress: () => void;
  timezone: string;
}) {
  const phoneLabel = formatClientPhoneLabel(client.phoneNumber);
  const emailLabel = formatClientEmailLabel(client.email);

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <Text style={styles.cardTitle}>{client.displayName}</Text>
      {phoneLabel ? <Text style={styles.cardMeta}>{phoneLabel}</Text> : null}
      {emailLabel ? <Text style={styles.cardMeta}>{emailLabel}</Text> : null}
      <View style={styles.cardFooterRow}>
        <Text style={styles.cardMeta}>{formatAppointmentCountLabel(client.totalAppointments)}</Text>
        <Text style={styles.cardMeta}>{formatLastAppointmentLabel(client.lastAppointmentAt, timezone)}</Text>
      </View>
    </Pressable>
  );
}
