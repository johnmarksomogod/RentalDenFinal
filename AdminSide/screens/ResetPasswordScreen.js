import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { firebaseAuth } from "../services/firebaseService";

export default function ResetPasswordScreen({ navigation }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePasswordReset = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      await firebaseAuth.updatePassword(newPassword);
      Alert.alert("Success", "Your password has been updated.", [
        {
          text: "OK",
          onPress: () => navigation.replace("Login"),
        },
      ]);
    } catch (err) {
      console.error("Unexpected reset error:", err);
      Alert.alert("Error", "Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Enter your new password to complete the reset.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={newPassword}
            onChangeText={setNewPassword}
          />

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.disabledButton]}
            onPress={handlePasswordReset}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Updating..." : "Update Password"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scrollContainer: { flexGrow: 1, justifyContent: "center", padding: 20 },
  inner: { marginTop: 60 },
  title: { fontSize: 28, fontWeight: "800", color: "white", marginBottom: 10 },
  subtitle: { fontSize: 16, color: "#9ca3af", marginBottom: 30 },
  input: {
    backgroundColor: "#111827",
    borderColor: "#374151",
    borderWidth: 2,
    borderRadius: 16,
    color: "white",
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: "white",
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "black", fontSize: 18, fontWeight: "800" },
  disabledButton: { opacity: 0.6 },
});
