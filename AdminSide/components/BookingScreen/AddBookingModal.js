import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  Animated, 
  ScrollView, 
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
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
  CalendarModalComponent,
}) {
  // Initialize empty booking
  const [newBooking, setNewBooking] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    rental_start_date: "",
    rental_end_date: "",
    total_price: "",
    pickup_location: "",
    license_number: "",
    vehicle_id: null,
    vehicle_variant_id: null,
    assigned_driver_id: null,
    gov_id_url: "",
    status: "pending", // Default status for new bookings
  });

  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateField, setDateField] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [vehiclePickerVisible, setVehiclePickerVisible] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [drivers, setDrivers] = useState([]);
  const [driverPickerVisible, setDriverPickerVisible] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible) {
      setNewBooking({
        customer_name: "",
        customer_email: "",
        customer_phone: "",
        rental_start_date: "",
        rental_end_date: "",
        total_price: "",
        pickup_location: "",
        license_number: "",
        vehicle_id: null,
        vehicle_variant_id: null,
        assigned_driver_id: null,
        gov_id_url: "",
        status: "pending",
      });
    }
  }, [visible]);

  useEffect(() => {
    if (visible && (getRoleSync() === "owner" || getRoleSync() === "admin")) {
      appUsersService.listByOwner().then((list) => setDrivers((list || []).filter((u) => u.role === "driver"))).catch(() => setDrivers([]));
    }
  }, [visible]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setDatePickerVisible(false);
      setVehiclePickerVisible(false);
      setDateField(null);
      setConfirmVisible(false);
    }
  }, [visible]);

  const validateBooking = () => {
    const required = [
      'customer_name',
      'customer_email', 
      'customer_phone',
      'rental_start_date',
      'rental_end_date',
      'total_price',
      'vehicle_id',
      'vehicle_variant_id',
      'license_number'
    ];
  
    for (let field of required) {
      if (!newBooking[field]) {
        setValidationError(`Please fill in ${field.replace('_', ' ')}`);
        setShowValidationModal(true);
        return false;
      }
    }
  
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newBooking.customer_email)) {
      setValidationError('Please enter a valid email address');
      setShowValidationModal(true);
      return false;
    }
  
    // Validate date range
    const startDate = new Date(newBooking.rental_start_date);
    const endDate = new Date(newBooking.rental_end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
  
    if (startDate < today) {
      setValidationError('Start date cannot be in the past');
      setShowValidationModal(true);
      return false;
    }
  
    if (endDate <= startDate) {
      setValidationError('End date must be after start date');
      setShowValidationModal(true);
      return false;
    }
  
    return true;
  };
  

  const handleSave = () => {
    if (validateBooking()) {
      setConfirmVisible(true);
    }
  };

  const handleConfirmSave = async () => {
    setLoading(true);
    try {
      const { id } = await bookingsService.add({
        customer_name: newBooking.customer_name,
        customer_email: newBooking.customer_email,
        customer_phone: newBooking.customer_phone,
        rental_start_date: newBooking.rental_start_date,
        rental_end_date: newBooking.rental_end_date,
        total_price: parseFloat(newBooking.total_price),
        pickup_location: newBooking.pickup_location || "",
        license_number: newBooking.license_number,
        vehicle_id: newBooking.vehicle_id,
        vehicle_variant_id: newBooking.vehicle_variant_id,
        assigned_driver_id: newBooking.assigned_driver_id || null,
        gov_id_url: newBooking.gov_id_url,
        status: newBooking.status,
      });

      if (newBooking.status === 'confirmed') {
        try {
          await variantsService.adjustQuantity(newBooking.vehicle_variant_id, -1);
        } catch (e) {
          console.error('Error updating vehicle availability:', e);
        }
      }

      const data = { id, ...newBooking };
      if (onBookingAdded) {
        await onBookingAdded(data);
      }

      setConfirmVisible(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Add booking error:', error);
      setErrorMessage('Something went wrong while adding booking');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = (dateString) => {
    if (dateField === "start") {
      setNewBooking(prev => ({ ...prev, rental_start_date: dateString }));
    } else {
      setNewBooking(prev => ({ ...prev, rental_end_date: dateString }));
    }
    setDatePickerVisible(false);
    setDateField(null);
  };

  const handleDatePickerClose = () => {
    setDatePickerVisible(false);
    setDateField(null);
  };

  const handleVehicleSelect = (variant) => {
    setNewBooking(prev => ({
      ...prev,
      vehicle_id: variant?.vehicle_id || null,
      vehicle_variant_id: variant?.id || null,
      vehicles: variant?.vehicles || null,
      vehicle_variants: variant || null
    }));
    setVehiclePickerVisible(false);
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
                    newBooking.vehicle_variant_id === variant?.id && styles.vehiclePickerItemSelected
                  ]}
                  onPress={() => handleVehicleSelect(variant)}
                >
                  <View style={styles.vehiclePickerItemContent}>
                    <Text style={styles.vehiclePickerText}>
                      {variant?.vehicles?.year || 'N/A'} {variant?.vehicles?.make || 'N/A'} {variant?.vehicles?.model || 'N/A'}
                    </Text>
                    <Text style={styles.vehiclePickerType}>
                      {variant?.color || 'N/A'} • Available: {variant?.available_quantity || 0}
                    </Text>
                  </View>
                  {newBooking.vehicle_variant_id === variant?.id && (
                    <Ionicons name="checkmark" size={20} color="#3b82f6" />
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

  const renderDriverPicker = () => (
    <Modal visible={driverPickerVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.vehiclePickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Assign driver (optional)</Text>
            <TouchableOpacity onPress={() => setDriverPickerVisible(false)}>
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.vehiclePickerItem}
            onPress={() => { setNewBooking(prev => ({ ...prev, assigned_driver_id: null })); setDriverPickerVisible(false); }}
          >
            <Text style={styles.vehiclePickerText}>None</Text>
            {!newBooking.assigned_driver_id && <Ionicons name="checkmark" size={20} color="#3b82f6" />}
          </TouchableOpacity>
          {drivers.map((d) => (
            <TouchableOpacity
              key={d.id}
              style={[styles.vehiclePickerItem, newBooking.assigned_driver_id === d.id && styles.vehiclePickerItemSelected]}
              onPress={() => { setNewBooking(prev => ({ ...prev, assigned_driver_id: d.id })); setDriverPickerVisible(false); }}
            >
              <Text style={styles.vehiclePickerText}>{d.full_name || d.email}</Text>
              {newBooking.assigned_driver_id === d.id && <Ionicons name="checkmark" size={20} color="#3b82f6" />}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );

  // Don't render if modal is not visible
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
                transform: [
                  {
                    translateY: modalAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* HEADER */}
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
                  {loading ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* FORM - Fixed ScrollView with proper keyboard handling */}
            <ScrollView 
              style={{ flex: 1 }}
              contentContainerStyle={{ 
                padding: 16,
                paddingBottom: Platform.OS === "ios" ? 100 : 80 // Extra bottom padding
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bounces={false}
            >
              <BookingForm
                booking={newBooking}
                setBooking={setNewBooking}
                availableVehicles={availableVehicles}
                styles={styles}
                formatDate={formatDate}
                setDatePickerVisible={setDatePickerVisible}
                setVehiclePickerVisible={setVehiclePickerVisible}
                setDateField={setDateField}
                isEdit={false}
              />
              {drivers.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6 }}>Assign driver (optional)</Text>
                  <TouchableOpacity
                    style={[styles.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
                    onPress={() => setDriverPickerVisible(true)}
                  >
                    <Text style={{ color: newBooking.assigned_driver_id ? "#111" : "#9ca3af" }}>
                      {newBooking.assigned_driver_id ? (drivers.find((d) => d.id === newBooking.assigned_driver_id)?.full_name || drivers.find((d) => d.id === newBooking.assigned_driver_id)?.email) : "None"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            {/* Vehicle Picker */}
            {renderVehiclePicker()}
            {renderDriverPicker()}

            {/* DATE PICKER */}
            {CalendarModalComponent && (
              <CalendarModalComponent
                visible={datePickerVisible && !!dateField}
                onClose={handleDatePickerClose}
                onDateSelect={handleDateSelect}
                selectedDate={
                  dateField === "start" ? newBooking.rental_start_date : newBooking.rental_end_date
                }
                title={dateField === "start" ? "Select Start Date" : "Select End Date"}
                minDate={
                  dateField === "end" && newBooking.rental_start_date
                    ? newBooking.rental_start_date
                    : new Date().toISOString().split("T")[0]
                }
              />
            )}

            {/* CONFIRM MODAL */}
            <ActionModal
              visible={confirmVisible}
              type="confirm"
              title="Add Booking"
              message="Are you sure you want to add this booking?"
              confirmText="Add Booking"
              loading={loading}
              onClose={() => setConfirmVisible(false)}
              onConfirm={handleConfirmSave}
            />
            
            {/* VALIDATION ERROR MODAL */}
            <ActionModal
              visible={showValidationModal}
              type="error"
              title="Validation Error"
              message={validationError}
              confirmText="Close"
              onClose={() => setShowValidationModal(false)}
              onConfirm={() => setShowValidationModal(false)}
            />
            
            {/* SUCCESS MODAL */}
            <ActionModal
              visible={showSuccessModal}
              type="success"
              title="Success"
              message="Booking added successfully!"
              onClose={() => {
                setShowSuccessModal(false);
                closeModal();
              }}
              onConfirm={() => {
                setShowSuccessModal(false);
                closeModal();
              }}
            />
            
            {/* ERROR MODAL */}
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