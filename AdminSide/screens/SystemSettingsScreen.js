"use strict";

import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { systemSettingsService, getRoleSync } from "../services/firebaseService";
import ActionModal from "../components/AlertModal/ActionModal";

// ── Fuel type categories with icons and colors ────────────────────────────────
export const FUEL_CATEGORIES = [
  { key: "gasoline",      label: "Gasoline",       icon: "flame-outline",  color: "#f59e0b", bg: "#fef3c7" },
  { key: "diesel",        label: "Diesel",          icon: "water-outline",  color: "#0ea5e9", bg: "#e0f2fe" },
  { key: "electric",      label: "Electric",        icon: "flash-outline",  color: "#3b82f6", bg: "#dbeafe" },
  { key: "hybrid",        label: "Hybrid",          icon: "leaf-outline",   color: "#16a34a", bg: "#dcfce7" },
  { key: "plugin_hybrid", label: "Plug-in Hybrid",  icon: "leaf-outline",   color: "#059669", bg: "#d1fae5" },
  { key: "cng",           label: "CNG",             icon: "cloud-outline",  color: "#8b5cf6", bg: "#ede9fe" },
  { key: "lpg",           label: "LPG",             icon: "beaker-outline", color: "#f97316", bg: "#ffedd5" },
];

export const DEFAULT_FUEL_PRICES = {
  gasoline: 65, diesel: 60, electric: 0, hybrid: 55,
  plugin_hybrid: 50, cng: 45, lpg: 40,
};

// Helper: get fuel category key from a fuel_type string (as stored in vehicles)
export const getFuelCategoryKey = (fuelTypeString) => {
  if (!fuelTypeString) return "gasoline";
  const f = fuelTypeString.toLowerCase();
  if (f.includes("electric"))                         return "electric";
  if (f.includes("plug"))                             return "plugin_hybrid";
  if (f.includes("hybrid"))                           return "hybrid";
  if (f.includes("diesel"))                           return "diesel";
  if (f.includes("cng") || f.includes("compressed"))  return "cng";
  if (f.includes("lpg") || f.includes("liquefied"))   return "lpg";
  return "gasoline";
};

// Helper: get price per liter for a booking's vehicle fuel type
export const getFuelPriceForBooking = (booking, systemSettings) => {
  const fuelType = booking?.vehicles?.fuel_type || "gasoline";
  const key      = getFuelCategoryKey(fuelType);
  const prices   = systemSettings?.fuel_prices_per_liter || {};
  return Number(prices[key] ?? DEFAULT_FUEL_PRICES[key] ?? 65);
};

