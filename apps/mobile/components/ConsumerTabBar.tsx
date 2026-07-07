import { Pressable, StyleSheet, Text, View } from "react-native";

export type ConsumerTab = "home" | "explore" | "schedule" | "profile";

export function ConsumerTabBar({
  activeTab,
  onChange
}: {
  activeTab: ConsumerTab;
  onChange: (tab: ConsumerTab) => void;
}) {
  const tabs: Array<{ id: ConsumerTab; label: string }> = [
    { id: "home", label: "Home" },
    { id: "explore", label: "Explore" },
    { id: "schedule", label: "Schedule" },
    { id: "profile", label: "Profile" }
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.id}
          onPress={() => onChange(tab.id)}
          style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
        >
          <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: "#ffffff",
    borderTopColor: "#e2e8f0",
    borderTopWidth: 1,
    flexDirection: "row"
  },
  tabButton: {
    alignItems: "center",
    flex: 1,
    paddingVertical: 12
  },
  tabButtonActive: {
    borderTopColor: "#2563eb",
    borderTopWidth: 2
  },
  tabLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "600"
  },
  tabLabelActive: {
    color: "#2563eb"
  }
});
