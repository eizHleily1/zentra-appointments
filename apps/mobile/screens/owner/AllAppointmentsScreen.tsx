import { Button, Pressable, ScrollView, Text, View } from "react-native";
import { AppointmentListCard } from "../../components/AppointmentListCard";
import { sortAppointmentsChronologically } from "../../lib/appointments";
import { styles } from "../../lib/styles";
import type { Appointment } from "../../lib/types";

export function AllAppointmentsScreen({
  appointments,
  onBook,
  onSelectAppointment,
  refreshAppointments,
  timezone
}: {
  appointments: Appointment[];
  onBook: () => void;
  onSelectAppointment: (appointment: Appointment) => void;
  refreshAppointments: () => Promise<void>;
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
          <AppointmentListCard
            key={appointment.id}
            appointment={appointment}
            onPress={() => onSelectAppointment(appointment)}
            timezone={timezone}
          />
        ))
      )}
    </ScrollView>
  );
}