export default function SystemSettingsScreen({ navigation }) {
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [delayFee, setDelayFee] = useState("");
  const [deliveryFeePerKm, setDeliveryFeePerKm] = useState("");
  const [fuelPrices, setFuelPrices] = useState(
    Object.fromEntries(FUEL_CATEGORIES.map(c => [c.key, String(DEFAULT_FUEL_PRICES[c.key])]))
  );
  const [feedback, setFeedback] = useState({ visible: false, type: "success", message: "" });

  useEffect(() => {
    if (getRoleSync() !== "owner") { navigation.goBack(); return; }
    systemSettingsService
      .get()
      .then((s) => {
        setDelayFee(String(s?.delay_fee_per_hour ?? ""));
        setDeliveryFeePerKm(String(s?.delivery_fee_per_km ?? ""));
        const legacy = s?.fuel_price_per_liter ?? 65;
        const saved  = s?.fuel_prices_per_liter || {};
        const merged = {};
        FUEL_CATEGORIES.forEach(({ key }) => {
          merged[key] = String(saved[key] ?? (key === "gasoline" ? legacy : DEFAULT_FUEL_PRICES[key]));
        });
        setFuelPrices(merged);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [navigation]);

  const updateFuelPrice = (key, val) =>
    setFuelPrices(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const fuelPricesNumeric = {};
      FUEL_CATEGORIES.forEach(({ key }) => {
        fuelPricesNumeric[key] = parseFloat(fuelPrices[key]) || 0;
      });
      await systemSettingsService.upsert({
        fuel_price_per_liter:  fuelPricesNumeric.gasoline, // legacy compat
        fuel_prices_per_liter: fuelPricesNumeric,
        delay_fee_per_hour:    parseFloat(delayFee) || 0,
        delivery_fee_per_km:   parseFloat(deliveryFeePerKm) || 0,
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

        <Text style={styles.pageTitle}>System Settings</Text>
        <Text style={styles.pageSubtitle}>Configure rates used in driver delivery calculations.</Text>

        {/* ── Fuel Prices Per Type ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Ionicons name="flame" size={18} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Fuel Rates by Type</Text>
              <Text style={styles.sectionDesc}>
                Set price per liter for each fuel type. Set Electric to ₱0 for no fuel charge.
              </Text>
            </View>
          </View>

          <View style={styles.fuelFormulaBox}>
            <Ionicons name="information-circle-outline" size={14} color="#6b7280" />
            <Text style={styles.fuelFormulaHint}>
              Charge formula: shortfall% × 0.5L × rate per liter
            </Text>
          </View>

          {FUEL_CATEGORIES.map(({ key, label, icon, color, bg }) => {
            const val = fuelPrices[key];
            const num = parseFloat(val) || 0;
            return (
              <View key={key} style={styles.fuelRow}>
                <View style={[styles.fuelIcon, { backgroundColor: bg }]}>
                  <Ionicons name={icon} size={16} color={color} />
                </View>
                <View style={styles.fuelLabelWrap}>
                  <Text style={styles.fuelLabel}>{label}</Text>
                  {num > 0 ? (
                    <Text style={[styles.fuelExample, { color }]}>
                      10% shortfall ≈ ₱{(5 * num).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </Text>
                  ) : (
                    <Text style={styles.fuelNoCharge}>No fuel charge</Text>
                  )}
                </View>
                <View style={styles.fuelInputWrap}>
                  <Text style={styles.fuelInputPrefix}>₱</Text>
                  <TextInput
                    style={styles.fuelInput}
                    value={val}
                    onChangeText={v => updateFuelPrice(key, v)}
                    placeholder="0"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.fuelInputSuffix}>/L</Text>
                </View>
              </View>
            );
          })}
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
            km driven × this rate = delivery fee. Driver can override before submitting.
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
            Applied at retrieval. Delay hours × this rate = delay charge.
          </Text>
        </View>

        {/* ── Preview ── */}
        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>📊 Rate Preview</Text>
          {FUEL_CATEGORIES.map(({ key, label, icon, color }) => {
            const num = parseFloat(fuelPrices[key]) || 0;
            if (num === 0) return null;
            return (
              <View key={key} style={styles.previewRow}>
                <View style={styles.previewLeft}>
                  <Ionicons name={icon} size={12} color={color} style={{ marginRight: 5 }} />
                  <Text style={styles.previewL}>{label} — 10% shortfall (5L)</Text>
                </View>
                <Text style={styles.previewV}>
                  ₱{(5 * num).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </Text>
              </View>
            );
          })}
          {deliveryFeePerKm ? (
            <View style={styles.previewRow}>
              <View style={styles.previewLeft}>
                <Ionicons name="car-outline" size={12} color="#7c3aed" style={{ marginRight: 5 }} />
                <Text style={styles.previewL}>30 km delivery</Text>
              </View>
              <Text style={styles.previewV}>
                ₱{(30 * (parseFloat(deliveryFeePerKm) || 0)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ) : null}
          {delayFee ? (
            <View style={styles.previewRow}>
              <View style={styles.previewLeft}>
                <Ionicons name="time-outline" size={12} color="#db2777" style={{ marginRight: 5 }} />
                <Text style={styles.previewL}>2 hour delay</Text>
              </View>
              <Text style={styles.previewV}>
                ₱{(2 * (parseFloat(delayFee) || 0)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </Text>
            </View>
          ) : null}
        </View>

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
  sectionIcon:  { width: 36, height: 36, borderRadius: 10, backgroundColor: "#fef3c7", justifyContent: "center", alignItems: "center", flexShrink: 0 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  sectionDesc:  { fontSize: 12, color: "#6b7280", marginTop: 2 },

  fuelFormulaBox:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f9fafb", borderRadius: 8, padding: 10, marginBottom: 12 },
  fuelFormulaHint: { fontSize: 12, color: "#6b7280", flex: 1 },

  fuelRow:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  fuelIcon:      { width: 34, height: 34, borderRadius: 8, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  fuelLabelWrap: { flex: 1 },
  fuelLabel:     { fontSize: 14, fontWeight: "600", color: "#111827" },
  fuelExample:   { fontSize: 11, marginTop: 2, fontWeight: "500" },
  fuelNoCharge:  { fontSize: 11, marginTop: 2, color: "#9ca3af" },
  fuelInputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, overflow: "hidden", backgroundColor: "#f9fafb" },
  fuelInputPrefix:{ paddingHorizontal: 8, fontSize: 14, color: "#6b7280", fontWeight: "600", backgroundColor: "#f3f4f6", paddingVertical: 9 },
  fuelInput:     { width: 60, fontSize: 14, color: "#111827", paddingHorizontal: 6, paddingVertical: 9, textAlign: "center" },
  fuelInputSuffix:{ paddingHorizontal: 6, fontSize: 12, color: "#9ca3af" },

  label:  { fontSize: 11, fontWeight: "700", color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  input:  { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: "#111827", backgroundColor: "#f9fafb", marginBottom: 10 },
  hint:   { fontSize: 12, color: "#9ca3af", lineHeight: 18 },

  previewBox:   { backgroundColor: "#f0fdf4", borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#86efac" },
  previewTitle: { fontSize: 13, fontWeight: "700", color: "#166534", marginBottom: 10 },
  previewRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  previewLeft:  { flexDirection: "row", alignItems: "center", flex: 1 },
  previewL:     { fontSize: 13, color: "#374151" },
  previewV:     { fontSize: 13, fontWeight: "700", color: "#059669" },

  saveBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#111827", paddingVertical: 15, borderRadius: 12, marginTop: 4 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: "#fff", fontWeight: "700", fontSize: 16 },
});