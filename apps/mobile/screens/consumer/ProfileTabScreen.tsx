import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

export function ProfileTabScreen({
  email,
  hasBusinesses,
  isAuthenticated,
  onManageBusinesses,
  onRecentBusiness,
  onSignIn,
  onSignOut,
  recentBusinesses
}: {
  email: string | null;
  hasBusinesses: boolean;
  isAuthenticated: boolean;
  onManageBusinesses: () => void;
  onRecentBusiness: (businessId: string) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  recentBusinesses: Array<{ id: string; name: string }>;
}) {
  if (!isAuthenticated) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your account</Text>
        <Text style={styles.subtitle}>Sign in to manage appointments, book faster, and view your booking history.</Text>
        <View style={styles.benefitsCard}>
          <Text style={styles.benefit}>• Manage appointments</Text>
          <Text style={styles.benefit}>• Faster booking</Text>
          <Text style={styles.benefit}>• View booking history</Text>
        </View>
        <Pressable onPress={onSignIn} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Create account</Text>
        </Pressable>
        <Pressable onPress={onSignIn} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sign in</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Account</Text>
        <Text style={styles.cardValue}>{email ?? "Signed in"}</Text>
      </View>

      {recentBusinesses.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Recent businesses</Text>
          {recentBusinesses.map((business) => (
            <Pressable key={business.id} onPress={() => onRecentBusiness(business.id)} style={styles.listRow}>
              <Text style={styles.listRowTitle}>{business.name}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {hasBusinesses ? (
        <Pressable onPress={onManageBusinesses} style={styles.listRow}>
          <Text style={styles.listRowTitle}>Manage your businesses</Text>
        </Pressable>
      ) : null}

      <Pressable onPress={onSignOut} style={styles.signOutButton}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  benefit: {
    color: "#334155",
    marginTop: 6
  },
  benefitsCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    padding: 16
  },
  card: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 16
  },
  cardLabel: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: "600"
  },
  cardValue: {
    color: "#0f172a",
    fontSize: 16,
    marginTop: 4
  },
  content: {
    padding: 16,
    paddingBottom: 32
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
    marginTop: 20,
    paddingVertical: 14
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#2563eb",
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 14
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "700"
  },
  sectionLabel: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 20
  },
  signOutButton: {
    alignItems: "center",
    marginTop: 24,
    padding: 12
  },
  signOutText: {
    color: "#b45309",
    fontWeight: "600"
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
