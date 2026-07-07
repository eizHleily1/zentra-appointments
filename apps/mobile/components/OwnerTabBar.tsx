import { Pressable, Text, View } from "react-native";
import type { Tab } from "../lib/types";
import { styles } from "../lib/styles";

export function OwnerTabBar({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "appointments", label: "Appointments" },
    { id: "clients", label: "Clients" },
    { id: "settings", label: "Settings" }
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
