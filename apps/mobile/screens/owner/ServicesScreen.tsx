import { useState } from "react";
import { Button, ScrollView, Text, TextInput, View } from "react-native";
import { formatServicePriceLabel } from "../../lib/formatters";
import { styles } from "../../lib/styles";
import type { ApiRequest, BusinessService, RunAction } from "../../lib/types";

export function ServicesScreen({
  businessId,
  refresh,
  request,
  run,
  services
}: {
  businessId: string;
  refresh: () => Promise<void>;
  request: ApiRequest;
  run: RunAction;
  services: BusinessService[];
}) {
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [price, setPrice] = useState("");

  function useService(service: BusinessService) {
    setSelectedServiceId(service.id);
    setName(service.name);
    setDescription(service.description);
    setDurationMinutes(String(service.durationMinutes));
    setPrice(formatServicePriceLabel(service.price) ?? "");
  }

  async function saveService(method: "POST" | "PATCH") {
    const path =
      method === "POST" ? `/businesses/${businessId}/services` : `/businesses/${businessId}/services/${selectedServiceId}`;
    const body: Record<string, unknown> = {
      description,
      durationMinutes: Number(durationMinutes),
      name
    };

    if (method === "PATCH") {
      body.price = price.trim() === "" ? null : Number(price);
    } else if (price.trim() !== "") {
      body.price = Number(price);
    }

    await run(async () => {
      await request<BusinessService>(path, {
        body: JSON.stringify(body),
        method
      });
      await refresh();
      setSelectedServiceId("");
    }, method === "POST" ? "Service created" : "Service updated");
  }

  return (
    <ScrollView contentContainerStyle={styles.contentWithTabs}>
      <Text style={styles.sectionTitle}>Services</Text>
      <TextInput onChangeText={setName} placeholder="Service name" style={styles.input} value={name} />
      <TextInput onChangeText={setDescription} placeholder="Description" style={styles.input} value={description} />
      <TextInput
        keyboardType="number-pad"
        onChangeText={setDurationMinutes}
        placeholder="Duration (minutes)"
        style={styles.input}
        value={durationMinutes}
      />
      <TextInput keyboardType="decimal-pad" onChangeText={setPrice} placeholder="Price (optional)" style={styles.input} value={price} />
      <View style={styles.row}>
        <Button title="Create" onPress={() => void saveService("POST")} />
        <Button title="Update selected" onPress={() => void saveService("PATCH")} />
      </View>
      {services.map((service) => (
        <View key={service.id} style={styles.card}>
          <Text style={styles.cardTitle}>{service.name}</Text>
          <Text style={styles.cardMeta}>{service.description}</Text>
          <Text style={styles.cardMeta}>
            {service.durationMinutes} min
            {formatServicePriceLabel(service.price) ? ` · ${formatServicePriceLabel(service.price)}` : ""}
          </Text>
          <Text style={styles.cardMeta}>{service.active ? "Active" : "Inactive"}</Text>
          <View style={styles.row}>
            <Button title="Edit" onPress={() => useService(service)} />
            <Button
              title="Deactivate"
              onPress={() =>
                void run(async () => {
                  await request<BusinessService>(`/businesses/${businessId}/services/${service.id}/deactivate`, {
                    method: "POST"
                  });
                  await refresh();
                }, "Service deactivated")
              }
            />
          </View>
        </View>
      ))}
      {services.length === 0 ? <Text style={styles.empty}>Add your first service above.</Text> : null}
    </ScrollView>
  );
}
