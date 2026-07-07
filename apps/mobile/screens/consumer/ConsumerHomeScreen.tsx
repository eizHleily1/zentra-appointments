import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ConsumerAppointmentCard } from "../../components/ConsumerAppointmentCard";
import type { ConsumerAppointmentView } from "../../components/ConsumerAppointmentCard";
import { formatAppointmentTimeRange } from "../../lib/formatters";

function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export function ConsumerHomeScreen({
  appointments,
  isAuthenticated,
  onExplore,
  onSelectRecentBusiness,
  onSignIn,
  onViewSchedule,
  recentBusinesses,
  userEmail
}: {
  appointments: ConsumerAppointmentView[];
  isAuthenticated: boolean;
  onExplore: () => void;
  onSelectRecentBusiness: (businessId: string) => void;
  onSignIn: () => void;
  onViewSchedule: () => void;
  recentBusinesses: Array<{ id: string; name: string }>;
  userEmail: string | null;
}) {
  const upcoming = appointments.filter((appointment) => appointment.status === "BOOKED").slice(0, 3);
  const nextAppointment = upcoming[0] ?? null;
  const greetingName = userEmail?.split("@")[0] ?? null;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>
        {getGreeting()}
        {greetingName ? `, ${greetingName}` : ""}
      </Text>

      {!isAuthenticated ? (
        <>
          <Text style={styles.subtitle}>Browse local businesses and book appointments in one place.</Text>
          <Pressable onPress={onExplore} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Explore businesses</Text>
          </Pressable>
          <Pressable onPress={onSignIn} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign in</Text>
          </Pressable>
        </>
      ) : nextAppointment ? (
        <>
          <Text style={styles.sectionLabel}>Up next</Text>
          <View style={styles.heroCard}>
            <Text style={styles.heroBusiness}>{nextAppointment.businessName}</Text>
            <Text style={styles.heroMeta}>
              {nextAppointment.serviceName} · {nextAppointment.staffDisplayName}
            </Text>
            <Text style={styles.heroTime}>
              {formatAppointmentTimeRange(
                nextAppointment.startsAt,
                nextAppointment.endsAt,
                nextAppointment.businessTimezone
              )}
            </Text>
          </View>

          {upcoming.length > 1 ? (
            <>
              <Text style={styles.sectionLabel}>Also coming up</Text>
              {upcoming.slice(1).map((appointment) => (
                <ConsumerAppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </>
          ) : null}

          <Pressable onPress={onViewSchedule} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>View full schedule</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>You have no upcoming appointments.</Text>
          <Pressable onPress={onExplore} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Find a business</Text>
          </Pressable>
        </>
      )}

      {recentBusinesses.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Book again</Text>
          {recentBusinesses.slice(0, 4).map((business) => (
            <Pressable key={business.id} onPress={() => onSelectRecentBusiness(business.id)} style={styles.listRow}>
              <Text style={styles.listRowTitle}>{business.name}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32
  },
  heroBusiness: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "700"
  },
  heroCard: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    padding: 16
  },
  heroMeta: {
    color: "#334155",
    marginTop: 6
  },
  heroTime: {
    color: "#1d4ed8",
    fontWeight: "700",
    marginTop: 10
  },
  linkButton: {
    marginTop: 16,
    paddingVertical: 8
  },
  linkButtonText: {
    color: "#2563eb",
    fontWeight: "700",
    textAlign: "center"
  },
  listRow: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    padding: 16
  },
  listRowTitle: {
    color: "#0f172a",
    fontWeight: "600"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 12,
    marginTop: 16,
    paddingVertical: 14
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    marginTop: 12,
    padding: 12
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontWeight: "600"
  },
  sectionLabel: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 24
  },
  subtitle: {
    color: "#64748b",
    lineHeight: 22,
    marginTop: 8
  },
  title: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "700"
  }
});
