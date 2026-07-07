import { useState } from "react";
import { Button, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { BUSINESS_TYPES } from "../../lib/constants";
import { formatBusinessType } from "../../lib/formatters";
import { styles } from "../../lib/styles";

export function CreateBusinessScreen({
  createBusiness,
  onCancel
}: {
  createBusiness: (body: { businessType: string; name: string; timezone: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("BARBER");
  const [timezone, setTimezone] = useState("Asia/Jerusalem");

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Create business</Text>
      <TextInput onChangeText={setName} placeholder="Business name" style={styles.input} value={name} />
      <Text style={styles.fieldLabel}>Business type</Text>
      <View style={styles.chipRow}>
        {BUSINESS_TYPES.map((type) => (
          <Pressable
            key={type}
            onPress={() => setBusinessType(type)}
            style={[styles.chip, businessType === type && styles.chipSelected]}
          >
            <Text style={[styles.chipText, businessType === type && styles.chipTextSelected]}>
              {formatBusinessType(type)}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput onChangeText={setTimezone} placeholder="Timezone" style={styles.input} value={timezone} />
      <View style={styles.row}>
        <Button title="Cancel" onPress={onCancel} />
        <Button title="Create" onPress={() => void createBusiness({ businessType, name, timezone })} />
      </View>
    </ScrollView>
  );
}
