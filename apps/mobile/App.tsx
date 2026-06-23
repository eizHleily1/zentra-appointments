import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { FOUNDATION_PHASE } from "@appointment-saas/shared";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Appointment SaaS</Text>
      <Text style={styles.subtitle}>Foundation Setup Complete</Text>
      <Text style={styles.phase}>{FOUNDATION_PHASE}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  phase: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 16,
    textAlign: "center"
  },
  subtitle: {
    color: "#334155",
    fontSize: 18,
    marginTop: 8,
    textAlign: "center"
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center"
  }
});
