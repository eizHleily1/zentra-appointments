import { useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import { styles } from "../../lib/styles";
import type { ApiRequest, RunAction, StaffMember } from "../../lib/types";

export function StaffScreen({
  businessId,
  refresh,
  request,
  run,
  staffMembers
}: {
  businessId: string;
  refresh: () => Promise<void>;
  request: ApiRequest;
  run: RunAction;
  staffMembers: StaffMember[];
}) {
  const [selectedStaffMemberId, setSelectedStaffMemberId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [displayName, setDisplayName] = useState("");

  function useStaffMember(staffMember: StaffMember) {
    setSelectedStaffMemberId(staffMember.id);
    setDisplayName(staffMember.displayName);
  }

  return (
    <ScrollView contentContainerStyle={styles.contentWithTabs}>
      <Text style={styles.sectionTitle}>Staff</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType="email-address"
        onChangeText={setUserEmail}
        placeholder="Staff account email"
        style={styles.input}
        value={userEmail}
      />
      <TextInput onChangeText={setDisplayName} placeholder="Display name" style={styles.input} value={displayName} />
      <View style={styles.row}>
        <Button
          title="Add staff"
          onPress={() =>
            void run(async () => {
              await request<StaffMember>(`/businesses/${businessId}/staff`, {
                body: JSON.stringify({ displayName, userEmail }),
                method: "POST"
              });
              await refresh();
              setUserEmail("");
              setDisplayName("");
            }, "Staff member added")
          }
        />
        <Button
          title="Update selected"
          onPress={() =>
            void run(async () => {
              await request<StaffMember>(`/businesses/${businessId}/staff/${selectedStaffMemberId}`, {
                body: JSON.stringify({ displayName }),
                method: "PATCH"
              });
              await refresh();
            }, "Staff member updated")
          }
        />
      </View>
      {staffMembers.map((staffMember) => (
        <View key={staffMember.id} style={styles.card}>
          <Text style={styles.cardTitle}>{staffMember.displayName}</Text>
          <Text style={styles.cardMeta}>{staffMember.active ? "Active" : "Inactive"}</Text>
          <View style={styles.row}>
            <Button title="Edit" onPress={() => useStaffMember(staffMember)} />
            <Button
              title="Deactivate"
              onPress={() =>
                void run(async () => {
                  await request<StaffMember>(`/businesses/${businessId}/staff/${staffMember.id}/deactivate`, {
                    method: "POST"
                  });
                  await refresh();
                }, "Staff member deactivated")
              }
            />
          </View>
        </View>
      ))}
      {staffMembers.length === 0 ? <Text style={styles.empty}>Add your first team member above.</Text> : null}
    </ScrollView>
  );
}
