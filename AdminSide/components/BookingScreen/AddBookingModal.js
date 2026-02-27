import React, { useState, useEffect } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ActionModal from "../AlertModal/ActionModal";
import BookingForm from "./BookingForm";
import { bookingsService, variantsService, appUsersService, getRoleSync } from "../../services/firebaseService";

export default function AddBookingModal({
  visible,
  availableVehicles,
  closeModal,
  onBookingAdded,
  modalAnimation,
  styles,
  formatDate,
  // CalendarModalComponent is no longer needed — BookingForm has its own built-in calendar
  CalendarModalComponent,
}) {
  // ── Initial booking state — always includes delivery_option ───────────────
  const EMPTY_BOOKING = {
    customer_name:      "",
    customer_email:     "",
    customer_phone:     "",
    license_number:     "",
    vehicle_id:         null,
    vehicle_variant_id: null,
    rental_start_date:  "",
    rental_end_date:    "",
    total_price:        "",
    rental_days:        0,
    // Delivery fields — BookingForm requires these to be present
    delivery_option:    "pickup",   // always "pickup" | "deliver"
    pickup_location:    "",
    delivery_address:   "",
    // Misc
    gov_id_url:         "",
    status:             "pending",
    assigned_driver_id: null,
  };

  const [newBooking, setNewBooking]               = useState(EMPTY_BOOKING);
  const [confirmVisible, setConfirmVisible]       = useState(false);
  const [loading, setLoading]                     = useState(false);
  const [validationError, setValidationError]     = useState("");
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal]   = useState(false);
  const [showErrorModal, setShowErrorModal]       = useState(false);
  const [errorMessage, setErrorMessage]           = useState("");
  const [drivers, setDrivers]                     = useState([]);
  const [driverPickerVisible, setDriverPickerVisible] = useState(false);

  // ── Reset form when modal opens ────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setNewBooking(EMPTY_BOOKING);
      setConfirmVisible(false);
      setValidationError("");
    }
  }, [visible]);

  // ── Fetch drivers (owner/admin only) ──────────────────────────────────────
  useEffect(() => {
    if (visible && (getRoleSync() === "owner" || getRoleSync() === "admin")) {
      appUsersService
        .listByOwner()
        .then((list) => setDrivers((list || []).filter((u) => u.role === "driver")))
        .catch(() => setDrivers([]));
    }
  }, [visible]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validateBooking = () => {
    const required = [
      "customer_name",
      "customer_email",
      "customer_phone",
      "license_number",
      "rental_start_date",
      "rental_end_date",
      "total_price",
      "vehicle_id",
      "vehicle_variant_id",
    ];

    for (const field of required) {
      if (!newBooking[field]) {
        setValidationError(`Please fill in: ${field.replace(/_/g, " ")}`);
        setShowValidationModal(true);
        return false;
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newBooking.customer_email)) {
      setValidationError("Please enter a valid email address.");
      setShowValidationModal(true);
      return false;
    }

    const startDate = new Date(newBooking.rental_start_date);
    const endDate   = new Date(newBooking.rental_end_date);
    const today     = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      setValidationError("Start date cannot be in the past.");
      setShowValidationModal(true);
      return false;
    }

    if (endDate <= startDate) {
      setValidationError("End date must be after start date.");
      setShowValidationModal(true);
      return false;
    }

    // If delivery is chosen, require an address
    if (newBooking.delivery_option === "deliver" && !newBooking.delivery_address?.trim()) {
      setValidationError("Please enter a delivery address.");
      setShowValidationModal(true);
      return false;
    }

    return true;
  };

  const handleSave = () => {
    if (validateBooking()) setConfirmVisible(true);
  };

  const handleConfirmSave = async () => {
    setLoading(true);
    try {
      const payload = {
        customer_name:      newBooking.customer_name,
        customer_email:     newBooking.customer_email,
        customer_phone:     newBooking.customer_phone,
        license_number:     newBooking.license_number,
        vehicle_id:         newBooking.vehicle_id,
        vehicle_variant_id: newBooking.vehicle_variant_id,
        rental_start_date:  newBooking.rental_start_date,
        rental_end_date:    newBooking.rental_end_date,
        rental_days:        newBooking.rental_days || 0,
        total_price:        parseFloat(newBooking.total_price) || 0,
        // Delivery fields — always saved so BookingCard can detect delivery
        delivery_option:    newBooking.delivery_option || "pickup",
        pickup_location:    newBooking.delivery_option === "pickup"  ? (newBooking.pickup_location  || "") : "",
        delivery_address:   newBooking.delivery_option === "deliver" ? (newBooking.delivery_address || "") : "",
        gov_id_url:         newBooking.gov_id_url || "",
        status:             newBooking.status || "pending",
        assigned_driver_id: newBooking.assigned_driver_id || null,
      };

      const { id } = await bookingsService.add(payload);

      // Decrement inventory if booking is immediately confirmed
      if (payload.status === "confirmed") {
        try {
          await variantsService.adjustQuantity(payload.vehicle_variant_id, -1);
        } catch (e) {
          console.error("Inventory adjustment error:", e);
        }
      }

      if (onBookingAdded) await onBookingAdded({ id, ...payload });

      setConfirmVisible(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Add booking error:", error);
      setErrorMessage("Something went wrong while adding the booking.");
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Driver picker ──────────────────────────────────────────────────────────
  const renderDriverPicker = () => (
    <Modal visible={driverPickerVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.vehiclePickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Assign Driver (optional)</Text>
            <TouchableOpacity onPress={() => setDriverPickerVisible(false)}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.vehiclePickerItem}
            onPress={() => {
              setNewBooking((p) => ({ ...p, assigned_driver_id: null }));
              setDriverPickerVisible(false);
            }}
          >
            <Text style={styles.vehiclePickerText}>None</Text>
            {!newBooking.assigned_driver_id && (
              <Ionicons name="checkmark" size={20} color="#3b82f6" />
            )}
          </TouchableOpacity>
          {drivers.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[
                styles.vehiclePickerItem,
                newBooking.assigned_driver_id === d.id && styles.vehiclePickerItemSelected,
              ]}
              onPress={() => {
                setNewBooking((p) => ({ ...p, assigned_driver_id: d.id }));
                setDriverPickerVisible(false);
              }}
            >
              <Text style={styles.vehiclePickerText}>{d.full_name || d.email}</Text>
              {newBooking.assigned_driver_id === d.id && (
                <Ionicons name="checkmark" size={20} color="#3b82f6" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none">
      <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <Animated.View
            style={[
              styles.modalContainer,
              {
                opacity: modalAnimation,
                transform: [{
                  translateY: modalAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                }],
              },
            ]}
          >
            {/* ── Header ──────────────────────────────────────────────────── */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeModal} style={styles.modalHeaderButton}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add New Booking</Text>
              <TouchableOpacity
                onPress={handleSave}
                style={[styles.modalHeaderButton, styles.saveButtonContainer]}
                disabled={loading}
              >
                <Text style={[styles.saveButton, loading && { opacity: 0.5 }]}>
                  {loading ? "Saving…" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Form ────────────────────────────────────────────────────── */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                padding: 16,
                paddingBottom: Platform.OS === "ios" ? 100 : 80,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              {/*
               * BookingForm now owns:
               *  - Vehicle / variant pickers (Dropdown)
               *  - Calendar modals (built-in CalendarModal component)
               *  - Delivery / pickup toggle
               *  - Gov-ID upload
               *
               * We no longer need to pass setDatePickerVisible, setVehiclePickerVisible,
               * setDateField, or CalendarModalComponent into BookingForm.
               */}
              <BookingForm
                booking={newBooking}
                setBooking={setNewBooking}
                isEdit={false}
                formatDate={formatDate}
              />

              {/* Optional driver assignment (only shown when drivers exist) */}
              {drivers.length > 0 && (
                <View style={{ marginTop: 4, marginBottom: 12 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: "#374151",
                      marginBottom: 6,
                      textTransform: "uppercase",
                      letterSpacing: 0.3,
                    }}
                  >
                    Assign Driver (optional)
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.input,
                      { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
                    ]}
                    onPress={() => setDriverPickerVisible(true)}
                  >
                    <Text style={{ color: newBooking.assigned_driver_id ? "#111827" : "#9ca3af", fontSize: 14 }}>
                      {newBooking.assigned_driver_id
                        ? (
                            drivers.find((d) => d.id === newBooking.assigned_driver_id)?.full_name ||
                            drivers.find((d) => d.id === newBooking.assigned_driver_id)?.email
                          )
                        : "None"}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {/* ── Driver picker modal ──────────────────────────────────────── */}
            {renderDriverPicker()}

            {/* ── Confirmation modal ───────────────────────────────────────── */}
            <ActionModal
              visible={confirmVisible}
              type="confirm"
              title="Add Booking"
              message={
                newBooking.delivery_option === "deliver"
                  ? "Add this delivery booking? A driver can be assigned from the Bookings screen."
                  : "Are you sure you want to add this booking?"
              }
              confirmText="Add Booking"
              loading={loading}
              onClose={() => setConfirmVisible(false)}
              onConfirm={handleConfirmSave}
            />

            {/* ── Validation error ─────────────────────────────────────────── */}
            <ActionModal
              visible={showValidationModal}
              type="error"
              title="Validation Error"
              message={validationError}
              confirmText="Close"
              onClose={() => setShowValidationModal(false)}
              onConfirm={() => setShowValidationModal(false)}
            />

            {/* ── Success ──────────────────────────────────────────────────── */}
            <ActionModal
              visible={showSuccessModal}
              type="success"
              title="Booking Added"
              message="The booking was added successfully!"
              onClose={() => { setShowSuccessModal(false); closeModal(); }}
              onConfirm={() => { setShowSuccessModal(false); closeModal(); }}
            />

            {/* ── Error ────────────────────────────────────────────────────── */}
            <ActionModal
              visible={showErrorModal}
              type="error"
              title="Error"
              message={errorMessage}
              confirmText="Close"
              onClose={() => setShowErrorModal(false)}
              onConfirm={() => setShowErrorModal(false)}
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}