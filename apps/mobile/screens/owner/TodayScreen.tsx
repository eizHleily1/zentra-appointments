import { Button, Pressable, ScrollView, Text, View } from "react-native";
import { AppointmentListCard } from "../../components/AppointmentListCard";
import { getDateKeyInTimeZone, isAppointmentOnDate, sortAppointmentsChronologically } from "../../lib/appointments";
import { formatTodayHeading } from "../../lib/formatters";
import { styles } from "../../lib/styles";
import type { Appointment, Business, PublishReadiness } from "../../lib/types";

export function TodayScreen({
  appointments,
  business,
  onBook,
  onOpenSettings,
  onSelectAppointment,
  publishReadiness,
  refreshAppointments
}: {
  appointments: Appointment[];
  business: Business;
  onBook: () => void;
  onOpenSettings: () => void;
  onSelectAppointment: (appointment: Appointment) => void;
  publishReadiness: PublishReadiness | null;
  refreshAppointments: () => Promise<void>;
}) {
  const todayKey = getDateKeyInTimeZone(new Date(), business.timezone);
  const todayAppointments = sortAppointmentsChronologically(
    appointments.filter((appointment) => isAppointmentOnDate(appointment, todayKey, business.timezone))
  );
  const completedCount = todayAppointments.filter((appointment) => appointment.status === "COMPLETED").length;
  const remainingCount = todayAppointments.filter((appointment) => appointment.status === "BOOKED").length;

  return (
    <ScrollView contentContainerStyle={styles.contentWithTabs}>
      {publishReadiness && business.status === "PENDING_ONBOARDING" ? (
        <Pressable onPress={onOpenSettings} style={styles.publishBanner}>
          <Text style={styles.publishBannerTitle}>Finish setup to appear in Explore</Text>
          <Text style={styles.publishBannerText}>
            {publishReadiness.canPublish
              ? "Everything is ready. Go live so customers can find you."
              : publishReadiness.missingSteps.join(" · ")}
          </Text>
          <Text style={styles.publishBannerLink}>Open setup checklist</Text>
        </Pressable>
      ) : null}

      <View style={styles.todayHeader}>
        <Text style={styles.todayDate}>{formatTodayHeading(business.timezone)}</Text>
        <Text style={styles.todayBusinessName}>{business.name}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{todayAppointments.length}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{remainingCount}</Text>
          <Text style={styles.statLabel}>Remaining</Text>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Today&apos;s schedule</Text>
        <Button title="Refresh" onPress={() => void refreshAppointments()} />
      </View>

      {todayAppointments.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>You have no appointments today.</Text>
          <Pressable onPress={onBook} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Book Appointment</Text>
          </Pressable>
        </View>
      ) : (
        todayAppointments.map((appointment) => (
          <AppointmentListCard
            key={appointment.id}
            appointment={appointment}
            onPress={() => onSelectAppointment(appointment)}
            timezone={business.timezone}
          />
        ))
      )}
    </ScrollView>
  );
}
