import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

export function AuthPromptModal({
  onClose,
  onSubmit,
  visible
}: {
  onClose: () => void;
  onSubmit: (mode: "login" | "register", email: string, password: string) => Promise<void>;
  visible: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <Modal animationType="slide" transparent visible={visible}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.sheet}>
          <Text style={styles.title}>Sign in to book</Text>
          <Text style={styles.subtitle}>Create an account or sign in to confirm your appointment.</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            style={styles.input}
            value={email}
          />
          <TextInput
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            style={styles.input}
            value={password}
          />
          <Pressable onPress={() => void onSubmit("register", email, password)} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Create account</Text>
          </Pressable>
          <Pressable onPress={() => void onSubmit("login", email, password)} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Sign in</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.linkButton}>
            <Text style={styles.linkButtonText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    flex: 1,
    justifyContent: "flex-end"
  },
  input: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    padding: 12
  },
  linkButton: {
    alignItems: "center",
    marginTop: 12,
    padding: 8
  },
  linkButtonText: {
    color: "#64748b",
    fontWeight: "600"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    marginTop: 16,
    paddingVertical: 14
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#2563eb",
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: 14
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontSize: 16,
    fontWeight: "700"
  },
  sheet: {
    backgroundColor: "#f8fafc",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20
  },
  subtitle: {
    color: "#64748b",
    lineHeight: 20,
    marginTop: 6
  },
  title: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "700"
  }
});
