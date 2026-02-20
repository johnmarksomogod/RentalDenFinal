import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ActionModal from "../AlertModal/ActionModal";
import BookingForm from "./BookingForm";

// ─── Status colors — matches BookingsScreen & DriverDashboard ─────────────────
const STATUS_COLOR = {
  confirmed: "#f59e0b",
  ongoing:   "#3b82f6",
  delivered: "#8b5cf6",
  retrieved: "#10b981",
  completed: "#6b7280",
  pending:   "#9ca3af",
  cancelled: "#ef4444",
  declined:  "#ef4444",
};

// Status flow — what transitions are allowed
const STATUS_FLOW = {
  pending:   ["confirmed", "declined", "cancelled"],
  confirmed: ["ongoing", "cancelled"],
  ongoing:   ["delivered", "cancelled"],
  delivered: ["retrieved"],
  retrieved: ["completed"],
  completed: [],
  cancelled: [],
  declined:  [],
};

const STATUS_LABEL = {
  confirmed: "✅ Confirm Booking",
  ongoing:   "🚗 Mark Ongoing",
  delivered: "📦 Mark Delivered",
  retrieved: "🔁 Mark Retrieved",
  completed: "🏁 Mark Completed",
  cancelled: "🚫 Cancel Booking",
  declined:  "❌ Decline Booking",
};

const ALL_STATUSES = [
  "pending","confirmed","ongoing","delivered","retrieved","completed","cancelled","declined",
];

