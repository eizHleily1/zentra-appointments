import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { DateStripOption } from "../lib/dates";

export function DateStripPicker({
  onSelect,
  options,
  selectedDateKey
}: {
  onSelect: (dateKey: string) => void;
  options: DateStripOption[];
  selectedDateKey: string;
}) {
  return (
    <ScrollView horizontal contentContainerStyle={styles.row} showsHorizontalScrollIndicator={false}>
      {options.map((option) => {
        const selected = option.dateKey === selectedDateKey;

        return (
          <Pressable
            key={option.dateKey}
            onPress={() => onSelect(option.dateKey)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.weekday, selected && styles.chipTextSelected]}>{option.weekdayLabel}</Text>
            <Text style={[styles.day, selected && styles.chipTextSelected]}>{option.dayLabel}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  chipSelected: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb"
  },
  chipTextSelected: {
    color: "#ffffff"
  },
  day: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2
  },
  row: {
    paddingVertical: 4
  },
  weekday: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600"
  }
});
