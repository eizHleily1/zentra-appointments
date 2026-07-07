import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { AvailableSlot } from "../lib/types";

export function SlotGrid({
  loading,
  onSelect,
  selectedStartTime,
  slots
}: {
  loading: boolean;
  onSelect: (startTime: string) => void;
  selectedStartTime: string;
  slots: AvailableSlot[];
}) {
  if (loading) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator color="#2563eb" />
        <Text style={styles.loadingText}>Loading available times…</Text>
      </View>
    );
  }

  if (slots.length === 0) {
    return <Text style={styles.empty}>No times available for this day. Try another date.</Text>;
  }

  return (
    <View style={styles.grid}>
      {slots.map((slot) => {
        const selected = slot.startTime === selectedStartTime;

        return (
          <Pressable
            key={slot.startTime}
            onPress={() => onSelect(slot.startTime)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{slot.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    marginRight: "2%",
    paddingVertical: 12,
    width: "23%"
  },
  chipSelected: {
    backgroundColor: "#eff6ff",
    borderColor: "#2563eb"
  },
  chipText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "600"
  },
  chipTextSelected: {
    color: "#1d4ed8"
  },
  empty: {
    color: "#64748b",
    marginTop: 8
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8
  },
  loadingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 8
  },
  loadingText: {
    color: "#64748b"
  }
});
