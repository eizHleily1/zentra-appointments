import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ConsumerAppointmentCard, type ConsumerAppointmentView } from "../../components/ConsumerAppointmentCard";
import {
  filterPastConsumerAppointments,
  filterUpcomingConsumerAppointments,
  formatAppointmentDayHeading,
  groupAppointmentsByDay
} from "../../lib/schedule";
import { styles } from "../../lib/styles";
import type { ApiRequest } from "../../lib/types";
import { ConsumerAppointmentDetailScreen } from "./ConsumerAppointmentDetailScreen";

type ScheduleView = "list" | "detail";

function ScheduleSection({
  appointments,
  direction,
  onSelectAppointment
}: {
  appointments: ConsumerAppointmentView[];
  direction: "asc" | "desc";
  onSelectAppointment: (appointmentId: string) => void;
}) {
  const grouped = groupAppointmentsByDay(appointments, direction);

  return grouped.map((group) => (
    <View key={group.dateKey}>
      <Text style={styles.sectionLabel}>
        {formatAppointmentDayHeading(group.appointments[0].startsAt, group.timeZone)}
      </Text>
      {group.appointments.map((appointment) => (
        <ConsumerAppointmentCard
          key={appointment.id}
          appointment={appointment}
          onPress={() => onSelectAppointment(appointment.id)}
        />
      ))}
    </View>
  ));
}

export function ScheduleTabScreen({
  isActive,
  isAuthenticated,
  onBookAgain,
  onSignIn,
  request
}: {
  isActive: boolean;
  isAuthenticated: boolean;
  onBookAgain: (businessId: string) => void;
  onSignIn: () => void;
  request: ApiRequest;
}) {
  const [view, setView] = useState<ScheduleView>("list");
  const [appointments, setAppointments] = useState<ConsumerAppointmentView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const results = await request<ConsumerAppointmentView[]>("/me/appointments");
      setAppointments(results);
    } catch (loadError) {
      setAppointments([]);
      setError(loadError instanceof Error ? loadError.message : "Could not load schedule");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    if (isAuthenticated && isActive && view === "list") {
      void loadSchedule();
    }
  }, [isActive, isAuthenticated, loadSchedule, view]);

  const handleBackFromDetail = useCallback(() => {
    setView("list");
    setSelectedAppointmentId(null);
  }, []);

  if (!isAuthenticated) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Sign in to see your schedule</Text>
          <Text style={styles.emptyStateBody}>Your upcoming appointments will appear here once you are signed in.</Text>
        </View>
        <Pressable onPress={onSignIn} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Sign in</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (view === "detail" && selectedAppointmentId) {
    return (
      <ConsumerAppointmentDetailScreen
        appointmentId={selectedAppointmentId}
        onBack={handleBackFromDetail}
        onBookAgain={onBookAgain}
        request={request}
      />
    );
  }

  const upcoming = filterUpcomingConsumerAppointments(appointments);
  const past = filterPastConsumerAppointments(appointments);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Schedule</Text>

      {loading ? <Text style={styles.loading}>Loading your schedule...</Text> : null}

      {!loading && error ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Could not load schedule</Text>
          <Text style={styles.emptyStateBody}>{error}</Text>
          <Pressable onPress={() => void loadSchedule()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : null}

      {!loading && !error && upcoming.length === 0 && past.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No appointments yet</Text>
          <Text style={styles.emptyStateBody}>When you book, your appointments will show up here by day.</Text>
        </View>
      ) : null}

      {!loading && !error && upcoming.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          <ScheduleSection
            appointments={upcoming}
            direction="asc"
            onSelectAppointment={(appointmentId) => {
              setSelectedAppointmentId(appointmentId);
              setView("detail");
            }}
          />
        </>
      ) : null}

      {!loading && !error && upcoming.length === 0 && past.length > 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>No upcoming appointments</Text>
          <Text style={styles.emptyStateBody}>Your past appointments are listed below.</Text>
        </View>
      ) : null}

      {!loading && !error && past.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Past</Text>
          <ScheduleSection
            appointments={past}
            direction="desc"
            onSelectAppointment={(appointmentId) => {
              setSelectedAppointmentId(appointmentId);
              setView("detail");
            }}
          />
        </>
      ) : null}
    </ScrollView>
  );
}