export default function EditBookingModal({
  visible,
  booking,
  availableVehicles = [],
  closeEditModal,
  updateBooking,
  deleteBooking,
  modalAnimation,
  styles,
  formatDate,
  CalendarModalComponent,
  // New optional props from BookingsScreen
  onAssignDriver,
  extraContent,
}) {
  const [editableBooking, setEditableBooking]     = useState(null);
  const [vehiclePickerVisible, setVehiclePickerVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateField, setDateField]                 = useState("");
  const [confirmVisible, setConfirmVisible]       = useState(false);
  const [deleteVisible, setDeleteVisible]         = useState(false);
  const [loading, setLoading]                     = useState(false);
  const [deleteLoading, setDeleteLoading]         = useState(false);
  const [showSuccessModal, setShowSuccessModal]   = useState(false);
  const [showErrorModal, setShowErrorModal]       = useState(false);
  const [errorMessage, setErrorMessage]           = useState("");

  // ── Status change sheet state ──────────────────────────────────────────────
  const [statusSheetVisible, setStatusSheetVisible] = useState(false);
  const [statusLoading, setStatusLoading]           = useState(false);
  const [declineReason, setDeclineReason]           = useState("");

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (booking && typeof booking === "object") {
      setEditableBooking({
        id:                   booking.id || null,
        customer_name:        booking.customer_name || "",
        customer_email:       booking.customer_email || "",
        customer_phone:       booking.customer_phone || "",
        rental_start_date:    booking.rental_start_date || "",
        rental_end_date:      booking.rental_end_date || "",
        total_price:          booking.total_price || 0,
        status:               booking.status || "pending",
        pickup_location:      booking.pickup_location || "",
        license_number:       booking.license_number || "",
        gov_id_url:           booking.gov_id_url || "",
        vehicle_variant_id:   booking.vehicle_variant_id || null,
        vehicle_id:           booking.vehicle_id || null,
        contract_text:        booking.contract_text || "",
        contract_signed_name: booking.contract_signed_name || "",
        contract_signed_at:   booking.contract_signed_at || "",
        decline_reason:       booking.decline_reason || "",
        assigned_driver:      booking.assigned_driver || "",
        created_at:           booking.created_at || new Date().toISOString(),
        updated_at:           booking.updated_at || new Date().toISOString(),
        vehicles:             booking.vehicles || null,
        vehicle_variants:     booking.vehicle_variants || null,
      });
    } else {
      setEditableBooking(null);
    }
  }, [booking]);

  useEffect(() => {
    if (!visible) {
      setDatePickerVisible(false);
      setVehiclePickerVisible(false);
      setDateField("");
      setConfirmVisible(false);
      setDeleteVisible(false);
      setStatusSheetVisible(false);
      setDeclineReason("");
    }
  }, [visible]);

  // ── Status change — direct, no full-form save needed ──────────────────────
  const handleStatusChange = useCallback(async (newStatus) => {
    if (!editableBooking?.id) return;

    if (newStatus === "declined" && !declineReason.trim()) {
      // keep sheet open so user can fill in reason
      return;
    }

    setStatusLoading(true);
    try {
      // Build a minimal update — only status fields, no full form data
      const statusUpdate = {
        ...editableBooking,
        status:         newStatus,
        decline_reason: newStatus === "declined" ? declineReason : (editableBooking.decline_reason || null),
        updated_at:     new Date().toISOString(),
      };

      await updateBooking(statusUpdate);

      // Update local state immediately for snappy UI
      setEditableBooking(prev => prev ? { ...prev, status: newStatus, decline_reason: statusUpdate.decline_reason } : null);
      setStatusSheetVisible(false);
      setDeclineReason("");
    } catch (err) {
      setErrorMessage(err?.message || "Status change failed.");
      setShowErrorModal(true);
    } finally {
      setStatusLoading(false);
    }
  }, [editableBooking, declineReason, updateBooking]);

  // ── Full form save ─────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!editableBooking) return;
    setConfirmVisible(true);
  }, [editableBooking]);

  const handleConfirmSave = useCallback(async () => {
    if (!editableBooking?.id) return;
    setLoading(true);
    try {
      await updateBooking(editableBooking);
      setConfirmVisible(false);
      setShowSuccessModal(true);
    } catch (error) {
      setErrorMessage("Failed to update booking.");
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  }, [updateBooking, editableBooking]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!editableBooking?.id) return;
    setDeleteVisible(true);
  }, [editableBooking]);

  const handleConfirmDelete = useCallback(async () => {
    if (!editableBooking?.id) return;
    setDeleteLoading(true);
    try {
      await deleteBooking(editableBooking.id);
      setDeleteVisible(false);
      setShowSuccessModal(true);
    } catch {
      setErrorMessage("Failed to delete booking.");
      setShowErrorModal(true);
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteBooking, editableBooking]);

  // ── Date / vehicle pickers ─────────────────────────────────────────────────
  const handleDatePickerClose = useCallback(() => { setDatePickerVisible(false); setDateField(""); }, []);

  const handleDateSelect = useCallback((dateString) => {
    if (!editableBooking) return;
    setEditableBooking(prev => {
      if (!prev) return null;
      if (dateField === "start") return { ...prev, rental_start_date: dateString };
      if (dateField === "end")   return { ...prev, rental_end_date: dateString };
      return prev;
    });
    handleDatePickerClose();
  }, [dateField, handleDatePickerClose, editableBooking]);

  const handleVehicleSelect = useCallback((variant) => {
    if (!editableBooking) return;
    setEditableBooking(prev => prev ? {
      ...prev,
      vehicle_id:       variant?.vehicle_id || null,
      vehicle_variant_id: variant?.id || null,
      vehicles:         variant?.vehicles || null,
      vehicle_variants: variant || null,
    } : null);
    setVehiclePickerVisible(false);
  }, [editableBooking]);

  // ── Computed ───────────────────────────────────────────────────────────────
  const selectedDate = useMemo(() => {
    if (!dateField || !editableBooking) return "";
    return dateField === "start" ? editableBooking.rental_start_date || "" : editableBooking.rental_end_date || "";
  }, [dateField, editableBooking]);

  const minDate = useMemo(() => {
    if (dateField === "end" && editableBooking?.rental_start_date) return editableBooking.rental_start_date;
    return new Date().toISOString().split("T")[0];
  }, [dateField, editableBooking]);

  const shouldShowDeleteButton = useMemo(() => editableBooking?.status === "cancelled", [editableBooking?.status]);

  const currentStatus  = editableBooking?.status || "pending";
  const statusColor    = STATUS_COLOR[currentStatus] || "#6b7280";
  const nextStatuses   = STATUS_FLOW[currentStatus] || [];

  if (!visible) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View style={styles.modalHeader}>
      <TouchableOpacity onPress={closeEditModal} style={styles.modalHeaderButton}>
        <Ionicons name="close" size={24} color="#374151" />
      </TouchableOpacity>
      <Text style={styles.modalTitle}>Edit Booking</Text>
      <TouchableOpacity
        onPress={handleSave}
        style={[styles.modalHeaderButton, styles.saveButtonContainer]}
        disabled={!editableBooking}
      >
        <Text style={[styles.saveButton, !editableBooking && { opacity: 0.5 }]}>Save</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStatusBar = () => {
    if (!editableBooking) return null;
    return (
      <View style={ebS.statusBar}>
        {/* Current status display */}
        <View style={[ebS.currentStatusBadge, { backgroundColor: statusColor + "22" }]}>
          <View style={[ebS.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[ebS.currentStatusTxt, { color: statusColor }]}>{currentStatus.toUpperCase()}</Text>
        </View>

        {/* Change status button */}
        <TouchableOpacity
          style={ebS.changeStatusBtn}
          onPress={() => { setDeclineReason(""); setStatusSheetVisible(true); }}
        >
          <Ionicons name="swap-vertical-outline" size={14} color="#374151" />
          <Text style={ebS.changeStatusTxt}>Change Status</Text>
        </TouchableOpacity>

        {/* Assign driver button — shown if delivery booking */}
        {onAssignDriver && editableBooking.assigned_driver !== undefined && (
          <TouchableOpacity
            style={ebS.assignBtn}
            onPress={() => onAssignDriver(booking)}
          >
            <Ionicons name="person-add-outline" size={14} color="#374151" />
            <Text style={ebS.changeStatusTxt}>{editableBooking.assigned_driver ? "Reassign" : "Assign Driver"}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderDeclineReasonField = () => {
    if (currentStatus !== "declined" && !nextStatuses.includes("declined")) return null;
    if (currentStatus !== "declined") return null;
    // Only show if already declined
    return (
      <View style={[styles.section, { marginBottom: 0 }]}>
        <Text style={[styles.inputLabel, { color: "#ef4444" }]}>Decline Reason</Text>
        <Text style={{ fontSize: 14, color: "#374151", marginTop: 4 }}>{editableBooking?.decline_reason || "—"}</Text>
      </View>
    );
  };

  const renderVehiclePicker = () => (
    <Modal visible={vehiclePickerVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.vehiclePickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Vehicle</Text>
            <TouchableOpacity onPress={() => setVehiclePickerVisible(false)}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 300 }}>
            {availableVehicles.length > 0 ? (
              availableVehicles.map((variant) => (
                <TouchableOpacity
                  key={variant?.id || Math.random()}
                  style={[
                    styles.vehiclePickerItem,
                    editableBooking?.vehicle_variant_id === variant?.id && styles.vehiclePickerItemSelected,
                  ]}
                  onPress={() => handleVehicleSelect(variant)}
                >
                  <View style={styles.vehiclePickerItemContent}>
                    <Text style={styles.vehiclePickerText}>
                      {variant?.vehicles?.year || "N/A"} {variant?.vehicles?.make || "N/A"} {variant?.vehicles?.model || "N/A"}
                    </Text>
                    <Text style={styles.vehiclePickerType}>
                      {variant?.color || "N/A"} • Plate: {variant?.plate_number || "—"} • Available: {variant?.available_quantity || 0}
                    </Text>
                  </View>
                  {editableBooking?.vehicle_variant_id === variant?.id && (
                    <Ionicons name="checkmark" size={20} color="#111827" />
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.emptyVehicleText}>No vehicles available</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ── Status change bottom sheet ─────────────────────────────────────────────
  const renderStatusSheet = () => (
    <Modal visible={statusSheetVisible} animationType="slide" transparent onRequestClose={() => setStatusSheetVisible(false)}>
      <View style={ebS.sheetOverlay}>
        <View style={ebS.sheet}>
          <View style={ebS.sheetHandle} />
          <View style={ebS.sheetHeader}>
            <View>
              <Text style={ebS.sheetTitle}>Change Status</Text>
              <Text style={ebS.sheetSub}>
                {editableBooking?.customer_name} · Current:{" "}
                <Text style={{ color: statusColor, fontWeight: "700" }}>{currentStatus}</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={() => setStatusSheetVisible(false)}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          <ScrollView style={ebS.sheetBody} showsVerticalScrollIndicator={false}>
            {nextStatuses.length === 0 ? (
              <View style={ebS.noOptions}>
                <Ionicons name="checkmark-circle" size={32} color="#6b7280" />
                <Text style={ebS.noOptionsTxt}>No further status changes available.</Text>
              </View>
            ) : (
              nextStatuses.map((status) => (
                <View key={status}>
                  <TouchableOpacity
                    style={[ebS.option, { borderColor: STATUS_COLOR[status] + "44", backgroundColor: STATUS_COLOR[status] + "0d" }]}
                    onPress={() => handleStatusChange(status)}
                    disabled={statusLoading}
                  >
                    <View style={[ebS.optionDot, { backgroundColor: STATUS_COLOR[status] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[ebS.optionLabel, { color: STATUS_COLOR[status] }]}>{STATUS_LABEL[status] || status}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={STATUS_COLOR[status]} />
                  </TouchableOpacity>

                  {/* Show decline reason input when declining */}
                  {status === "declined" && (
                    <View style={ebS.declineInput}>
                      <Text style={ebS.declineLabel}>Decline Reason (required)</Text>
                      <TextInput
                        style={[ebS.declineBox, !declineReason.trim() && ebS.declineBoxEmpty]}
                        value={declineReason}
                        onChangeText={setDeclineReason}
                        placeholder="Enter reason for declining..."
                        placeholderTextColor="#9ca3af"
                        multiline
                      />
                      {!declineReason.trim() && (
                        <Text style={ebS.declineHint}>Fill in reason, then tap "❌ Decline Booking" above.</Text>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}

            {/* Admin override */}
            <View style={ebS.divider} />
            <Text style={ebS.overrideLabel}>Admin Override (any status)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ebS.overrideRow}>
              {ALL_STATUSES.filter(s => s !== currentStatus).map(status => (
                <TouchableOpacity
                  key={status}
                  style={[ebS.chip, { backgroundColor: STATUS_COLOR[status] + "22", borderColor: STATUS_COLOR[status] + "66" }]}
                  onPress={() => handleStatusChange(status)}
                  disabled={statusLoading}
                >
                  <Text style={[ebS.chipTxt, { color: STATUS_COLOR[status] }]}>{status}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <Modal visible={visible} transparent animationType="none">
      <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: modalAnimation,
              transform: [{
                translateY: modalAnimation.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }),
              }],
            },
          ]}
        >
          {!booking ? (
            // Error state
            <View style={styles.modalContainer}>
              {renderHeader()}
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
                <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
                <Text style={{ fontSize: 16, color: "#ef4444", marginTop: 12, textAlign: "center" }}>Unable to load booking details</Text>
                <TouchableOpacity onPress={closeEditModal} style={{ marginTop: 20, backgroundColor: "#111827", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
                  <Text style={{ color: "#fff", fontWeight: "600" }}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : !editableBooking ? (
            // Loading state
            <View style={styles.modalContainer}>
              {renderHeader()}
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <Text style={{ fontSize: 16, color: "#6b7280" }}>Loading booking...</Text>
              </View>
            </View>
          ) : (
            <>
              {renderHeader()}

              {/* Status bar — always visible at top, no scrolling needed to change status */}
              {renderStatusBar()}

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: Platform.OS === "ios" ? 100 : 80 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                bounces={false}
              >
                {/* Extra content (delivery timeline) passed from BookingsScreen */}
                {extraContent && (
                  <View style={{ marginBottom: 12 }}>
                    {extraContent}
                  </View>
                )}

                {/* Decline reason display if already declined */}
                {renderDeclineReasonField()}

                <BookingForm
                  booking={editableBooking}
                  setBooking={setEditableBooking}
                  availableVehicles={availableVehicles}
                  styles={styles}
                  formatDate={formatDate}
                  setDatePickerVisible={setDatePickerVisible}
                  setDateField={setDateField}
                  setVehiclePickerVisible={setVehiclePickerVisible}
                  isEdit={true}
                />

                {/* Delete button — only for cancelled bookings */}
                {shouldShowDeleteButton && (
                  <View style={styles.section}>
                    <TouchableOpacity onPress={handleDelete} style={styles.deleteButton}>
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                      <Text style={styles.deleteButtonText}>Delete Booking</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>

              <CalendarModalComponent
                visible={datePickerVisible && !!dateField}
                onClose={handleDatePickerClose}
                onDateSelect={handleDateSelect}
                selectedDate={selectedDate}
                title={dateField === "start" ? "Select Start Date" : "Select End Date"}
                minDate={minDate}
              />

              {renderVehiclePicker()}
              {renderStatusSheet()}

              <ActionModal visible={confirmVisible} type="confirm" title="Confirm Changes" message="Are you sure you want to save these changes?" confirmText="Save" loading={loading} onClose={() => setConfirmVisible(false)} onConfirm={handleConfirmSave} />
              <ActionModal visible={deleteVisible} type="delete" title="Delete Booking" message="Are you sure you want to delete this booking? This action cannot be undone." confirmText="Delete" loading={deleteLoading} onClose={() => setDeleteVisible(false)} onConfirm={handleConfirmDelete} />
              <ActionModal
                visible={showSuccessModal}
                type="success"
                title="Success"
                message="Booking updated successfully!"
                onClose={() => { setShowSuccessModal(false); closeEditModal(); }}
                onConfirm={() => { setShowSuccessModal(false); closeEditModal(); }}
              />
              <ActionModal
                visible={showErrorModal}
                type="error"
                title="Error"
                message={errorMessage}
                confirmText="Close"
                onClose={() => setShowErrorModal(false)}
                onConfirm={() => setShowErrorModal(false)}
              />
            </>
          )}
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Local styles for status bar & sheet ─────────────────────────────────────
import { StyleSheet } from "react-native";

const ebS = StyleSheet.create({
  // Status bar at top of modal
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexWrap: "wrap",
  },
  currentStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  currentStatusTxt: { fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  changeStatusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  assignBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  changeStatusTxt: { fontSize: 12, fontWeight: "600", color: "#374151" },

  // Bottom sheet
  sheetOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:         { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", paddingBottom: 30 },
  sheetHandle:   { width: 40, height: 4, backgroundColor: "#e5e7eb", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  sheetHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  sheetTitle:    { fontSize: 18, fontWeight: "800", color: "#111827" },
  sheetSub:      { fontSize: 13, color: "#6b7280", marginTop: 2 },
  sheetBody:     { padding: 16 },
  option:        { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1.5, marginBottom: 10 },
  optionDot:     { width: 10, height: 10, borderRadius: 5 },
  optionLabel:   { fontSize: 15, fontWeight: "700" },
  noOptions:     { alignItems: "center", paddingVertical: 30, gap: 10 },
  noOptionsTxt:  { fontSize: 15, color: "#6b7280", textAlign: "center" },
  declineInput:  { marginBottom: 10, marginTop: -4, paddingHorizontal: 4 },
  declineLabel:  { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6, textTransform: "uppercase" },
  declineBox:    { backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#111827", height: 80, textAlignVertical: "top" },
  declineBoxEmpty: { borderColor: "#fca5a5" },
  declineHint:   { fontSize: 11, color: "#f59e0b", marginTop: 4 },
  divider:       { height: 1, backgroundColor: "#f3f4f6", marginVertical: 12 },
  overrideLabel: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  overrideRow:   { flexDirection: "row", gap: 8, paddingBottom: 4 },
  chip:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipTxt:       { fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
});