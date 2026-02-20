"use strict";
import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, RefreshControl, Alert, SafeAreaView,
  FlatList, KeyboardAvoidingView, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { bookingsService, firebaseAuth, systemSettingsService } from "../services/firebaseService";
import ActionModal from "../components/AlertModal/ActionModal";

const fmt     = (v) => `₱${parseFloat(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

const STATUS_COLOR = {
  pending:   "#f59e0b",
  confirmed: "#3b82f6",
  ongoing:   "#8b5cf6",
  delivered: "#ec4899",
  retrieved: "#06b6d4",
  completed: "#10b981",
  cancelled: "#ef4444",
  declined:  "#f97316",
};

// ─── LabeledInput ─────────────────────────────────────────────────────────────
const LabeledInput = ({ label, value, onChangeText, keyboardType = "default", placeholder, prefix, multiline, hint }) => (
  <View style={s.fieldGroup}>
    <Text style={s.fieldLabel}>{label}</Text>
    <View style={[s.fieldRow, multiline && { alignItems: "flex-start" }]}>
      {prefix ? <Text style={s.fieldPrefix}>{prefix}</Text> : null}
      <TextInput
        style={[s.fieldInput, prefix && { paddingLeft: 4 }, multiline && { height: 80, textAlignVertical: "top", paddingTop: 10 }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder || "0"}
        placeholderTextColor="#9ca3af"
        multiline={multiline}
      />
    </View>
    {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
  </View>
);

// ─── FuelGauge ────────────────────────────────────────────────────────────────
const FuelGauge = ({ level, label }) => {
  const pct   = Math.max(0, Math.min(100, Number(level) || 0));
  const color = pct > 50 ? "#10b981" : pct > 25 ? "#f59e0b" : "#ef4444";
  return (
    <View style={s.gaugeWrap}>
      <Text style={s.gaugeLabel}>{label}</Text>
      <View style={s.gaugeTrack}>
        <View style={[s.gaugeFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[s.gaugePct, { color }]}>{pct}%</Text>
    </View>
  );
};

// ─── PaymentLog ───────────────────────────────────────────────────────────────
const PaymentLog = ({ log = [] }) => {
  if (!log.length) return null;
  const total = log.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  return (
    <View style={s.logWrap}>
      <Text style={s.logTitle}>Money I Collected</Text>
      {log.map((e, i) => (
        <View key={i} style={s.logRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.logEvent}>{e.event}</Text>
            <Text style={s.logTime}>{e.recorded_at ? new Date(e.recorded_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</Text>
          </View>
          <Text style={s.logAmount}>{fmt(e.amount)}</Text>
        </View>
      ))}
      <View style={s.logTotalRow}>
        <Text style={s.logTotalLabel}>Total I Collected</Text>
        <Text style={s.logTotalValue}>{fmt(total)}</Text>
      </View>
    </View>
  );
};

// ─── DriverTimeline ───────────────────────────────────────────────────────────
const DriverTimeline = ({ status }) => {
  const steps  = ["confirmed", "ongoing", "delivered", "retrieved", "completed"];
  const icons  = ["checkmark-circle", "car", "location", "return-up-back", "flag"];
  const labels = ["Confirmed", "Ongoing", "Delivered", "Retrieved", "Completed"];
  const cur    = steps.indexOf(status);
  return (
    <View style={s.tlWrap}>
      {steps.map((step, i) => {
        const done = cur >= i; const current = cur === i;
        return (
          <View key={step} style={s.tlStep}>
            {i > 0 && <View style={[s.tlLine, done && s.tlLineDone]} />}
            <View style={[s.tlDot, done && s.tlDotDone, current && s.tlDotCurrent]}>
              <Ionicons name={icons[i]} size={13} color={done ? "#fff" : "#9ca3af"} />
            </View>
            <Text style={[s.tlLabel, done && s.tlLabelDone, current && s.tlLabelCurrent]}>{labels[i]}</Text>
          </View>
        );
      })}
    </View>
  );
};

// ─── OngoingModal (confirmed → ongoing) ───────────────────────────────────────
const OngoingModal = ({ visible, booking, onClose, onSubmit, loading }) => {
  const [fuelBefore, setFuelBefore] = useState("");
  const [partial, setPartial]       = useState("");

  useEffect(() => {
    if (visible) { setFuelBefore(""); setPartial(""); }
  }, [visible]);

  const submit = () => {
    const f = Number(fuelBefore);
    if (!fuelBefore || isNaN(f) || f < 0 || f > 100) {
      Alert.alert("Required", "Enter current fuel level (0–100%)."); return;
    }
    onSubmit({ fuel_before: f, partial_payment_delivery: Number(partial) || 0 });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalBg}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>🚗 Start Delivery</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#222" /></TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Customer</Text>
              <Text style={s.infoValue}>{booking?.customer_name}</Text>
              <Text style={s.infoLabel}>License No.</Text>
              <Text style={s.infoValue}>{booking?.license_number || "—"}</Text>
              <Text style={s.infoLabel}>Deliver to</Text>
              <Text style={s.infoValue}>{booking?.delivery_address || booking?.pickup_location || "—"}</Text>
              <Text style={s.infoLabel}>Vehicle</Text>
              <Text style={s.infoValue}>{[booking?.vehicles?.year, booking?.vehicles?.make, booking?.vehicles?.model].filter(Boolean).join(" ")}</Text>
              <Text style={s.infoLabel}>Plate</Text>
              <Text style={s.infoValue}>{booking?.vehicle_variants?.plate_number || "—"}</Text>
            </View>

            <View style={s.noteBox}>
              <Ionicons name="information-circle-outline" size={16} color="#374151" />
              <Text style={s.noteText}>
                📋 <Text style={{ fontWeight: "700" }}>Note only — no charge yet.</Text>{"\n"}
                Record the fuel level before departure. Fuel counting starts when the car is{" "}
                <Text style={{ fontWeight: "700" }}>delivered to the customer</Text>.
              </Text>
            </View>

            <LabeledInput
              label="Fuel Level Before Departure (%)"
              value={fuelBefore}
              onChangeText={setFuelBefore}
              keyboardType="numeric"
              placeholder="e.g. 80"
              hint="Driver reference only."
            />
            <FuelGauge level={fuelBefore} label="Current Fuel Level" />

            <Text style={s.sectionHdr}>💳 Partial Payment (Optional)</Text>
            <LabeledInput label="Partial Payment Collected" value={partial} onChangeText={setPartial} keyboardType="decimal-pad" prefix="₱" placeholder="0" />

            <TouchableOpacity style={[s.submitBtn, loading && s.submitBtnOff]} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Confirm — Start Delivery</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── DeliveredModal (ongoing → delivered) ─────────────────────────────────────
const DeliveredModal = ({ visible, booking, systemSettings, onClose, onSubmit, loading }) => {
  const [fuelAtDelivery, setFuelAtDelivery] = useState("");
  const [kmDriven, setKmDriven]             = useState("");
  const [deliveryFee, setDeliveryFee]       = useState("");
  const [partial, setPartial]               = useState("");
  const [notes, setNotes]                   = useState("");

  const feePerKm = Number(systemSettings?.delivery_fee_per_km) || 0;

  useEffect(() => {
    if (visible) {
      setFuelAtDelivery(""); setKmDriven(""); setDeliveryFee(""); setPartial(""); setNotes("");
    }
  }, [visible]);

  useEffect(() => {
    const km = Number(kmDriven);
    if (km > 0 && feePerKm > 0) setDeliveryFee(String((km * feePerKm).toFixed(2)));
  }, [kmDriven, feePerKm]);

  const fuelAtDeliveryNum = Number(fuelAtDelivery) || 0;
  const fuelBefore        = Number(booking?.fuel_before || 0);
  const driverUsedPct     = Math.max(0, fuelBefore - fuelAtDeliveryNum);

  const submit = () => {
    const f = Number(fuelAtDelivery);
    if (!fuelAtDelivery || isNaN(f) || f < 0 || f > 100) {
      Alert.alert("Required", "Enter the fuel level when handing the car to the customer (0–100%)."); return;
    }
    onSubmit({
      fuel_at_delivery:           f,
      km_driven_to_delivery:      Number(kmDriven) || 0,
      delivery_fee_paid:          Number(deliveryFee) || 0,
      partial_payment_on_arrival: Number(partial) || 0,
      delivery_notes:             notes,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalBg}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>📦 Car Delivered</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#222" /></TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Customer</Text>
              <Text style={s.infoValue}>{booking?.customer_name}</Text>
              <Text style={s.infoLabel}>License No.</Text>
              <Text style={s.infoValue}>{booking?.license_number || "—"}</Text>
              <Text style={s.infoLabel}>Location</Text>
              <Text style={s.infoValue}>{booking?.delivery_address || booking?.pickup_location || "—"}</Text>
              <Text style={s.infoLabel}>Vehicle</Text>
              <Text style={s.infoValue}>{[booking?.vehicles?.year, booking?.vehicles?.make, booking?.vehicles?.model].filter(Boolean).join(" ")}</Text>
              <Text style={s.infoLabel}>Plate</Text>
              <Text style={s.infoValue}>{booking?.vehicle_variants?.plate_number || "—"}</Text>
            </View>

            {booking?.fuel_before !== undefined && (
              <View style={{ marginBottom: 4 }}>
                <FuelGauge level={booking.fuel_before} label={`Fuel at Departure — ${booking.fuel_before}% (driver ref)`} />
              </View>
            )}

            <Text style={s.sectionHdr}>⛽ Fuel at Delivery — Customer Charge Starts Here</Text>
            <View style={s.noteBox}>
              <Ionicons name="flame-outline" size={16} color="#d97706" />
              <Text style={s.noteText}>
                <Text style={{ fontWeight: "700" }}>Record the fuel level when handing the car to the customer.</Text>{"\n"}
                This is the start of the customer's fuel responsibility.
              </Text>
            </View>

            <LabeledInput label="Fuel Level at Delivery (%)" value={fuelAtDelivery} onChangeText={setFuelAtDelivery} keyboardType="numeric" placeholder="e.g. 75" hint="⚠ This becomes the customer's fuel baseline." />
            {fuelAtDelivery ? <FuelGauge level={fuelAtDelivery} label="Fuel Given to Customer" /> : null}

            {fuelAtDelivery && booking?.fuel_before !== undefined && (
              <View style={driverUsedPct > 0 ? s.driverUsedBox : s.driverUsedBoxGood}>
                <Ionicons name={driverUsedPct > 0 ? "car-outline" : "checkmark-circle-outline"} size={14} color={driverUsedPct > 0 ? "#92400e" : "#059669"} />
                <Text style={[s.driverUsedTxt, { color: driverUsedPct > 0 ? "#92400e" : "#059669" }]}>
                  {driverUsedPct > 0
                    ? `Driver used ${driverUsedPct}% fuel during delivery trip (${booking.fuel_before}% → ${fuelAtDeliveryNum}%). Not charged to customer.`
                    : `Fuel maintained during delivery trip (${booking.fuel_before}% → ${fuelAtDeliveryNum}%).`}
                </Text>
              </View>
            )}

            <Text style={s.sectionHdr}>🚗 Delivery Fee (by Distance)</Text>
            <View style={s.noteBox}>
              <Ionicons name="information-circle-outline" size={16} color="#7c3aed" />
              <Text style={s.noteText}>
                <Text style={{ fontWeight: "700" }}>⚠ Important:</Text> Delivery fee is <Text style={{ fontWeight: "700" }}>NOT collected now</Text>.{"\n"}
                It will be part of the <Text style={{ fontWeight: "700" }}>final payment when you retrieve the car</Text>.
              </Text>
            </View>

            {feePerKm > 0 ? (
              <View style={s.rateBox}>
                <Ionicons name="speedometer-outline" size={14} color="#7c3aed" />
                <Text style={s.rateBoxTxt}>Rate: <Text style={{ fontWeight: "700" }}>{fmt(feePerKm)}/km</Text> — fee is auto-computed.</Text>
              </View>
            ) : (
              <View style={[s.rateBox, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
                <Ionicons name="warning-outline" size={14} color="#d97706" />
                <Text style={[s.rateBoxTxt, { color: "#92400e" }]}>No per-km rate set in System Settings — enter delivery fee manually.</Text>
              </View>
            )}

            <LabeledInput label="Kilometers Driven to Customer" value={kmDriven} onChangeText={setKmDriven} keyboardType="numeric" placeholder="e.g. 15" hint={feePerKm > 0 ? `Auto-fills delivery fee at ₱${feePerKm}/km` : ""} />
            <LabeledInput
              label="Delivery Fee (For Calculation Only)"
              value={deliveryFee}
              onChangeText={setDeliveryFee}
              keyboardType="decimal-pad"
              prefix="₱"
              placeholder="0"
              hint={kmDriven && feePerKm > 0 ? `${kmDriven} km × ₱${feePerKm}/km = ₱${(Number(kmDriven) * feePerKm).toFixed(2)} — Will be collected at retrieval` : "Enter manually or set km above. Will be collected at retrieval."}
            />

            <Text style={s.sectionHdr}>💳 Payments at Delivery</Text>
            <LabeledInput label="Partial Payment on Arrival (optional)" value={partial} onChangeText={setPartial} keyboardType="decimal-pad" prefix="₱" placeholder="0" />

            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Delivery Notes (optional)</Text>
              <TextInput style={[s.fieldInput, { height: 80, textAlignVertical: "top", paddingTop: 10 }]} value={notes} onChangeText={setNotes} multiline placeholder="Any remarks on delivery..." placeholderTextColor="#9ca3af" />
            </View>

            <TouchableOpacity style={[s.submitBtn, loading && s.submitBtnOff]} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Confirm — Car Delivered</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── RetrievedModal (delivered → retrieved) ───────────────────────────────────
const RetrievedModal = ({ visible, booking, systemSettings, onClose, onSubmit, loading }) => {
  const [fuelAfter, setFuelAfter]     = useState("");
  const [delayHours, setDelayHours]   = useState("0");
  const [damageFee, setDamageFee]     = useState("0");
  const [damageNotes, setDamageNotes] = useState("");
  const [pickupFee, setPickupFee]     = useState("0");
  const [finalPay, setFinalPay]       = useState("");
  const [notes, setNotes]             = useState("");

  useEffect(() => {
    if (visible) {
      setFuelAfter(""); setDelayHours("0"); setDamageFee("0");
      setDamageNotes(""); setPickupFee("0"); setFinalPay(""); setNotes("");
    }
  }, [visible]);

  const fuelPrice      = Number(systemSettings?.fuel_price_per_liter) || 65;
  const delayFeePerHr  = Number(systemSettings?.delay_fee_per_hour)   || 100;
  const LITERS_PER_PCT = 0.5;

  const fuelAtDelivery = Number(booking?.fuel_at_delivery ?? booking?.fuel_before ?? 0);
  const fuelAfterNum   = Number(fuelAfter) || 0;
  const fuelDiff       = Math.max(0, fuelAtDelivery - fuelAfterNum);
  const fuelCharge     = fuelDiff > 0 ? fuelDiff * LITERS_PER_PCT * fuelPrice : 0;

  const delayCharge  = Number(delayHours) * delayFeePerHr;
  const damageCharge = Number(damageFee) || 0;
  const pickupCharge = Number(pickupFee) || 0;

  // ── Grand total computation ───────────────────────────────────────────────
  const rentalPrice       = Number(booking?.total_price || 0);
  const deliveryFeeAmount = Number(booking?.delivery_fee || 0);
  const alreadyPaid       = (booking?.payment_log || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const grandTotal        = rentalPrice + deliveryFeeAmount + fuelCharge + delayCharge + damageCharge + pickupCharge;
  const remainingBalance  = grandTotal - alreadyPaid;

  const submit = () => {
    const f = Number(fuelAfter);
    if (!fuelAfter || isNaN(f) || f < 0 || f > 100) {
      Alert.alert("Required", "Enter fuel level when the car was returned (0–100%)."); return;
    }
    onSubmit({
      fuel_after:           f,
      fuel_shortfall_pct:   fuelDiff,
      fuel_charge:          fuelCharge,
      delay_hours:          Number(delayHours) || 0,
      delay_charge:         delayCharge,
      damage_fee:           damageCharge,
      damage_notes:         damageNotes,
      pickup_fee:           pickupCharge,
      final_payment:        Number(finalPay) || 0,
      retrieval_notes:      notes,
      extra_charges_total:  fuelCharge + delayCharge + damageCharge,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.modalBg}>
        <View style={s.modalCard}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>🔁 Car Retrieved</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#222" /></TouchableOpacity>
          </View>
          <ScrollView style={s.modalBody} showsVerticalScrollIndicator={false}>

            {/* ── Booking info ── */}
            <View style={s.infoBox}>
              <Text style={s.infoLabel}>Customer</Text>
              <Text style={s.infoValue}>{booking?.customer_name}</Text>
              <Text style={s.infoLabel}>License No.</Text>
              <Text style={s.infoValue}>{booking?.license_number || "—"}</Text>
              <Text style={s.infoLabel}>Rental Period</Text>
              <Text style={s.infoValue}>{fmtDate(booking?.rental_start_date)} → {fmtDate(booking?.rental_end_date)}</Text>
              <Text style={s.infoLabel}>Vehicle</Text>
              <Text style={s.infoValue}>{[booking?.vehicles?.year, booking?.vehicles?.make, booking?.vehicles?.model].filter(Boolean).join(" ")}</Text>
              <Text style={s.infoLabel}>Plate</Text>
              <Text style={s.infoValue}>{booking?.vehicle_variants?.plate_number || "—"}</Text>
              <Text style={s.infoLabel}>Rental Price</Text>
              <Text style={s.infoValue}>{fmt(booking?.total_price)}</Text>
            </View>

            {/* ── Fuel check ── */}
            <Text style={s.sectionHdr}>⛽ Fuel Check</Text>
            <View style={s.noteBox}>
              <Ionicons name="information-circle-outline" size={16} color="#374151" />
              <Text style={s.noteText}>
                <Text style={{ fontWeight: "700" }}>Customer fuel shortfall</Text> is measured from:{"\n"}
                <Text style={{ color: "#7c3aed", fontWeight: "700" }}>Given to customer: {fuelAtDelivery}%</Text>
                {"  →  "}
                <Text style={{ fontWeight: "700" }}>Returned by customer: ?%</Text>
              </Text>
            </View>

            <View style={s.threeGauges}>
              {booking?.fuel_before !== undefined && (
                <View style={s.gaugeCol}>
                  <FuelGauge level={booking.fuel_before} label="At Departure" />
                  <Text style={s.gaugeNote}>Driver ref.</Text>
                </View>
              )}
              <View style={s.gaugeCol}>
                <FuelGauge level={fuelAtDelivery} label="Given to Customer" />
                <Text style={[s.gaugeNote, { color: "#7c3aed", fontWeight: "700" }]}>Charge start ▼</Text>
              </View>
              <View style={s.gaugeCol}>
                <FuelGauge level={fuelAfter} label="Returned" />
                <Text style={[s.gaugeNote, { color: "#059669", fontWeight: "700" }]}>Charge end ▼</Text>
              </View>
            </View>

            <LabeledInput
              label="Fuel Level When Returned by Customer (%)"
              value={fuelAfter}
              onChangeText={setFuelAfter}
              keyboardType="numeric"
              placeholder="e.g. 60"
              hint={`Shortfall = ${fuelAtDelivery}% (given) − returned%`}
            />

            {fuelAfter ? (
              fuelDiff > 0 ? (
                <View style={s.chargeBox}>
                  <View style={s.chargeRow}><Text style={s.chargeL}>Given to customer</Text><Text style={s.chargeV}>{fuelAtDelivery}%</Text></View>
                  <View style={s.chargeRow}><Text style={s.chargeL}>Returned by customer</Text><Text style={s.chargeV}>{fuelAfterNum}%</Text></View>
                  <View style={s.chargeRow}><Text style={s.chargeL}>Shortfall → Liters</Text><Text style={s.chargeV}>{fuelDiff}% → {(fuelDiff * LITERS_PER_PCT).toFixed(1)}L</Text></View>
                  <View style={s.chargeRow}><Text style={s.chargeL}>Fuel Price</Text><Text style={s.chargeV}>{fmt(fuelPrice)}/L</Text></View>
                  <View style={[s.chargeRow, s.chargeTotalRow]}><Text style={s.chargeTL}>Fuel Charge (Customer Pays)</Text><Text style={s.chargeTV}>{fmt(fuelCharge)}</Text></View>
                </View>
              ) : (
                <View style={[s.chargeBox, { backgroundColor: "#f0fdf4", borderColor: "#86efac" }]}>
                  <Text style={{ fontSize: 13, color: "#059669", fontWeight: "600" }}>✓ No fuel shortfall — customer returned sufficient fuel ({fuelAfterNum}% ≥ {fuelAtDelivery}%).</Text>
                </View>
              )
            ) : null}

            {/* ── Delay ── */}
            <Text style={s.sectionHdr}>⏰ Delay / Overtime</Text>
            <LabeledInput label={`Delay Hours (${fmt(delayFeePerHr)}/hr)`} value={delayHours} onChangeText={setDelayHours} keyboardType="numeric" placeholder="0" />
            {Number(delayHours) > 0 && (
              <View style={s.chargeBox}>
                <View style={s.chargeRow}><Text style={s.chargeL}>Delay Hours</Text><Text style={s.chargeV}>{delayHours} hrs</Text></View>
                <View style={[s.chargeRow, s.chargeTotalRow]}><Text style={s.chargeTL}>Delay Charge</Text><Text style={s.chargeTV}>{fmt(delayCharge)}</Text></View>
              </View>
            )}

            {/* ── Damage ── */}
            <Text style={s.sectionHdr}>🔧 Damage / Other Fees</Text>
            <LabeledInput label="Damage / Other Fees" value={damageFee} onChangeText={setDamageFee} keyboardType="decimal-pad" prefix="₱" placeholder="0" />
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Damage Notes</Text>
              <TextInput style={[s.fieldInput, { height: 70, textAlignVertical: "top", paddingTop: 10 }]} value={damageNotes} onChangeText={setDamageNotes} multiline placeholder="Describe any damage..." placeholderTextColor="#9ca3af" />
            </View>

            {/* ── Pickup fee ── */}
            <Text style={s.sectionHdr}>🚗 Pickup Fee (You Collect)</Text>
            <LabeledInput label="Pickup / Retrieval Fee" value={pickupFee} onChangeText={setPickupFee} keyboardType="decimal-pad" prefix="₱" placeholder="0" />

            {/* ═══════════════════════════════════════════════════════════════
                GRAND TOTAL COST LABEL — shows full breakdown before collecting
            ════════════════════════════════════════════════════════════════ */}
            <Text style={s.sectionHdr}>💰 Total Cost Summary</Text>

            <View style={s.grandTotalCard}>
              {/* Header */}
              <View style={s.grandTotalHeader}>
                <Ionicons name="receipt-outline" size={16} color="#6b7280" />
                <Text style={s.grandTotalHeaderTxt}>Total Amount Due from Customer</Text>
              </View>

              {/* Line items */}
              <View style={s.grandTotalBody}>
                <View style={s.grandTotalRow}>
                  <Text style={s.grandTotalL}>Rental Price</Text>
                  <Text style={s.grandTotalV}>{fmt(rentalPrice)}</Text>
                </View>

                {deliveryFeeAmount > 0 && (
                  <View style={s.grandTotalRow}>
                    <Text style={s.grandTotalL}>Delivery Fee</Text>
                    <Text style={s.grandTotalV}>{fmt(deliveryFeeAmount)}</Text>
                  </View>
                )}

                {fuelCharge > 0 && (
                  <View style={s.grandTotalRow}>
                    <Text style={s.grandTotalL}>Fuel Charge ({fuelDiff}% shortfall)</Text>
                    <Text style={s.grandTotalV}>{fmt(fuelCharge)}</Text>
                  </View>
                )}

                {delayCharge > 0 && (
                  <View style={s.grandTotalRow}>
                    <Text style={s.grandTotalL}>Delay Charge ({delayHours} hrs)</Text>
                    <Text style={s.grandTotalV}>{fmt(delayCharge)}</Text>
                  </View>
                )}

                {damageCharge > 0 && (
                  <View style={s.grandTotalRow}>
                    <Text style={s.grandTotalL}>Damage Fee</Text>
                    <Text style={s.grandTotalV}>{fmt(damageCharge)}</Text>
                  </View>
                )}

                {pickupCharge > 0 && (
                  <View style={s.grandTotalRow}>
                    <Text style={s.grandTotalL}>Pickup Fee</Text>
                    <Text style={s.grandTotalV}>{fmt(pickupCharge)}</Text>
                  </View>
                )}

                {/* Grand total divider */}
                <View style={s.grandTotalDivider} />
                <View style={s.grandTotalRow}>
                  <Text style={s.grandTotalSumL}>GRAND TOTAL</Text>
                  <Text style={s.grandTotalSumV}>{fmt(grandTotal)}</Text>
                </View>
              </View>

              {/* Already paid */}
              {alreadyPaid > 0 && (
                <View style={s.grandTotalAlreadyPaid}>
                  <View style={s.grandTotalRow}>
                    <Text style={s.grandTotalPaidL}>Already Collected</Text>
                    <Text style={s.grandTotalPaidV}>− {fmt(alreadyPaid)}</Text>
                  </View>
                  {(booking?.payment_log || []).map((p, i) => (
                    <View key={i} style={[s.grandTotalRow, { paddingLeft: 12 }]}>
                      <Text style={s.grandTotalPaidDetail}>{p.event}</Text>
                      <Text style={s.grandTotalPaidDetail}>{fmt(p.amount)}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Balance to collect — the big number */}
              <View style={s.grandTotalBalance}>
                <Text style={s.grandTotalBalanceLabel}>💵 COLLECT FROM CUSTOMER</Text>
                <Text style={s.grandTotalBalanceValue}>{fmt(remainingBalance < 0 ? 0 : remainingBalance)}</Text>
                {remainingBalance < 0 && (
                  <Text style={s.grandTotalOverpaid}>Customer overpaid by {fmt(Math.abs(remainingBalance))}</Text>
                )}
              </View>
            </View>

            {/* ── Final payment input ── */}
            <LabeledInput
              label="Final Payment Collected from Customer"
              value={finalPay}
              onChangeText={setFinalPay}
              keyboardType="decimal-pad"
              prefix="₱"
              placeholder={remainingBalance > 0 ? String(remainingBalance.toFixed(2)) : "0"}
              hint={`Suggested amount: ${fmt(remainingBalance < 0 ? 0 : remainingBalance)}`}
            />

            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Retrieval Notes (optional)</Text>
              <TextInput style={[s.fieldInput, { height: 80, textAlignVertical: "top", paddingTop: 10 }]} value={notes} onChangeText={setNotes} multiline placeholder="Any remarks on retrieval..." placeholderTextColor="#9ca3af" />
            </View>

            <TouchableOpacity style={[s.submitBtn, loading && s.submitBtnOff]} onPress={submit} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Confirm — Car Retrieved</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── BookingCard ──────────────────────────────────────────────────────────────
const BookingCard = ({ booking, onAction, isMyBooking }) => {
  const status      = booking.status || "pending";
  const color       = STATUS_COLOR[status] || "#6b7280";
  const vehicleLine = [booking.vehicles?.year, booking.vehicles?.make, booking.vehicles?.model].filter(Boolean).join(" ");
  const totalPaid   = (booking.payment_log || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);
  const driverStatuses = ["confirmed", "ongoing", "delivered", "retrieved", "completed"];

  return (
    <View style={[s.card, { borderLeftColor: color }, !isMyBooking && s.cardMuted]}>
      {isMyBooking ? (
        <View style={s.myBadge}>
          <Ionicons name="person-circle" size={12} color="#065f46" />
          <Text style={s.myBadgeTxt}>Your assignment</Text>
        </View>
      ) : (
        <View style={s.viewOnly}>
          <Ionicons name="eye-outline" size={12} color="#6b7280" />
          <Text style={s.viewOnlyTxt}>View only — {booking.assigned_driver || "another driver"}</Text>
        </View>
      )}

      <View style={s.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardName}>{booking.customer_name || "—"}</Text>
          {vehicleLine ? <Text style={s.cardVehicle}>{vehicleLine}{booking.vehicles?.type ? ` · ${booking.vehicles.type}` : ""}</Text> : null}
          <View style={s.pillRow}>
            {booking.vehicle_variants?.plate_number && (
              <View style={s.pill}>
                <Ionicons name="car-outline" size={11} color="#374151" />
                <Text style={s.pillTxt}>{booking.vehicle_variants.plate_number}</Text>
              </View>
            )}
            {booking.license_number && (
              <View style={s.pill}>
                <Ionicons name="id-card-outline" size={11} color="#6b7280" />
                <Text style={s.pillTxt}>Lic: {booking.license_number}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={[s.statusPill, { backgroundColor: color + "22" }]}>
          <Text style={[s.statusPillTxt, { color }]}>{status}</Text>
        </View>
      </View>

      <View style={s.row}><Ionicons name="calendar-outline" size={13} color="#6b7280" /><Text style={s.rowTxt}>{fmtDate(booking.rental_start_date)} → {fmtDate(booking.rental_end_date)}</Text></View>
      <View style={s.row}><Ionicons name="location-outline" size={13} color="#db2777" /><Text style={[s.rowTxt, { color: "#db2777" }]}>{booking.delivery_address || booking.pickup_location || "—"}</Text></View>
      <View style={s.row}><Ionicons name="cash-outline" size={13} color="#6b7280" /><Text style={s.rowTxt}>{fmt(booking.total_price)}</Text></View>

      <View style={s.driverBadge}>
        <Ionicons name="person-circle-outline" size={14} color="#374151" />
        {booking.assigned_driver
          ? <Text style={s.driverBadgeTxt}>Driver: <Text style={s.driverName}>{booking.assigned_driver}</Text>{isMyBooking ? "  (You)" : ""}</Text>
          : <Text style={s.noDriver}>No driver assigned</Text>}
      </View>

      {(booking.fuel_before !== undefined || booking.fuel_at_delivery !== undefined || booking.fuel_after !== undefined) && (
        <View style={s.twoCol}>
          {booking.fuel_before     !== undefined && <View style={{ flex: 1 }}><FuelGauge level={booking.fuel_before}     label="Departure" /></View>}
          {booking.fuel_at_delivery !== undefined && <View style={{ flex: 1 }}><FuelGauge level={booking.fuel_at_delivery} label="Given to Customer" /></View>}
          {booking.fuel_after       !== undefined && <View style={{ flex: 1 }}><FuelGauge level={booking.fuel_after}       label="Returned" /></View>}
        </View>
      )}

      {booking.km_driven_to_delivery > 0 && (
        <View style={s.row}>
          <Ionicons name="speedometer-outline" size={13} color="#6b7280" />
          <Text style={s.rowTxt}>{booking.km_driven_to_delivery} km driven to delivery</Text>
        </View>
      )}

      {(booking.fuel_charge > 0 || booking.delay_charge > 0 || booking.damage_fee > 0) && (
        <View style={s.chargePillRow}>
          {booking.fuel_charge  > 0 && <View style={s.cpill}><Text style={s.cpillTxt}>⛽ {fmt(booking.fuel_charge)}</Text></View>}
          {booking.delay_charge > 0 && <View style={[s.cpill, { backgroundColor: "#fce7f3" }]}><Text style={[s.cpillTxt, { color: "#db2777" }]}>⏰ {fmt(booking.delay_charge)}</Text></View>}
          {booking.damage_fee   > 0 && <View style={[s.cpill, { backgroundColor: "#fee2e2" }]}><Text style={[s.cpillTxt, { color: "#b91c1c" }]}>🔧 {fmt(booking.damage_fee)}</Text></View>}
        </View>
      )}

      {driverStatuses.includes(status) && <DriverTimeline status={status} />}
      <PaymentLog log={booking.payment_log || []} />

      {totalPaid > 0 && (
        <View style={s.totalPaidRow}>
          <Text style={s.totalPaidL}>Total I Collected</Text>
          <Text style={s.totalPaidV}>{fmt(totalPaid)}</Text>
        </View>
      )}

      {isMyBooking && (
        <>
          {status === "confirmed" && (
            <TouchableOpacity style={s.actBtn} onPress={() => onAction("ongoing", booking)}>
              <Ionicons name="car" size={16} color="#fff" />
              <Text style={s.actBtnTxt}>Start Delivery → Mark Ongoing</Text>
            </TouchableOpacity>
          )}
          {status === "ongoing" && (
            <TouchableOpacity style={s.actBtn} onPress={() => onAction("delivered", booking)}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={s.actBtnTxt}>Car Delivered to Customer</Text>
            </TouchableOpacity>
          )}
          {status === "delivered" && (
            <TouchableOpacity style={s.actBtn} onPress={() => onAction("retrieved", booking)}>
              <Ionicons name="refresh-circle" size={16} color="#fff" />
              <Text style={s.actBtnTxt}>Car Retrieved — File Report</Text>
            </TouchableOpacity>
          )}
          {status === "retrieved" && (
            <TouchableOpacity style={s.actBtn} onPress={() => onAction("completed", booking)}>
              <Ionicons name="flag" size={16} color="#fff" />
              <Text style={s.actBtnTxt}>Mark as Completed</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DriverDashboardScreen({ navigation }) {
  const [allBookings, setAllBookings]       = useState([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [systemSettings, setSystemSettings] = useState(null);
  const [activeModal, setActiveModal]       = useState(null);
  const [targetBooking, setTargetBooking]   = useState(null);
  const [submitting, setSubmitting]         = useState(false);
  const [feedback, setFeedback]             = useState({ visible: false, type: "success", message: "" });
  const [actionModal, setActionModal]       = useState(null);
  const [filterStatus, setFilterStatus]     = useState("all");

  const currentUser = firebaseAuth.getCurrentUser();
  const driverName  = currentUser?.displayName || currentUser?.email || "";

  const isMine = useCallback((b) => {
    if (!currentUser) return false;
    const myEmail = (currentUser.email || "").toLowerCase().trim();
    const myName  = (currentUser.displayName || "").toLowerCase().trim();
    if (b.assigned_driver_email && b.assigned_driver_email.toLowerCase().trim() === myEmail) return true;
    const assigned = (b.assigned_driver || "").toLowerCase().trim();
    if (!assigned) return false;
    if (assigned === myEmail) return true;
    if (myName && assigned === myName) return true;
    if (myName && assigned.includes(myName)) return true;
    if (myName && myName.includes(assigned)) return true;
    if (assigned.includes("@") && assigned === myEmail) return true;
    return false;
  }, [currentUser]);

  const fetchData = useCallback(async () => {
    try {
      const [bookingsData, settings] = await Promise.all([
        typeof bookingsService.listAllWithDetails === "function"
          ? bookingsService.listAllWithDetails()
          : bookingsService.listWithDetails(),
        systemSettingsService.get(),
      ]);
      setAllBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setSystemSettings(settings);
    } catch (err) {
      console.error("DriverDashboard fetch error:", err);
      setAllBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = (action, booking) => {
    if (!isMine(booking)) return;
    if (action === "completed") {
      setActionModal({ title: "Complete Booking", message: "Mark this booking as fully completed?", onConfirm: () => applyUpdate(booking.id, { status: "completed" }) });
      return;
    }
    setTargetBooking(booking);
    setActiveModal(action);
  };

  const applyUpdate = async (bookingId, payload) => {
    setSubmitting(true);
    try {
      const now      = new Date().toISOString();
      const existing = allBookings.find(b => b.id === bookingId);
      const prevLog  = existing?.payment_log || [];
      let logEntries = [];
      let up         = { ...payload, updated_at: now };

      if (payload.status === "ongoing") {
        up.fuel_before = payload.fuel_before;
        if (payload.partial_payment_delivery > 0)
          logEntries.push({ event: "Partial Payment (Departure)", amount: payload.partial_payment_delivery, recorded_at: now });
      }

      if (payload.status === "delivered") {
        up.fuel_at_delivery      = payload.fuel_at_delivery;
        up.km_driven_to_delivery = payload.km_driven_to_delivery;
        up.delivery_fee          = payload.delivery_fee_paid;
        up.delivery_notes        = payload.delivery_notes;
        if (payload.partial_payment_on_arrival > 0) {
          up.partial_payment_on_arrival = payload.partial_payment_on_arrival;
          logEntries.push({ event: "Partial Payment (On Arrival)", amount: payload.partial_payment_on_arrival, recorded_at: now });
        }
      }

      if (payload.status === "retrieved") {
        Object.assign(up, {
          fuel_after:          payload.fuel_after,
          fuel_shortfall_pct:  payload.fuel_shortfall_pct,
          fuel_charge:         payload.fuel_charge,
          delay_hours:         payload.delay_hours,
          delay_charge:        payload.delay_charge,
          damage_fee:          payload.damage_fee,
          damage_notes:        payload.damage_notes,
          pickup_fee:          payload.pickup_fee,
          final_payment:       payload.final_payment,
          retrieval_notes:     payload.retrieval_notes,
          extra_charges_total: payload.extra_charges_total,
        });
        const deliveryFeeAmount         = Number(existing?.delivery_fee || 0);
        const deliveryFeeAlreadyLogged  = prevLog.some(e => e.event?.includes("Delivery Fee"));
        if (deliveryFeeAmount > 0 && !deliveryFeeAlreadyLogged) {
          const kmDriven = existing?.km_driven_to_delivery || 0;
          logEntries.push({ event: `Delivery Fee (${kmDriven} km)`, amount: deliveryFeeAmount, recorded_at: now });
        }
        if (payload.fuel_charge   > 0) logEntries.push({ event: `Fuel Shortfall (${payload.fuel_shortfall_pct}%)`, amount: payload.fuel_charge,   recorded_at: now });
        if (payload.delay_charge  > 0) logEntries.push({ event: `Delay Charge (${payload.delay_hours} hrs)`,       amount: payload.delay_charge,  recorded_at: now });
        if (payload.damage_fee    > 0) logEntries.push({ event: "Damage Fee",                                       amount: payload.damage_fee,    recorded_at: now });
        if (payload.pickup_fee    > 0) logEntries.push({ event: "Pickup Fee",                                       amount: payload.pickup_fee,    recorded_at: now });
        if (payload.final_payment > 0) logEntries.push({ event: "Final Payment",                                    amount: payload.final_payment, recorded_at: now });
      }

      if (logEntries.length) up.payment_log = [...prevLog, ...logEntries];

      await bookingsService.update(bookingId, up);
      setFeedback({ visible: true, type: "success", message: "Status updated!" });
      setActiveModal(null);
      setTargetBooking(null);
      fetchData();
    } catch (err) {
      setFeedback({ visible: true, type: "error", message: err?.message || "Update failed." });
    } finally {
      setSubmitting(false);
    }
  };

  const activeStatuses = ["confirmed", "ongoing", "delivered", "retrieved"];
  const displayed = (() => {
    let list = [...allBookings];
    if (filterStatus === "active")         list = list.filter(b => activeStatuses.includes(b.status));
    else if (filterStatus === "mine")      list = list.filter(isMine);
    else if (filterStatus === "completed") list = list.filter(b => b.status === "completed");
    list.sort((a, b) => (isMine(a) ? 0 : 1) - (isMine(b) ? 0 : 1));
    return list;
  })();

  const myActive = allBookings.filter(b => isMine(b) && activeStatuses.includes(b.status)).length;
  const myDone   = allBookings.filter(b => isMine(b) && b.status === "completed").length;

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color="#222" />
        <Text style={{ marginTop: 12, color: "#6b7280" }}>Loading bookings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Driver Portal</Text>
          <Text style={s.headerSub}>Hello, {driverName || "Driver"}</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={() => setActionModal({ title: "Logout", message: "Sure you want to logout?", onConfirm: () => firebaseAuth.signOut() })}>
          <Ionicons name="log-out-outline" size={24} color="#222" />
        </TouchableOpacity>
      </View>

      <View style={s.statsRow}>
        {[{ label: "My Active", count: myActive }, { label: "My Done", count: myDone }, { label: "All", count: allBookings.length }].map(stat => (
          <View key={stat.label} style={s.statCard}>
            <Text style={s.statCount}>{stat.count}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={s.tabRow}>
        {[
          { key: "all",       label: `All (${allBookings.length})` },
          { key: "active",    label: "Active" },
          { key: "mine",      label: "Mine" },
          { key: "completed", label: "Done" },
        ].map(f => (
          <TouchableOpacity key={f.key} style={[s.tab, filterStatus === f.key && s.tabActive]} onPress={() => setFilterStatus(f.key)}>
            <Text style={[s.tabTxt, filterStatus === f.key && s.tabTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {allBookings.length === 0 && (
        <View style={s.noDataBanner}>
          <Ionicons name="warning-outline" size={18} color="#92400e" />
          <Text style={s.noDataText}>No bookings found. Ask your admin to expose <Text style={{ fontWeight: "700" }}>listAllWithDetails</Text> in bookingsService.</Text>
        </View>
      )}

      <FlatList
        data={displayed}
        keyExtractor={b => String(b.id)}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Ionicons name="car-outline" size={56} color="#d1d5db" />
            <Text style={s.emptyTitle}>No Bookings</Text>
            <Text style={s.emptySub}>
              {filterStatus === "mine" ? "No bookings assigned to you yet."
                : filterStatus === "active" ? "No active bookings right now."
                : "Pull down to refresh."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <BookingCard booking={item} onAction={handleAction} isMyBooking={isMine(item)} />
        )}
      />

      <OngoingModal
        visible={activeModal === "ongoing"}
        booking={targetBooking}
        onClose={() => { setActiveModal(null); setTargetBooking(null); }}
        onSubmit={d => applyUpdate(targetBooking.id, { status: "ongoing", ...d })}
        loading={submitting}
      />
      <DeliveredModal
        visible={activeModal === "delivered"}
        booking={targetBooking}
        systemSettings={systemSettings}
        onClose={() => { setActiveModal(null); setTargetBooking(null); }}
        onSubmit={d => applyUpdate(targetBooking.id, { status: "delivered", ...d })}
        loading={submitting}
      />
      <RetrievedModal
        visible={activeModal === "retrieved"}
        booking={targetBooking}
        systemSettings={systemSettings}
        onClose={() => { setActiveModal(null); setTargetBooking(null); }}
        onSubmit={d => applyUpdate(targetBooking.id, { status: "retrieved", ...d })}
        loading={submitting}
      />

      {actionModal && (
        <ActionModal visible={!!actionModal} type="confirm" title={actionModal.title} message={actionModal.message}
          onClose={() => setActionModal(null)} onConfirm={() => { actionModal.onConfirm(); setActionModal(null); }} />
      )}
      <ActionModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.type === "success" ? "Success" : "Error"}
        message={feedback.message}
        confirmText="OK"
        onClose={() => setFeedback({ ...feedback, visible: false })}
        onConfirm={() => setFeedback({ ...feedback, visible: false })}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#f9fafb" },
  centered:     { flex: 1, justifyContent: "center", alignItems: "center" },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  headerTitle:  { fontSize: 24, fontWeight: "800", color: "#111827" },
  headerSub:    { fontSize: 13, color: "#6b7280", marginTop: 2 },
  logoutBtn:    { padding: 8, borderRadius: 8, backgroundColor: "#f3f4f6" },
  statsRow:     { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  statCard:     { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  statCount:    { fontSize: 24, fontWeight: "800", color: "#111827" },
  statLabel:    { fontSize: 11, color: "#6b7280", marginTop: 2, fontWeight: "500", textAlign: "center" },
  tabRow:       { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, backgroundColor: "#f3f4f6", borderRadius: 10, padding: 3 },
  tab:          { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive:    { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabTxt:       { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  tabTxtActive: { color: "#111827" },
  listContent:  { paddingHorizontal: 16, paddingBottom: 30 },
  noDataBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginHorizontal: 16, marginBottom: 12, backgroundColor: "#fffbeb", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#fde68a" },
  noDataText:   { flex: 1, fontSize: 12, color: "#92400e", lineHeight: 18 },
  card:         { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, borderLeftWidth: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  cardMuted:    { opacity: 0.72 },
  viewOnly:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#f3f4f6", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8, alignSelf: "flex-start" },
  viewOnlyTxt:  { fontSize: 11, color: "#6b7280", fontWeight: "500" },
  myBadge:      { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#d1fae5", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8, alignSelf: "flex-start" },
  myBadgeTxt:   { fontSize: 11, color: "#065f46", fontWeight: "700" },
  cardHead:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  cardName:     { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardVehicle:  { fontSize: 13, color: "#374151", marginTop: 2 },
  pillRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 },
  pill:         { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f3f4f6", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  pillTxt:      { fontSize: 11, color: "#374151", fontWeight: "600" },
  statusPill:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusPillTxt:{ fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  row:          { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  rowTxt:       { fontSize: 13, color: "#6b7280", flex: 1 },
  driverBadge:  { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: "#f8fafc", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  driverBadgeTxt:{ fontSize: 13, color: "#374151" },
  driverName:   { fontWeight: "700", color: "#111827" },
  noDriver:     { fontSize: 12, color: "#f59e0b", fontWeight: "600" },
  tlWrap:       { flexDirection: "row", alignItems: "flex-start", marginTop: 12, marginBottom: 4 },
  tlStep:       { flex: 1, alignItems: "center" },
  tlLine:       { position: "absolute", left: "-50%", right: "50%", top: 13, height: 2, backgroundColor: "#e5e7eb", zIndex: 0 },
  tlLineDone:   { backgroundColor: "#111827" },
  tlDot:        { width: 28, height: 28, borderRadius: 14, backgroundColor: "#e5e7eb", justifyContent: "center", alignItems: "center", zIndex: 1, marginBottom: 4 },
  tlDotDone:    { backgroundColor: "#111827" },
  tlDotCurrent: { backgroundColor: "#111827", shadowColor: "#111827", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 4 },
  tlLabel:      { fontSize: 9, color: "#9ca3af", textAlign: "center", fontWeight: "500" },
  tlLabelDone:  { color: "#374151" },
  tlLabelCurrent:{ color: "#111827", fontWeight: "700" },
  twoCol:       { flexDirection: "row", gap: 10, marginTop: 8 },
  gaugeWrap:    { marginVertical: 8 },
  gaugeLabel:   { fontSize: 11, color: "#6b7280", fontWeight: "500", marginBottom: 4 },
  gaugeTrack:   { height: 8, backgroundColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" },
  gaugeFill:    { height: "100%", borderRadius: 4 },
  gaugePct:     { fontSize: 12, fontWeight: "700", marginTop: 2 },
  threeGauges:  { flexDirection: "row", gap: 8, marginVertical: 8 },
  gaugeCol:     { flex: 1, alignItems: "center" },
  gaugeNote:    { fontSize: 10, color: "#9ca3af", marginTop: 2, textAlign: "center" },
  chargeBox:     { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 10, padding: 12, marginTop: 10 },
  chargeRow:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  chargeL:       { fontSize: 13, color: "#92400e" },
  chargeV:       { fontSize: 13, fontWeight: "600", color: "#92400e" },
  chargeTotalRow:{ borderTopWidth: 1, borderTopColor: "#fde68a", paddingTop: 6, marginTop: 4 },
  chargeTL:      { fontSize: 14, fontWeight: "700", color: "#78350f" },
  chargeTV:      { fontSize: 14, fontWeight: "800", color: "#b45309" },
  chargePillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  cpill:         { backgroundColor: "#fffbeb", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  cpillTxt:      { fontSize: 12, fontWeight: "600", color: "#92400e" },

  // ── Grand Total Card ──────────────────────────────────────────────────────
  grandTotalCard:        { borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", overflow: "hidden", marginTop: 8, marginBottom: 16, backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  grandTotalHeader:      { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#f3f4f6", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  grandTotalHeaderTxt:   { fontSize: 13, fontWeight: "700", color: "#374151", flex: 1 },
  grandTotalBody:        { backgroundColor: "#fff", paddingHorizontal: 16, paddingVertical: 12 },
  grandTotalRow:         { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  grandTotalL:           { fontSize: 13, color: "#6b7280" },
  grandTotalV:           { fontSize: 13, fontWeight: "600", color: "#374151" },
  grandTotalDivider:     { height: 1, backgroundColor: "#f3f4f6", marginVertical: 8 },
  grandTotalSumL:        { fontSize: 14, fontWeight: "700", color: "#111827" },
  grandTotalSumV:        { fontSize: 16, fontWeight: "800", color: "#111827" },
  grandTotalAlreadyPaid: { backgroundColor: "#f0fdf4", borderTopWidth: 1, borderTopColor: "#d1fae5", paddingHorizontal: 16, paddingVertical: 10 },
  grandTotalPaidL:       { fontSize: 13, fontWeight: "600", color: "#059669" },
  grandTotalPaidV:       { fontSize: 13, fontWeight: "600", color: "#059669" },
  grandTotalPaidDetail:  { fontSize: 11, color: "#9ca3af" },
  grandTotalBalance:     { backgroundColor: "#f8fafc", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingHorizontal: 16, paddingVertical: 14, alignItems: "center" },
  grandTotalBalanceLabel:{ fontSize: 11, fontWeight: "700", color: "#9ca3af", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  grandTotalBalanceValue:{ fontSize: 26, fontWeight: "800", color: "#111827" },
  grandTotalOverpaid:    { fontSize: 12, color: "#ef4444", marginTop: 4 },

  // ── Legacy collection summary (kept for compatibility) ────────────────────
  collectionSummary: { backgroundColor: "#ede9fe", borderRadius: 12, padding: 14, marginTop: 8, marginBottom: 12, borderWidth: 1, borderColor: "#ddd6fe" },
  collectionTitle:   { fontSize: 13, fontWeight: "700", color: "#5b21b6", marginBottom: 8 },
  collectionRow:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  collectionLabel:   { fontSize: 13, color: "#6b21a8" },
  collectionValue:   { fontSize: 13, fontWeight: "700", color: "#6b21a8" },

  logWrap:       { marginTop: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 10 },
  logTitle:      { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  logRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  logEvent:      { fontSize: 13, color: "#374151", fontWeight: "500" },
  logTime:       { fontSize: 11, color: "#9ca3af" },
  logAmount:     { fontSize: 13, fontWeight: "700", color: "#059669" },
  logTotalRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8, marginTop: 4 },
  logTotalLabel: { fontSize: 13, fontWeight: "700", color: "#111827" },
  logTotalValue: { fontSize: 15, fontWeight: "800", color: "#059669" },
  totalPaidRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, marginTop: 10, borderWidth: 1, borderColor: "#86efac" },
  totalPaidL:    { fontSize: 13, fontWeight: "600", color: "#166534" },
  totalPaidV:    { fontSize: 16, fontWeight: "800", color: "#15803d" },
  actBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, paddingVertical: 13, borderRadius: 10, backgroundColor: "#111827" },
  actBtnTxt:     { color: "#fff", fontSize: 15, fontWeight: "700" },
  emptyWrap:     { alignItems: "center", paddingVertical: 60 },
  emptyTitle:    { fontSize: 18, fontWeight: "700", color: "#374151", marginTop: 14 },
  emptySub:      { fontSize: 14, color: "#9ca3af", marginTop: 6, textAlign: "center", paddingHorizontal: 30 },
  modalBg:       { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard:     { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "94%" },
  modalHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  modalTitle:    { fontSize: 18, fontWeight: "800", color: "#111827" },
  modalBody:     { padding: 20 },
  infoBox:       { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  infoLabel:     { fontSize: 11, color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", marginTop: 4 },
  infoValue:     { fontSize: 14, color: "#111827", fontWeight: "600", marginTop: 2 },
  sectionHdr:    { fontSize: 14, fontWeight: "700", color: "#374151", marginTop: 16, marginBottom: 4 },
  fieldGroup:    { marginBottom: 14 },
  fieldLabel:    { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6, textTransform: "uppercase" },
  fieldHint:     { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  fieldRow:      { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, overflow: "hidden" },
  fieldPrefix:   { paddingHorizontal: 12, fontSize: 15, color: "#6b7280", fontWeight: "600", backgroundColor: "#f9fafb", paddingVertical: 12 },
  fieldInput:    { flex: 1, fontSize: 15, color: "#111827", paddingHorizontal: 12, paddingVertical: 12 },
  noteBox:       { flexDirection: "row", gap: 8, backgroundColor: "#f3f4f6", borderRadius: 10, padding: 12, marginTop: 4, marginBottom: 10, borderWidth: 1, borderColor: "#e5e7eb" },
  noteText:      { fontSize: 12, color: "#374151", flex: 1, lineHeight: 18 },
  driverUsedBox:     { flexDirection: "row", gap: 8, backgroundColor: "#fffbeb", borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#fde68a" },
  driverUsedBoxGood: { flexDirection: "row", gap: 8, backgroundColor: "#f0fdf4", borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#86efac" },
  driverUsedTxt:     { fontSize: 12, flex: 1, lineHeight: 17 },
  rateBox:       { flexDirection: "row", gap: 8, backgroundColor: "#ede9fe", borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#ddd6fe" },
  rateBoxTxt:    { fontSize: 12, color: "#5b21b6", flex: 1, fontWeight: "600" },
  submitBtn:     { backgroundColor: "#111827", borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 20, marginBottom: 10 },
  submitBtnOff:  { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});