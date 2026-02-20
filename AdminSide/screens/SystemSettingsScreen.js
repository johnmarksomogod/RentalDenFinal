"use strict";

import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { systemSettingsService, getRoleSync } from "../services/firebaseService";
import ActionModal from "../components/AlertModal/ActionModal";

export default function SystemSettingsScreen({ navigation }) {
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [fuelPrice, setFuelPrice] = useState("");
  const [delayFee, setDelayFee]   = useState("");
  const [deliveryFeePerKm, setDeliveryFeePerKm] = useState("");
  const [feedback, setFeedback]   = useState({ visible: false, type: "success", message: "" });

  useEffect(() => {
    if (getRoleSync() !== "owner") { navigation.goBack(); return; }
    systemSettingsService
      .get()
      .then((s) => {
        setFuelPrice(String(s?.fuel_price_per_liter ?? ""));
        setDelayFee(String(s?.delay_fee_per_hour ?? ""));
        setDeliveryFeePerKm(String(s?.delivery_fee_per_km ?? ""));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigation]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await systemSettingsService.upsert({
        fuel_price_per_liter: parseFloat(fuelPrice) || 0,
        delay_fee_per_hour:   parseFloat(delayFee) || 0,
        delivery_fee_per_km:  parseFloat(deliveryFeePerKm) || 0,
      });
      setFeedback({ visible: true, type: "success", message: "Settings saved successfully." });
    } catch (e) {
      setFeedback({ visible: true, type: "error", message: e?.message || "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>

        {/* ── Header ── */}
        <Text style={styles.pageTitle}>System Settings</Text>
        <Text style={styles.pageSubtitle}>Configure rates used in driver delivery calculations.</Text>

        {/* ── Fuel ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="flame" size={18} color="#d97706" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Fuel Rate</Text>
              <Text style={styles.sectionDesc}>Price per liter used to charge fuel shortfalls.</Text>
            </View>
          </View>
          <Text style={styles.label}>Fuel Price per Liter (₱)</Text>
          <TextInput
            style={styles.input}
            value={fuelPrice}
            onChangeText={setFuelPrice}
            placeholder="e.g. 65"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />
          <Text style={styles.hint}>
            Each 1% of fuel = 0.5 liters. Shortfall = (departure % − return %) × 0.5L × this rate.
          </Text>
        </View>

        {/* ── Delivery Fee per KM ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#ede9fe" }]}>
              <Ionicons name="car" size={18} color="#7c3aed" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Delivery Fee Rate</Text>
              <Text style={styles.sectionDesc}>Auto-calculates delivery fee based on km driven.</Text>
            </View>
          </View>
          <Text style={styles.label}>Delivery Fee per Kilometer (₱)</Text>
          <TextInput
            style={styles.input}
            value={deliveryFeePerKm}
            onChangeText={setDeliveryFeePerKm}
            placeholder="e.g. 20"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />
          <Text style={styles.hint}>
            When driver enters km driven at delivery, the fee is auto-computed as: km × this rate.
            Driver can still override the final amount before submitting.
          </Text>
        </View>

        {/* ── Delay Fee ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: "#fce7f3" }]}>
              <Ionicons name="time" size={18} color="#db2777" />
            </View>
            <View>
              <Text style={styles.sectionTitle}>Delay / Overtime Rate</Text>
              <Text style={styles.sectionDesc}>Charged per hour when customer returns car late.</Text>
            </View>
          </View>
          <Text style={styles.label}>Delay Fee per Hour (₱)</Text>
          <TextInput
            style={styles.input}
            value={delayFee}
            onChangeText={setDelayFee}
            placeholder="e.g. 100"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />
          <Text style={styles.hint}>
            Applied at retrieval. Delay hours × this rate = delay charge added to final settlement.
          </Text>
        </View>

        {/* ── Preview ── */}
        {(fuelPrice || deliveryFeePerKm || delayFee) ? (
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>📊 Rate Preview</Text>
            {fuelPrice ? (
              <View style={styles.previewRow}>
                <Text style={styles.previewL}>10% fuel shortfall (5L)</Text>
                <Text style={styles.previewV}>₱{(5 * (parseFloat(fuelPrice) || 0)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</Text>
              </View>
            ) : null}
            {deliveryFeePerKm ? (
              <View style={styles.previewRow}>
                <Text style={styles.previewL}>30 km delivery</Text>
                <Text style={styles.previewV}>₱{(30 * (parseFloat(deliveryFeePerKm) || 0)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</Text>
              </View>
            ) : null}
            {delayFee ? (
              <View style={styles.previewRow}>
                <Text style={styles.previewL}>2 hour delay</Text>
                <Text style={styles.previewV}>₱{(2 * (parseFloat(delayFee) || 0)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <>
                <Ionicons name="checkmark-circle" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Save Settings</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>

      <ActionModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.type === "success" ? "Saved!" : "Error"}
        message={feedback.message}
        confirmText="OK"
        onClose={() => setFeedback({ ...feedback, visible: false })}
        onConfirm={() => setFeedback({ ...feedback, visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#f9fafb" },
  centered:     { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll:       { flex: 1 },
  scrollContent:{ padding: 20, paddingBottom: 40 },

  pageTitle:    { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 4 },
  pageSubtitle: { fontSize: 14, color: "#6b7280", marginBottom: 24 },

  section:      { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  sectionHeader:{ flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  sectionIcon:  { width: 36, height: 36, borderRadius: 10, backgroundColor: "#fef3c7", justifyContent: "center", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  sectionDesc:  { fontSize: 12, color: "#6b7280", marginTop: 2 },

  label:  { fontSize: 11, fontWeight: "700", color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  input:  { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: "#111827", backgroundColor: "#f9fafb", marginBottom: 10 },
  hint:   { fontSize: 12, color: "#9ca3af", lineHeight: 18 },

  previewBox:   { backgroundColor: "#f0fdf4", borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#86efac" },
  previewTitle: { fontSize: 13, fontWeight: "700", color: "#166534", marginBottom: 10 },
  previewRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  previewL:     { fontSize: 13, color: "#374151" },
  previewV:     { fontSize: 13, fontWeight: "700", color: "#059669" },

  saveBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#111827", paddingVertical: 15, borderRadius: 12, marginTop: 4 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: "#fff", fontWeight: "700", fontSize: 16 },
});