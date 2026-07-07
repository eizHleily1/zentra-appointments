import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { formatBusinessStatus, formatBusinessType } from "../../lib/formatters";
import { styles } from "../../lib/styles";
import type { Business, PublishReadiness } from "../../lib/types";

export function SettingsScreen({
  business,
  onBrowse,
  onOpenBusinessHours,
  onOpenServices,
  onOpenStaff,
  onPublish,
  onSaveCity,
  onSwitchBusiness,
  publishReadiness
}: {
  business: Business;
  onBrowse: () => void;
  onOpenBusinessHours: () => void;
  onOpenServices: () => void;
  onOpenStaff: () => void;
  onPublish: () => void;
  onSaveCity: (city: string) => void;
  onSwitchBusiness: () => void;
  publishReadiness: PublishReadiness | null;
}) {
  const [cityDraft, setCityDraft] = useState(business.city ?? "");

  return (
    <ScrollView contentContainerStyle={styles.contentWithTabs}>
      <Text style={styles.sectionTitle}>Settings</Text>

      {publishReadiness && business.status === "PENDING_ONBOARDING" ? (
        <View style={styles.publishCard}>
          <Text style={styles.publishCardTitle}>Go live in Explore</Text>
          <Text style={styles.publishCardText}>
            Customers cannot discover or book your business until setup is complete and you publish.
          </Text>
          <View style={styles.checklist}>
            <Text style={publishReadiness.requirements.hasService ? styles.checklistDone : styles.checklistPending}>
              {publishReadiness.requirements.hasService ? "✓" : "○"} At least one service for booking
            </Text>
            <Text style={publishReadiness.requirements.hasStaff ? styles.checklistDone : styles.checklistPending}>
              {publishReadiness.requirements.hasStaff ? "✓" : "○"} At least one staff member for booking
            </Text>
            <Text style={publishReadiness.requirements.hasCity ? styles.checklistDone : styles.checklistPending}>
              {publishReadiness.requirements.hasCity ? "✓" : "○"} City shown on your public profile
            </Text>
          </View>
          {!publishReadiness.canPublish ? (
            <Text style={styles.publishCardText}>
              {publishReadiness.missingSteps.join(" · ")}
            </Text>
          ) : (
            <Text style={styles.publishCardText}>
              Your profile is ready. Publish to appear in Explore and accept online bookings.
            </Text>
          )}
          <Text style={styles.settingsMeta}>
            Business hours appear on your public profile. Default hours are used until you customize them.
          </Text>
          <Text style={styles.fieldLabel}>City</Text>
          <TextInput
            onChangeText={setCityDraft}
            placeholder="e.g. Amman"
            style={styles.input}
            value={cityDraft}
          />
          <Pressable onPress={() => onSaveCity(cityDraft)} style={[styles.primaryButton, styles.inlinePrimaryButton]}>
            <Text style={styles.primaryButtonText}>Save city</Text>
          </Pressable>
          <Pressable
            disabled={!publishReadiness.canPublish}
            onPress={onPublish}
            style={[styles.primaryButton, !publishReadiness.canPublish && styles.primaryButtonDisabled]}
          >
            <Text style={styles.primaryButtonText}>Publish business</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.settingsCard}>
        <Text style={styles.settingsLabel}>Business</Text>
        <Text style={styles.settingsValue}>{business.name}</Text>
        <Text style={styles.settingsMeta}>{formatBusinessType(business.businessType)}</Text>
        <Text style={styles.settingsMeta}>Status: {formatBusinessStatus(business.status)}</Text>
        <Text style={styles.settingsMeta}>Timezone: {business.timezone.replaceAll("_", " ")}</Text>
      </View>

      <Pressable onPress={onBrowse} style={styles.settingsAction}>
        <Text style={styles.settingsActionText}>Browse businesses</Text>
      </Pressable>

      <Pressable onPress={onOpenBusinessHours} style={styles.settingsAction}>
        <Text style={styles.settingsActionText}>Business hours</Text>
      </Pressable>

      <Pressable onPress={onOpenServices} style={styles.settingsAction}>
        <Text style={styles.settingsActionText}>Services</Text>
      </Pressable>

      <Pressable onPress={onOpenStaff} style={styles.settingsAction}>
        <Text style={styles.settingsActionText}>Staff</Text>
      </Pressable>

      <Pressable onPress={onSwitchBusiness} style={styles.settingsAction}>
        <Text style={styles.settingsActionText}>Switch business</Text>
      </Pressable>
    </ScrollView>
  );
}
