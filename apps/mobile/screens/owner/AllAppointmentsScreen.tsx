import { Button, Pressable, ScrollView, Text, View } from "react-native";
import { sortAppointmentsChronologically } from "../../lib/appointments";
import { styles } from "../../lib/styles";
import type { ApiRequest, Appointment, RunAction } from "../../lib/types";
import { AppointmentCard } from "./AppointmentCard";

export function AllAppointmentsScreen({
  appointments,
  businessId,
  onBook,
  refreshAppointments,
  request,
  run,
  timezone
}: {
  appointments: Appointment[];
  businessId: string;
  onBook: () => void;
  refreshAppointments: () => Promise<void>;
  request: ApiRequest;
  run: RunAction;
  timezone: string;
}) {
  const sortedAppointments = sortAppointmentsChronologically(appointments);

  return (
    <ScrollView contentContainerStyle={styles.contentWithTabs}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>All appointments</Text>
        <Button title="Refresh" onPress={() => void refreshAppointments()} />
      </View>

      <Pressable onPress={onBook} style={[styles.primaryButton, styles.inlinePrimaryButton]}>
        <Text style={styles.primaryButtonText}>Book Appointment</Text>
      </Pressable>

      {sortedAppointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No appointments yet.</Text>
          <Text style={styles.emptyStateBody}>Book your first appointment to get started.</Text>
        </View>
      ) : (
        sortedAppointments.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            businessId={businessId}
            onActionComplete={refreshAppointments}
            request={request}
            run={run}
            timezone={timezone}
          />
        ))
      )}
    </ScrollView>
  );
}
