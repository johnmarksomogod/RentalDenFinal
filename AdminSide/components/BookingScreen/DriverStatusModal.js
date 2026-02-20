"use strict";

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { systemSettingsService } from "../../services/firebaseService";

export default function DriverStatusModal({
  visible,
  onClose,
  onSubmit,
  mode,
  booking,
}) {
  const now = new Date();
  const defaultTime = now.toTimeString().slice(0, 5);
  const [startTime, setStartTime] = useState(defaultTime);
  const [startFuel, setStartFuel] = useState("");
  const [paymentAtStart, setPaymentAtStart] = useState("");
  const [notes, setNotes] = useState("");
  const [endTime, setEndTime] = useState(defaultTime);
  const [endFuel, setEndFuel] = useState("");
  const [paymentAtEnd, setPaymentAtEnd] = useState("");
  const [remarks, setRemarks] = useState("");
  const [settings, setSettings] = useState({ fuel_price_per_liter: 0, delay_fee_per_hour: 0 });

  useEffect(() => {
    if (visible) systemSettingsService.get().then(setSettings).catch(() => {});
  }, [visible]);

  const isOngoing = mode === "ongoing";

  const handleSubmit = () => {
    if (isOngoing) {
      if (!startFuel.trim()) {
        Alert.alert("Required", "Please enter start fuel level.");
        return;
      }
      onSubmit({
        status: "ongoing",
        start_time: new Date().toISOString(),
        start_fuel: parseFloat(startFuel) || 0,
        payment_at_start: parseFloat(paymentAtStart) || 0,
        driver_notes: notes.trim() || null,
      });
    } else {
      if (!endFuel.trim()) {
        Alert.alert("Required", "Please enter end fuel level.");
        return;
      }
      const fuelPrice = settings.fuel_price_per_liter || 0;
      const delayFeePerHour = settings.delay_fee_per_hour || 0;
      const startF = Number(booking?.start_fuel) || 0;
      const endF = parseFloat(endFuel) || 0;
      const fuelUsed = startF - endF;
      const fuelCharge = fuelUsed > 0 ? fuelUsed * fuelPrice : 0;
      const expectedReturn = booking?.rental_end_date ? new Date(booking.rental_end_date) : null;
      const actualReturn = new Date();
      let delayHours = 0;
      if (expectedReturn && actualReturn > expectedReturn) {
        delayHours = (actualReturn - expectedReturn) / (1000 * 60 * 60);
      }
      const delayFee = delayHours * delayFeePerHour;
      onSubmit({
        status: "completed",
        end_time: new Date().toISOString(),
        end_fuel: endF,
        payment_at_end: parseFloat(paymentAtEnd) || 0,
        driver_remarks: remarks.trim() || null,
        fuel_charge: fuelCharge,
        delay_fee: delayFee,
        delay_hours: delayHours,
      });
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {isOngoing ? "Start trip" : "Complete trip"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.body}>
            {isOngoing ? (
              <>
                <Text style={styles.label}>Start time</Text>
                <TextInput
                  style={styles.input}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="HH:mm"
                  placeholderTextColor="#9ca3af"
                />
                <Text style={styles.label}>Start fuel level (L) *</Text>
                <TextInput
                  style={styles.input}
                  value={startFuel}
                  onChangeText={setStartFuel}
                  placeholder="e.g. 45"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.label}>Payment received (₱)</Text>
                <TextInput
                  style={styles.input}
                  value={paymentAtStart}
                  onChangeText={setPaymentAtStart}
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.label}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.notes]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notes..."
                  placeholderTextColor="#9ca3af"
                  multiline
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>End / return time</Text>
                <TextInput
                  style={styles.input}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="HH:mm"
                  placeholderTextColor="#9ca3af"
                />
                <Text style={styles.label}>End fuel level (L) *</Text>
                <TextInput
                  style={styles.input}
                  value={endFuel}
                  onChangeText={setEndFuel}
                  placeholder="e.g. 30"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.label}>Additional payment (₱)</Text>
                <TextInput
                  style={styles.input}
                  value={paymentAtEnd}
                  onChangeText={setPaymentAtEnd}
                  placeholder="0"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.label}>Remarks (optional)</Text>
                <TextInput
                  style={[styles.input, styles.notes]}
                  value={remarks}
                  onChangeText={setRemarks}
                  placeholder="Remarks..."
                  placeholderTextColor="#9ca3af"
                  multiline
                />
              </>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitText}>{isOngoing ? "Start trip" : "Complete trip"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  box: { backgroundColor: "#fff", borderRadius: 16, maxHeight: "85%" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#eee" },
  title: { fontSize: 18, fontWeight: "700", color: "#111" },
  body: { padding: 20, maxHeight: 400 },
  label: { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  notes: { minHeight: 60, textAlignVertical: "top" },
  footer: { flexDirection: "row", padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: "#eee" },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: "#f3f4f6", alignItems: "center" },
  cancelText: { fontWeight: "600", color: "#374151" },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: "#222", alignItems: "center" },
  submitText: { fontWeight: "600", color: "#fff" },
});
