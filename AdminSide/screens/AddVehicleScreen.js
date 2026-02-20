"use client"

import { useState, useEffect } from "react"
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  Dimensions,
  Modal,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import * as ImagePicker from "expo-image-picker"
import { vehiclesService, variantsService, carOwnersService, storageService } from "../services/firebaseService"
import { decode } from 'base64-arraybuffer'
import * as FileSystem from 'expo-file-system/legacy'
import ActionModal from "../components/AlertModal/ActionModal"
import * as ImageManipulator from 'expo-image-manipulator'
import { ref, uploadBytes } from "firebase/storage";
import { storage } from "../services/firebase"



const { width } = Dimensions.get("window")
const isWeb = Platform.OS === "web"

export default function AddVehicleScreen({ navigation, route }) {
  const editingVehicle = route?.params?.vehicle
  const isEditing = !!editingVehicle

  const [formData, setFormData] = useState({
    make: editingVehicle?.make || "",
    model: editingVehicle?.model || "",
    year: editingVehicle?.year?.toString() || "",
    type: editingVehicle?.type || "",
    seats: editingVehicle?.seats?.toString() || "",
    mileage: editingVehicle?.mileage?.toString() || "",
    description: editingVehicle?.description || "",
    available: editingVehicle?.available ?? true,
  })

  const [carOwners, setCarOwners] = useState([]);
  const [ownerDropdownVisible, setOwnerDropdownVisible] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  const [feedbackModal, setFeedbackModal] = useState({
    visible: false,
    type: "success", 
    message: ""
  })
  
  const handleFeedbackModalClose = () => {
    setFeedbackModal({ visible: false, type: "success", message: "" })
    
    if (feedbackModal.type === "success") {
      navigation.goBack()
    }
  }

  // MODIFIED: Removed totalQuantity and availableQuantity, added isAvailable
  const [colorVariants, setColorVariants] = useState([
    {
      id: Date.now(),
      color: "",
      plateNumber: "",
      pricePerDay: "",
      isAvailable: true, // NEW: Availability toggle instead of quantities
      imageUri: null,
      imageUrl: null,
      ownerId: null
    }
  ])

  const [loading, setLoading] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showDeleteVariantModal, setShowDeleteVariantModal] = useState(false)
  const [variantToDelete, setVariantToDelete] = useState(null)
  const [showCustomType, setShowCustomType] = useState(false)
  const [customType, setCustomType] = useState("")

  const vehicleTypes = ["Sedan", "SUV", "Hatchback", "Convertible", "Truck", "Van", "Luxury", "Other"]

  useEffect(() => {
    fetchCarOwners();
  }, []);

  const fetchCarOwners = async () => {
    try {
      const data = await carOwnersService.list();
      const sortedOwners = (data || []).sort((a, b) => {
        if (a.name.toLowerCase() === 'rental den') return -1;
        if (b.name.toLowerCase() === 'rental den') return 1;
        return a.name.localeCompare(b.name);
      });

      setCarOwners(sortedOwners);
    } catch (error) {
      console.error('Error in fetchCarOwners:', error);
    }
  };

  useEffect(() => {
    if (isEditing && editingVehicle?.id) {
      loadExistingVariants()
      
      // Check if the vehicle type is a custom one
      if (editingVehicle.type && !vehicleTypes.slice(0, -1).includes(editingVehicle.type)) {
        setShowCustomType(true)
        setCustomType(editingVehicle.type)
        setFormData(prev => ({ ...prev, type: "Other" }))
      }
    }
  }, [isEditing, editingVehicle?.id])

  // MODIFIED: Load existing variants with is_available field
  const loadExistingVariants = async () => {
    try {
      const variants = await variantsService.listByVehicleId(editingVehicle.id);

      if (!variants) {
        console.error('Error loading variants:', error)
        return
      }

      if (variants && variants.length > 0) {
        const formattedVariants = variants.map(variant => ({
          id: variant.id,
          color: variant.color,
          plateNumber: variant.plate_number || "",
          pricePerDay: variant.price_per_day?.toString() || "",
          isAvailable: variant.is_available ?? true, // MODIFIED: Use is_available field
          imageUri: variant.image_url,
          imageUrl: variant.image_url,
          ownerId: variant.owner_id
        }))
        setColorVariants(formattedVariants)
      }
    } catch (error) {
      console.error('Error in loadExistingVariants:', error)
    }
  }

  // MODIFIED: New variant includes isAvailable instead of quantities
  const addColorVariant = () => {
    const newVariant = {
      id: Date.now(),
      color: "",
      plateNumber: "",
      pricePerDay: "",
      isAvailable: true, // NEW
      imageUri: null,
      imageUrl: null,
      ownerId: null
    }
    setColorVariants([...colorVariants, newVariant])
  }

  const handleRemoveVariant = (variantId) => {
    if (colorVariants.length > 1) {
      setVariantToDelete(variantId)
      setShowDeleteVariantModal(true)
    }
  }

  const confirmRemoveVariant = () => {
    if (variantToDelete) {
      setColorVariants(colorVariants.filter(variant => variant.id !== variantToDelete))
      setVariantToDelete(null)
    }
    setShowDeleteVariantModal(false)
  }

  const updateColorVariant = (variantId, field, value) => {
    setColorVariants(colorVariants.map(variant => 
      variant.id === variantId 
        ? { ...variant, [field]: value }
        : variant
    ))
  }

  const openOwnerSelector = (variantId) => {
    setSelectedVariantId(variantId);
    setOwnerDropdownVisible(true);
  }

  const selectOwnerForVariant = (ownerId) => {
    if (selectedVariantId) {
      updateColorVariant(selectedVariantId, 'ownerId', ownerId);
    }
    setOwnerDropdownVisible(false);
    setSelectedVariantId(null);
  }

  const pickImageForVariant = async (variantId) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()

    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant camera roll permissions to upload images.")
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    })

    if (!result.canceled) {
      updateColorVariant(variantId, 'imageUri', result.assets[0].uri)
    }
  }

  const uploadImage = async (uri) => {
    if (!uri) return null;
  
    try {
      let processedUri = uri;
  
      // Convert HEIC images to JPEG on iOS
      if (uri.toLowerCase().endsWith(".heic")) {
        const manipResult = await ImageManipulator.manipulateAsync(
          uri,
          [],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );
        processedUri = manipResult.uri;
      }
  
      const fileExt = processedUri.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt = fileExt === "heic" ? "jpg" : fileExt;
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${safeExt}`;
      const filePath = `vehicle-variants/${fileName}`;
  
      if (Platform.OS === "web") {
        // Web: fetch as blob
        const response = await fetch(processedUri);
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
        const blob = await response.blob();
        return await storageService.uploadVehicleImage(filePath, blob);
      } else {
        // React Native (iOS / Android): fetch local file as blob
        const response = await fetch(processedUri);
        const blob = await response.blob(); // this works for local files on RN
        return await storageService.uploadVehicleImage(filePath, blob);
      }
    } catch (err) {
      console.error("Upload error:", err);
      throw err;
    }
  };
  

  const handleTypeSelection = (type) => {
    if (type === "Other") {
      setShowCustomType(true)
      setFormData({ ...formData, type })
    } else {
      setShowCustomType(false)
      setCustomType("")
      setFormData({ ...formData, type })
    }
  }

  // MODIFIED: Updated validation - removed quantity checks
  const validateForm = () => {
    if (!formData.make || !formData.model || !formData.year || !formData.seats) {
      Alert.alert("Error", "Please fill in all required basic information fields")
      return false
    }

    if (!formData.type) {
      Alert.alert("Error", "Please select a vehicle type")
      return false
    }

    if (formData.type === "Other" && !customType.trim()) {
      Alert.alert("Error", "Please enter a custom vehicle type")
      return false
    }

    if (Number.parseInt(formData.seats) < 1 || Number.parseInt(formData.seats) > 50) {
      Alert.alert("Error", "Please enter a valid number of seats (1-50)")
      return false
    }

    const validVariants = colorVariants.filter(variant => variant.color.trim() !== "")
    
    if (validVariants.length === 0) {
      Alert.alert("Error", "Please add at least one color variant")
      return false
    }

    for (let variant of validVariants) {
      if (!variant.plateNumber || variant.plateNumber.trim() === "") {
        Alert.alert("Error", `Please enter a plate number for ${variant.color || 'variant ' + (validVariants.indexOf(variant) + 1)}`)
        return false
      }
      if (!variant.pricePerDay || variant.pricePerDay.trim() === "") {
        Alert.alert("Error", `Please enter a price per day for ${variant.color || 'variant ' + (validVariants.indexOf(variant) + 1)}`)
        return false
      }
      if (Number.parseFloat(variant.pricePerDay) <= 0) {
        Alert.alert("Error", `Price per day for ${variant.color} must be greater than 0`)
        return false
      }
      if (!variant.ownerId) {
        Alert.alert("Error", `Please select an owner for ${variant.color || 'variant ' + (validVariants.indexOf(variant) + 1)}`)
        return false
      }
    }

    return true
  }

  const handleSubmitPress = () => {
    if (!validateForm()) return
    setShowConfirmModal(true)
  }

  // MODIFIED: Updated submit handler to use is_available
  const handleSubmit = async () => {
    setShowConfirmModal(false)
    setLoading(true)
  
    try {
      const validVariants = colorVariants.filter(variant => variant.color.trim() !== "")
  
      const variantsWithImages = await Promise.all(
        validVariants.map(async (variant) => {
          let imageUrl = variant.imageUrl
  
          if (variant.imageUri && variant.imageUri !== variant.imageUrl) {
            try {
              imageUrl = await uploadImage(variant.imageUri)
            } catch (uploadError) {
              console.error('Image upload failed for variant:', variant.color, uploadError)
            }
          }
  
          return {
            ...variant,
            imageUrl
          }
        })
      )
  
      // MODIFIED: Calculate totals based on count and availability
      const totalQuantity = variantsWithImages.length
      const availableQuantity = variantsWithImages.filter(v => v.isAvailable).length
      
      const finalType = formData.type === "Other" ? customType.trim() : formData.type
      
      const vehicleData = {
        make: formData.make,
        model: formData.model,
        year: Number.parseInt(formData.year),
        type: finalType,
        seats: Number.parseInt(formData.seats),
        price_per_day: Number.parseFloat(variantsWithImages[0]?.pricePerDay || "0"),
        mileage: formData.mileage ? Number.parseInt(formData.mileage) : null,
        description: formData.description,
        available: formData.available,
        total_quantity: totalQuantity,
        available_quantity: availableQuantity,
        image_url: variantsWithImages[0]?.imageUrl || null,
        owner_id: variantsWithImages[0]?.ownerId || null,
        updated_at: new Date().toISOString(),
        owner_name: carOwners.find(o => o.id === variantsWithImages[0]?.ownerId)?.name || null,

      }
  
      let vehicleId = editingVehicle?.id
  
      if (isEditing) {
        await vehiclesService.update(editingVehicle.id, vehicleData);
        await variantsService.deleteByVehicleId(editingVehicle.id);
      } else {
        const { id } = await vehiclesService.add(vehicleData);
        vehicleId = id;
      }

      for (const variant of variantsWithImages) {
        await variantsService.add({
          vehicle_id: vehicleId,
          color: variant.color,
          plate_number: variant.plateNumber.trim().toUpperCase(),
          price_per_day: Number.parseFloat(variant.pricePerDay),
          image_url: variant.imageUrl,
          is_available: variant.isAvailable,
          available_quantity: variant.isAvailable ? 1 : 0,
          total_quantity: 1,
          owner_id: variant.ownerId,
        });
      }
  
      setFeedbackModal({
        visible: true,
        type: "success",
        message: isEditing ? "Vehicle updated successfully! All changes have been saved." : "Vehicle added successfully! Your new vehicle is now available in the fleet."
      })
  
    } catch (error) {
      console.error("Error saving vehicle:", error)
      
      setFeedbackModal({
        visible: true,
        type: "error",
        message: `Failed to ${isEditing ? 'update' : 'save'} vehicle: ${error.message}`
      })
    } finally {
      setLoading(false)
    }
  }

  const renderTypeSelector = () => (
    <View style={styles.typeSelector}>
      <Text style={styles.label}>Vehicle Type *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScrollView}>
        {vehicleTypes.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.typeButton, formData.type === type && styles.selectedTypeButton]}
            onPress={() => handleTypeSelection(type)}
          >
            <Text style={[styles.typeButtonText, formData.type === type && styles.selectedTypeButtonText]}>{type}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {showCustomType && (
        <View style={styles.customTypeContainer}>
          <TextInput
            style={styles.input}
            value={customType}
            onChangeText={setCustomType}
            placeholder="Enter custom vehicle type (e.g., Coupe, Minivan)"
            placeholderTextColor="#9ca3af"
            autoFocus
          />
        </View>
      )}
    </View>
  )

  // MODIFIED: Updated variant rendering with availability toggle
  const renderColorVariant = (variant, index) => (
    <View key={variant.id} style={styles.variantCard}>
      <View style={styles.variantHeader}>
        <Text style={styles.variantTitle}>Color Variant {index + 1}</Text>
        {colorVariants.length > 1 && (
          <TouchableOpacity
            style={styles.removeVariantButton}
            onPress={() => handleRemoveVariant(variant.id)}
          >
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.inputRow, isWeb && styles.inputRowWeb]}>
        <View style={[styles.inputGroup, { flex: 2 }]}>
          <Text style={styles.label}>Color Name *</Text>
          <TextInput
            style={styles.input}
            value={variant.color}
            onChangeText={(text) => updateColorVariant(variant.id, 'color', text)}
            placeholder="e.g., Pearl White, Midnight Black"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Image</Text>
          <TouchableOpacity
            style={styles.variantImageUpload}
            onPress={() => pickImageForVariant(variant.id)}
          >
            {variant.imageUri ? (
              <Image source={{ uri: variant.imageUri }} style={styles.variantImage} />
            ) : (
              <View style={styles.variantImagePlaceholder}>
                <Ionicons name="camera" size={20} color="#9ca3af" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.inputRow, isWeb && styles.inputRowWeb]}>
        <View style={[styles.inputGroup, styles.inputHalf]}>
          <Text style={styles.label}>Plate Number *</Text>
          <TextInput
            style={styles.input}
            value={variant.plateNumber}
            onChangeText={(text) => updateColorVariant(variant.id, 'plateNumber', text.toUpperCase())}
            placeholder="e.g., ABC-1234"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
          />
        </View>

        <View style={[styles.inputGroup, styles.inputHalf]}>
          <Text style={styles.label}>Price per Day (₱) *</Text>
          <TextInput
            style={styles.input}
            value={variant.pricePerDay}
            onChangeText={(text) => updateColorVariant(variant.id, 'pricePerDay', text)}
            placeholder="e.g., 50.00"
            placeholderTextColor="#9ca3af"
            keyboardType="decimal-pad"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Owner *</Text>
        <TouchableOpacity
          style={styles.ownerSelector}
          onPress={() => openOwnerSelector(variant.id)}
        >
          <View style={styles.ownerSelectorContent}>
            <Ionicons name="person-circle" size={20} color="#6b7280" />
            <Text style={[styles.ownerSelectorText, !variant.ownerId && styles.placeholderText]}>
              {variant.ownerId 
                ? carOwners.find(o => o.id === variant.ownerId)?.name || 'Select vehicle owner'
                : 'Select vehicle owner'
              }
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      {/* NEW: Availability Toggle Section */}
      <View style={[styles.availabilityContainer, {
        backgroundColor: variant.isAvailable ? '#f0fdf4' : '#fef2f2',
        borderColor: variant.isAvailable ? '#bbf7d0' : '#fecaca'
      }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.availabilityLabel}>Vehicle Availability</Text>
          <Text style={styles.availabilitySubtext}>
            {variant.isAvailable 
              ? 'This vehicle is available for rent'
              : 'Unavailable (Maintenance/Issue)'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.toggleSwitch, {
            backgroundColor: variant.isAvailable ? '#22c55e' : '#ef4444'
          }]}
          onPress={() => updateColorVariant(variant.id, 'isAvailable', !variant.isAvailable)}
          activeOpacity={0.7}
        >
          <View style={[styles.toggleThumb, {
            transform: [{ translateX: variant.isAvailable ? 24 : 0 }]
          }]} />
        </TouchableOpacity>
      </View>

      {/* NEW: Warning message when unavailable */}
      {!variant.isAvailable && (
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={14} color="#991b1b" style={{ marginRight: 6 }} />
          <Text style={styles.warningText}>
            This vehicle will not appear as available to customers
          </Text>
        </View>
      )}
    </View>
  )

  return (
    <View style={styles.safeArea}>
      <ActionModal
        visible={feedbackModal.visible}
        type={feedbackModal.type}
        title={feedbackModal.type === "success" ? "Success" : "Error"}
        message={feedbackModal.message}
        confirmText="OK"
        onClose={handleFeedbackModalClose}
        onConfirm={handleFeedbackModalClose}
      />
      
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          isWeb && styles.scrollContentWeb,
          { paddingBottom: isWeb ? 40 : 90 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit Vehicle' : 'Add Vehicle'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.form, isWeb && styles.formWeb]}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Basic Information</Text>

            <View style={[styles.inputRow, isWeb && styles.inputRowWeb]}>
              <View style={[styles.inputGroup, styles.inputHalf]}>
                <Text style={styles.label}>Make *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.make}
                  onChangeText={(text) => setFormData({ ...formData, make: text })}
                  placeholder="e.g., Toyota, Honda, BMW"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={[styles.inputGroup, styles.inputHalf]}>
                <Text style={styles.label}>Model *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.model}
                  onChangeText={(text) => setFormData({ ...formData, model: text })}
                  placeholder="e.g., Camry, Civic, X5"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <View style={[styles.inputRow, isWeb && styles.inputRowWeb]}>
              <View style={[styles.inputGroup, styles.inputHalf]}>
                <Text style={styles.label}>Year *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.year}
                  onChangeText={(text) => setFormData({ ...formData, year: text })}
                  placeholder="e.g., 2023"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, styles.inputHalf]}>
                <Text style={styles.label}>Seats *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.seats}
                  onChangeText={(text) => setFormData({ ...formData, seats: text })}
                  placeholder="e.g., 5"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {renderTypeSelector()}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Additional Details</Text>
            <Text style={styles.sectionSubtitle}>Optional information about the vehicle</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mileage</Text>
              <TextInput
                style={styles.input}
                value={formData.mileage}
                onChangeText={(text) => setFormData({ ...formData, mileage: text })}
                placeholder="e.g., 25000"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Additional details about the vehicle..."
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.variantsHeader}>
              <View style={styles.variantsHeaderContent}>
                <Text style={styles.sectionTitle}>Color Variants & Pricing</Text>
                <Text style={styles.sectionSubtitle}>
                  Add different color options. Same colors will be grouped automatically.
                </Text>
              </View>
              <TouchableOpacity style={styles.addVariantButton} onPress={addColorVariant}>
                <Ionicons name="add" size={16} color="#222" />
                <Text style={styles.addVariantText}>Add Variant</Text>
              </TouchableOpacity>
            </View>

            {colorVariants.map((variant, index) => renderColorVariant(variant, index))}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.disabledButton]}
            onPress={handleSubmitPress}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? "Saving..." : isEditing ? "Update Vehicle" : "Add Vehicle"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={ownerDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOwnerDropdownVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOwnerDropdownVisible(false)}
        >
          <View style={styles.ownerPickerContainer}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Vehicle Owner</Text>
              <TouchableOpacity onPress={() => setOwnerDropdownVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              {carOwners.map(owner => (
                <TouchableOpacity
                  key={owner.id}
                  style={[
                    styles.ownerPickerItem,
                    selectedVariantId && colorVariants.find(v => v.id === selectedVariantId)?.ownerId === owner.id && styles.ownerPickerItemSelected
                  ]}
                  onPress={() => selectOwnerForVariant(owner.id)}
                >
                  <View style={styles.ownerPickerItemContent}>
                    <View style={styles.ownerAvatar}>
                      <Text style={styles.ownerAvatarText}>
                        {owner.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.ownerPickerText}>{owner.name}</Text>
                      <Text style={styles.ownerPickerSubtext}>{owner.email}</Text>
                    </View>
                  </View>
                  {selectedVariantId && colorVariants.find(v => v.id === selectedVariantId)?.ownerId === owner.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#222"/>
                  )}
                </TouchableOpacity>
              ))}

              {carOwners.length === 0 && (
                <Text style={styles.emptyOwnerText}>
                  No car owners found. Add owners in Car Owners section.
                </Text>
              )}
              </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <ActionModal
        visible={showConfirmModal}
        type="confirm"
        title={isEditing ? "Update Vehicle" : "Add Vehicle"}
        message={isEditing 
          ? "Are you sure you want to update this vehicle with the changes you made?" 
          : "Are you sure you want to add this vehicle to your fleet?"
        }
        confirmText={isEditing ? "Update" : "Add"}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleSubmit}
        loading={loading}
      />

      <ActionModal
        visible={showDeleteVariantModal}
        type="delete"
        title="Remove Color Variant"
        message="Are you sure you want to remove this color variant? This action cannot be undone."
        confirmText="Remove"
        onClose={() => {
          setShowDeleteVariantModal(false)
          setVariantToDelete(null)
        }}
        onConfirm={confirmRemoveVariant}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fcfcfc",
  },
  container: {
    flex: 1,
    backgroundColor: "#fcfcfc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fcfcfc",
    paddingHorizontal: 25,
    marginTop: 24,
    marginBottom: 24,
    paddingTop: 16,
  },
  headerContent: {
    flex: 1,
    backgroundColor: "#fcfcfc",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  headerSpacer: {
    width: 28,
  },
  scrollContent: {
    paddingBottom: 90,
  },
  scrollContentWeb: {
    minHeight: "100vh",
    alignItems: "center",
    paddingVertical: 20,
    paddingBottom: 40,
  },
  form: {
    paddingHorizontal: 16,
  },
  formWeb: {
    maxWidth: 800,
    width: "100%",
    paddingHorizontal: 40,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: -0.5,
    color: '#222',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  helperText: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: "column",
    gap: 16,
  },
  inputRowWeb: {
    flexDirection: "row",
    gap: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputHalf: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#222',
    fontWeight: '500',
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  typeSelector: {
    marginBottom: 16,
  },
  typeScrollView: {
    flexGrow: 0,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedTypeButton: {
    backgroundColor: 'black',
    borderColor: 'black',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  selectedTypeButtonText: {
    color: 'white',
  },
  customTypeContainer: {
    marginTop: 12,
  },
  variantsHeader: {
    flexDirection: 'column',
    marginBottom: 20,
  },
  variantsHeaderContent: {
    marginBottom: 12,
  },
  addVariantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignSelf: 'flex-start',
    minWidth: 120,
  },
  addVariantText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
    marginLeft: 4,
  },
  variantCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  variantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  variantTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
  },
  removeVariantButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  variantImageUpload: {
    width: '100%',
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
  },
  variantImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    backgroundColor: 'transparent',
  },
  variantImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButton: {
    backgroundColor: '#222',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  ownerSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
  },
  ownerSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  ownerSelectorText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
    flex: 1,
  },
  placeholderText: {
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  ownerPickerContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  ownerPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  ownerPickerItemSelected: {
    backgroundColor: '#f9fafb',
  },
  ownerPickerItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  ownerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ownerAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  ownerPickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  ownerPickerSubtext: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyOwnerText: {
    textAlign: 'center',
    color: '#9ca3af',
    padding: 20,
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  // NEW STYLES: Availability Toggle Section
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
  },
  availabilityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  availabilitySubtext: {
    fontSize: 12,
    color: '#6b7280',
  },
  toggleSwitch: {
    width: 56,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  warningBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningText: {
    fontSize: 12,
    color: '#991b1b',
    flex: 1,
  },
})