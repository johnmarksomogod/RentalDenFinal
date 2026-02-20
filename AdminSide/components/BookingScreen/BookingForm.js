import React, { useMemo, useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Image, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Dropdown } from "react-native-element-dropdown";
import * as ImagePicker from "expo-image-picker"
import * as ImageManipulator from "expo-image-manipulator";
import { vehiclesService, variantsService, storageService } from "../../services/firebaseService";

export default function BookingForm({
  booking,
  setBooking,
  availableVehicles,
  styles,
  formatDate,
  setDatePickerVisible,
  setDateField,
  isEdit = false,
}) {
  const [allVehicles, setAllVehicles] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [vehicleDetails, setVehicleDetails] = useState(null);

  // Fetch ALL vehicles when editing (not just available ones)
  useEffect(() => {
    if (isEdit && booking?.vehicle_id) {
      fetchAllVehicles();
    }
  }, [isEdit, booking?.vehicle_id]);

  // Fetch vehicle details including price when vehicle is selected
  useEffect(() => {
    if (booking?.vehicle_id) {
      fetchVehicleDetails(booking.vehicle_id);
    }
  }, [booking?.vehicle_id]);

  // Auto-calculate total price when dates or vehicle changes
  useEffect(() => {
    if (!isEdit && booking?.rental_start_date && booking?.rental_end_date && vehicleDetails?.price_per_day) {
      const startDate = new Date(booking.rental_start_date);
      const endDate = new Date(booking.rental_end_date);
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 0) {
        const totalPrice = diffDays * vehicleDetails.price_per_day;
        updateBooking((prev) => ({ 
          ...prev, 
          total_price: totalPrice.toString(),
          rental_days: diffDays
        }));
      }
    }
  }, [booking?.rental_start_date, booking?.rental_end_date, vehicleDetails?.price_per_day, isEdit]);

  // Auto-calculate total price when dates or vehicle changes
  useEffect(() => {
    if (booking?.rental_start_date && booking?.rental_end_date && vehicleDetails?.price_per_day) {
      const startDate = new Date(booking.rental_start_date);
      const endDate = new Date(booking.rental_end_date);

      // Only calculate if end > start
      if (endDate <= startDate) return;

      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        const totalPrice = diffDays * vehicleDetails.price_per_day;

        updateBooking((prev) => ({
          ...prev,
          total_price: totalPrice.toString(),
          rental_days: diffDays,
        }));
      }
    }
  }, [booking?.rental_start_date, booking?.rental_end_date, vehicleDetails?.price_per_day]);

  const fetchVehicleDetails = async (vehicleId) => {
    try {
      const data = await vehiclesService.getById(vehicleId);
      if (data) setVehicleDetails({ price_per_day: data.price_per_day });
    } catch (error) {
      console.error('Error fetching vehicle details:', error);
    }
  };

  const fetchAllVehicles = async () => {
    try {
      const data = await variantsService.listWithVehicles();
      setAllVehicles(data || []);
    } catch (error) {
      console.error('Error fetching all vehicles:', error);
    }
  };

  // Calculate rental days for display
  const calculateRentalDays = () => {
    if (booking?.rental_start_date && booking?.rental_end_date) {
      const startDate = new Date(booking.rental_start_date);
      const endDate = new Date(booking.rental_end_date);
      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    }
    return 0;
  };

  // Image upload - same approach as AddVehicleScreen (fetch + blob)
  const uploadImage = async (uri) => {
    if (!uri) return null;

    try {
      let processedUri = uri;

      // Convert HEIC to JPEG on iOS if needed
      if (uri.toLowerCase().endsWith(".heic")) {
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );
        processedUri = manipResult.uri;
      } else {
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );
        processedUri = manipResult.uri;
      }

      const fileExt = processedUri.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt = fileExt === "heic" ? "jpg" : fileExt;
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${safeExt}`;

      const response = await fetch(processedUri);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      const blob = await response.blob();
      return await storageService.uploadGovId(fileName, blob);
    } catch (err) {
      console.error("Upload error:", err);
      throw err;
    }
  };

  // Use allVehicles for edit mode, availableVehicles for add mode
  const vehicleSource = isEdit ? allVehicles : (availableVehicles || []);

  // Deduped list of vehicles
  const uniqueVehicles = useMemo(() => {
    const map = {};
    vehicleSource.forEach((variant) => {
      const vid = variant.vehicle_id;
      if (!vid) return;
      if (!map[vid]) {
        map[vid] = {
          vehicle_id: vid,
          make: variant.vehicles?.make,
          model: variant.vehicles?.model,
          year: variant.vehicles?.year,
          price_per_day: variant.vehicles?.price_per_day,
        };
      }
    });
    return Object.values(map);
  }, [vehicleSource]);

  // Variants for the selected vehicle
  const variants = useMemo(() => {
    if (!booking?.vehicle_id) return [];
    return vehicleSource
      .filter((v) => v.vehicle_id === booking.vehicle_id)
      .map((v) => ({
        label: `${v.color} (${v.available_quantity}/${v.total_quantity})`,
        value: v.id,
        color: v.color,
        available: v.available_quantity,
        total: v.total_quantity,
      }));
  }, [vehicleSource, booking?.vehicle_id]);

  // Enhanced Gov ID upload function
  const pickGovIdFile = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission Required", "Please grant camera roll permission to upload an ID.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
        aspect: [4, 3],
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingImage(true);
        
        try {
          const uploadedUrl = await uploadImage(result.assets[0].uri);
          if (uploadedUrl && setBooking) {
            updateBooking((prev) => ({ ...prev, gov_id_url: uploadedUrl }));
           
          }
        } catch (error) {
          console.error("Upload error:", error);

        } finally {
          setUploadingImage(false);
        }
      }
    } catch (error) {
      console.error("Image picker error:", error);
      Alert.alert("Error", "Failed to open image picker. Please try again.");
      setUploadingImage(false);
    }
  };

  // Safety check for setBooking
  const updateBooking = (updater) => {
    if (typeof setBooking === 'function') {
      setBooking(updater);
    } else {
      console.warn('setBooking is not a function:', setBooking);
    }
  };

  // Calculate minimum end date (next day after start date)
  const getMinEndDate = () => {
    if (!booking?.rental_start_date) return new Date().toISOString().split("T")[0];
    
    const startDate = new Date(booking.rental_start_date);
    const minEndDate = new Date(startDate);
    minEndDate.setDate(startDate.getDate() + 1);
    return minEndDate.toISOString().split("T")[0];
  };

  if (!booking) {
    return (
      <View style={styles.section}>
        <Text style={styles.emptyStateText}>No booking data available</Text>
      </View>
    );
  }

  const rentalDays = calculateRentalDays();
  const formatSignedAt = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });
  };

  return (
    <View>
      {/* Customer Info */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="person-circle-outline" size={20} color="black" />
          <Text style={styles.sectionTitle}>Customer Information</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Customer Name *</Text>
          <TextInput
            style={styles.input}
            value={booking.customer_name || ""}
            onChangeText={(text) =>
              updateBooking((prev) => ({ ...prev, customer_name: text }))
            }
            placeholder="Enter customer name"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email *</Text>
          <TextInput
            style={styles.input}
            value={booking.customer_email || ""}
            onChangeText={(text) =>
              updateBooking((prev) => ({ ...prev, customer_email: text }))
            }
            keyboardType="email-address"
            placeholder="Enter email"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Phone</Text>
          <TextInput
            style={styles.input}
            value={booking.customer_phone || ""}
            onChangeText={(text) =>
              updateBooking((prev) => ({ ...prev, customer_phone: text }))
            }
            keyboardType="phone-pad"
            placeholder="+63 xxx xxxx xxx"
          />
        </View>
      </View>

      {/* Rental Details */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="car-outline" size={20} color="black" />
          <Text style={styles.sectionTitle}>Rental Details</Text>
        </View>

        {/* Vehicle Dropdown */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Vehicle</Text>
          <Dropdown
            style={styles.input}
            data={uniqueVehicles.map((v) => ({
              label: `${v.year} ${v.make} ${v.model} - ₱${v.price_per_day}/day`,
              value: v.vehicle_id,
              price_per_day: v.price_per_day,
            }))}
            
            labelField="label"
            valueField="value"
            placeholder="Select vehicle"
            value={booking.vehicle_id}
            onChange={(item) =>
              updateBooking((prev) => ({
                ...prev,
                vehicle_id: item.value,
                vehicle_variant_id: null, // reset variant when vehicle changes
              }))
            }
            search
            searchPlaceholder="Search vehicles..."
            maxHeight={300}
            renderItem={(item, selected) => (
              <View style={[
                { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
                selected && { backgroundColor: '#f0f9ff' }
              ]}>
                <Text style={[
                  { fontSize: 16, color: '#1f2937', fontWeight: '500' },
                  selected && { color: '#3b82f6', fontWeight: '600' }
                ]}>{item.label}</Text>
              </View>
            )}
          />
        </View>
            
        {/* Variant Dropdown */}
        {variants.length > 0 && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Variant Color & Availability</Text>
            <Dropdown
              style={styles.input}
              data={variants}
              labelField="label"
              valueField="value"
              placeholder="Select color variant"
              value={booking.vehicle_variant_id}
              onChange={(item) =>
                updateBooking((prev) => ({
                  ...prev,
                  vehicle_variant_id: item.value,
                }))
              }
              renderItem={(item, selected) => (
                <View style={[
                  { 
                    padding: 12, 
                    borderBottomWidth: 1, 
                    borderBottomColor: '#f3f4f6',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  },
                  selected && { backgroundColor: '#f0f9ff' },
                  item.available === 0 && { backgroundColor: '#fef2f2', opacity: 0.7 }
                ]}>
                  <View>
                    <Text style={[
                      { fontSize: 16, color: '#1f2937', fontWeight: '500' },
                      selected && { color: '#3b82f6', fontWeight: '600' },
                      item.available === 0 && { color: '#9ca3af' }
                    ]}>{item.color}</Text>
                    <Text style={[
                      { fontSize: 12, color: '#6b7280', marginTop: 2 },
                      selected && { color: '#3b82f6' },
                      item.available === 0 && { color: '#9ca3af' }
                    ]}>
                      Available: {item.available}/{item.total}
                    </Text>
                  </View>
                  {item.available === 0 && (
                    <Text style={{
                      fontSize: 10,
                      color: '#ef4444',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      backgroundColor: '#fef2f2',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 4,
                    }}>Unavailable</Text>
                  )}
                </View>
              )}
            />
          </View>
        )}

        {/* Dates */}
        <View style={styles.inputRow}>
          <View style={[styles.inputGroup, styles.inputHalf]}>
            <Text style={styles.inputLabel}>Start Date</Text>
            <TouchableOpacity
              onPress={() => {
                if (setDatePickerVisible && setDateField) {
                  setDatePickerVisible(true);
                  setDateField("start");
                }
              }}
              style={[styles.input, styles.dateInput]}
            >
              <Text style={[
                styles.dateInputText,
                !booking.rental_start_date && styles.placeholderText
              ]}>
                {booking.rental_start_date
                  ? formatDate(booking.rental_start_date)
                  : "Select start date"}
              </Text>
              <Ionicons name="calendar-outline" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <View style={[styles.inputGroup, styles.inputHalf]}>
            <Text style={styles.inputLabel}>End Date</Text>
            <TouchableOpacity
              onPress={() => {
                if (!booking.rental_start_date) {
                  Alert.alert("Select Start Date", "Please select a start date first.");
                  return;
                }
                if (setDatePickerVisible && setDateField) {
                  setDatePickerVisible(true);
                  setDateField("end");
                }
              }}
              style={[
                styles.input, 
                styles.dateInput,
                !booking.rental_start_date && { opacity: 0.5 }
              ]}
              disabled={!booking.rental_start_date}
            >
              <Text style={[
                styles.dateInputText,
                !booking.rental_end_date && styles.placeholderText
              ]}>
                {booking.rental_end_date
                  ? formatDate(booking.rental_end_date)
                  : "Select end date"}
              </Text>
              <Ionicons name="calendar-outline" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Price Calculation Display */}
        {!isEdit && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Price Calculation</Text>
            <View style={styles.priceCalculationContainer}>
              {vehicleDetails?.price_per_day && rentalDays > 0 ? (
                <View>
                  <Text style={styles.calculationText}>
                    ₱{vehicleDetails.price_per_day}/day × {rentalDays} day{rentalDays > 1 ? 's' : ''}
                  </Text>
                  <Text style={styles.totalPriceText}>
                    Total: ₱{(vehicleDetails.price_per_day * rentalDays).toLocaleString()}
                  </Text>
                </View>
              ) : (
                <Text style={styles.calculationPlaceholder}>
                  Select vehicle and dates to see price calculation
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Total Price (editable in edit mode) */}
        {isEdit && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Total Price (₱)</Text>
            <TextInput
              style={styles.input}
              value={booking.total_price?.toString() || ""}
              onChangeText={(text) =>
                updateBooking((prev) => ({ ...prev, total_price: text }))
              }
              keyboardType="numeric"
              placeholder="Enter total price"
            />
          </View>
        )}

        {/* Pickup Location */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Pickup Location</Text>
          <TextInput
            style={styles.input}
            value={booking.pickup_location || ""}
            onChangeText={(text) =>
              updateBooking((prev) => ({ ...prev, pickup_location: text }))
            }
            placeholder="Enter pickup location"
            multiline
            numberOfLines={2}
          />
        </View>

        {/* License */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>License Number</Text>
          <TextInput
            style={styles.input}
            value={booking.license_number || ""}
            onChangeText={(text) =>
              updateBooking((prev) => ({ ...prev, license_number: text }))
            }
            placeholder="Enter license number"
            autoCapitalize="characters"
          />
        </View>

        {/* Gov ID */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Driver's License Card</Text>
          <TouchableOpacity 
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'black',
                borderWidth: 2,
                borderColor: '#e0f2fe',
                borderStyle: 'dashed',
                borderRadius: 8,
                paddingVertical: 16,
                paddingHorizontal: 20,
                justifyContent: 'center',
                gap: 8,
                marginTop: 4,
              },
              uploadingImage && {
                backgroundColor: '#f9fafb',
                borderColor: '#e5e7eb',
              }
            ]} 
            onPress={pickGovIdFile}
            disabled={uploadingImage}
          >
            {uploadingImage ? (
              <>
                <Ionicons name="cloud-upload" size={16} color="white" />
                <Text style={{
                  fontSize: 16,
                  color: 'white',
                  fontWeight: '500',
                }}>Uploading...</Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={16} color="white" />
                <Text style={{
                  fontSize: 16,
                  color: 'white',
                  fontWeight: '500',
                }}>
                  {booking.gov_id_url ? "Change Driver's License Card" : "Upload Driver's License Card"}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          {booking.gov_id_url && (
            <View style={{
              marginTop: 12,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: '#f3f4f6',
            }}>
              <Image
                key={booking.gov_id_url}
                source={{ uri: booking.gov_id_url }}
                style={{
                  width: '100%',
                  height: 120,
                  borderRadius: 8,
                }}
                resizeMode="cover"
              />
              <View style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(0,0,0,0.7)',
                paddingVertical: 8,
                paddingHorizontal: 12,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <Text style={{
                  color: 'white',
                  fontSize: 12,
                  fontWeight: '500',
                }}>Government ID Preview</Text>
                <TouchableOpacity
                  style={{
                    padding: 4,
                    borderRadius: 4,
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  }}
                  onPress={() => updateBooking(prev => ({ ...prev, gov_id_url: "" }))}
                >
                  <Ionicons name="trash-outline" size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {booking.contract_text?.trim()?.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text-outline" size={20} color="black" />
              <Text style={styles.sectionTitle}>Signed Contract</Text>
            </View>

            <View style={styles.contractCard}>
              {booking.contract_text.split(/\n{2,}/).map((paragraph, idx) => (
                <Text key={`contract-paragraph-${idx}`} style={styles.contractParagraph}>
                  {paragraph}
                </Text>
              ))}

              <View style={styles.contractMetaRow}>
                <Text style={styles.contractSignatureLabel}>
                  Signed by{" "}
                  <Text style={styles.contractSignatureValue}>
                    {booking.contract_signed_name || "Customer"}
                  </Text>
                </Text>
                {booking.contract_signed_at ? (
                  <Text style={styles.contractMetaText}>
                    {formatSignedAt(booking.contract_signed_at)}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* Status (Edit only) */}
        {isEdit && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Booking Status</Text>
            <Dropdown
              style={styles.input}
              data={[
                { label: "Pending", value: "pending" },
                { label: "Confirmed", value: "confirmed" },
                { label: "Completed", value: "completed" },
                { label: "Cancelled", value: "cancelled" },
                { label: "Declined", value: "declined" },
              ]}
              labelField="label"
              valueField="value"
              placeholder="Select status"
              value={booking.status}
              onChange={(item) =>
                updateBooking((prev) => ({ 
                  ...prev, 
                  status: item.value,
                  // Clear decline reason if status is not declined
                  decline_reason: item.value !== 'declined' ? '' : prev.decline_reason
                }))
              }
              renderItem={(item, selected) => (
                <View style={[
                  { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
                  selected && { backgroundColor: '#f0f9ff' }
                ]}>
                  <Text style={[
                    { fontSize: 16, color: '#1f2937', fontWeight: '500' },
                    selected && { color: '#3b82f6', fontWeight: '600' }
                  ]}>{item.label}</Text>
                </View>
              )}
            />
          </View>
        )}

        {/* Decline Reason (only show when status is declined) */}
        {isEdit && booking.status === 'declined' && (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Decline Reason *</Text>
            <TextInput
              style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
              value={booking.decline_reason || ""}
              onChangeText={(text) =>
                updateBooking((prev) => ({ ...prev, decline_reason: text }))
              }
              placeholder="Please provide a reason for declining this booking..."
              multiline
              numberOfLines={3}
            />
            <Text style={styles.inputHint}>
              This reason will be included in the email notification to the customer.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}