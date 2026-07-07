import { useEffect, useState } from "react";
import { Button, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { DAY_NAMES } from "../../lib/constants";
import { styles } from "../../lib/styles";
import type { ApiRequest, BusinessHour, RunAction } from "../../lib/types";

export function BusinessHoursScreen({
  businessId,
  onBack,
  request,
  run
}: {
  businessId: string;
  onBack: () => void;
  request: ApiRequest;
  run: RunAction;
}) {
  const [hours, setHours] = useState<BusinessHour[]>([]);

  useEffect(() => {
    void request<BusinessHour[]>(`/businesses/${businessId}/business-hours`).then(setHours);
  }, [businessId, request]);

  function updateHour(dayOfWeek: number, changes: Partial<BusinessHour>) {
    setHours((currentHours) =>
      currentHours.map((hour) => (hour.dayOfWeek === dayOfWeek ? { ...hour, ...changes } : hour))
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Business hours</Text>
      <Button title="Back" onPress={onBack} />
      {hours.map((hour) => (
        <View key={hour.dayOfWeek} style={styles.card}>
          <Text style={styles.cardTitle}>{DAY_NAMES[hour.dayOfWeek]}</Text>
          <View style={styles.row}>
            <Button
              title={hour.isClosed ? "Closed" : "Open"}
              onPress={() =>
                updateHour(hour.dayOfWeek, {
                  closeTime: hour.isClosed ? "17:00" : null,
                  isClosed: !hour.isClosed,
                  openTime: hour.isClosed ? "09:00" : null
                })
              }
            />
          </View>
          {hour.isClosed ? (
            <Text style={styles.cardMeta}>Closed all day</Text>
          ) : (
            <>
              <TextInput
                onChangeText={(openTime) => updateHour(hour.dayOfWeek, { openTime })}
                placeholder="Open (HH:MM)"
                style={styles.input}
                value={hour.openTime ?? ""}
              />
              <TextInput
                onChangeText={(closeTime) => updateHour(hour.dayOfWeek, { closeTime })}
                placeholder="Close (HH:MM)"
                style={styles.input}
                value={hour.closeTime ?? ""}
              />
            </>
          )}
        </View>
      ))}
      <Pressable
        onPress={() =>
          void run(async () => {
            await request<BusinessHour[]>(`/businesses/${businessId}/business-hours`, {
              body: JSON.stringify({
                hours: hours.map((hour) => ({
                  closeTime: hour.isClosed ? undefined : hour.closeTime,
                  dayOfWeek: hour.dayOfWeek,
                  isClosed: hour.isClosed,
                  openTime: hour.isClosed ? undefined : hour.openTime
                }))
              }),
              method: "PUT"
            });
          }, "Business hours saved")
        }
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>Save business hours</Text>
      </Pressable>
    </ScrollView>
  );
}
