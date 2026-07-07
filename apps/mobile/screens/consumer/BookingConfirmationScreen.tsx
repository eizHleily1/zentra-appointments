import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { formatConfirmationSchedule } from "../../lib/dates";
import type { BookingConfirmationDetails } from "../../lib/types";

export function BookingConfirmationScreen({
  confirmation,
  onDone,
  onViewSchedule
}: {
  confirmation: BookingConfirmationDetails;
  onDone: () => void;
  onViewSchedule: () => void;
}) {
  const { dayLine, timeLine } = formatConfirmationSchedule(confirmation.startsAt, confirmation.timezone);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>✓</Text>
      </View>
      <Text style={styles.title}>Appointment confirmed</Text>
      <View style={styles.card}>
        <Text style={styles.businessName}>{confirmation.businessName}</Text>
        <Text style={styles.detail}>{confirmation.serviceName}</Text>
        <Text style={styles.detail}>{confirmation.staffName}</Text>
        <Text style={styles.detail}>{dayLine}</Text>
        <Text style={styles.time}>{timeLine}</Text>
      </View>
      <Pressable onPress={onViewSchedule} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>View Schedule</Text>
      </Pressable>
      <Pressable onPress={onDone} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  businessName: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "700"
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 20,
    padding: 20
  },
  content: {
    alignItems: "center",
    padding: 24
  },
  detail: {
    color: "#334155",
    fontSize: 16,
    marginTop: 8
  },
  iconCircle: {
    alignItems: "center",
    backgroundColor: "#dcfce7",
    borderRadius: 40,
    height: 80,
    justifyContent: "center",
    width: 80
  },
  iconText: {
    color: "#15803d",
    fontSize: 36,
    fontWeight: "700"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 12,
    marginTop: 24,
    paddingVertical: 14,
    width: "100%"
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    marginTop: 12,
    paddingVertical: 12,
    width: "100%"
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "600"
  },
  time: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 4
  },
  title: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16
  }
});
