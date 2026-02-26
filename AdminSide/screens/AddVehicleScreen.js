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
    make:           editingVehicle?.make || "",
    model:          editingVehicle?.model || "",
    year:           editingVehicle?.year?.toString() || "",
    type:           editingVehicle?.type || "",
    seats:          editingVehicle?.seats?.toString() || "",
    mileage:        editingVehicle?.mileage?.toString() || "",
    description:    editingVehicle?.description || "",
    available:      editingVehicle?.available ?? true,
    fuel_type:      editingVehicle?.fuel_type || "",
    deposit_amount: editingVehicle?.deposit_amount?.toString() || "",
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
    if (feedbackModal.type === "success") navigation.goBack()
  }

  const [colorVariants, setColorVariants] = useState([
    { id: Date.now(), color: "", plateNumber: "", pricePerDay: "", isAvailable: true, imageUri: null, imageUrl: null, ownerId: null }
  ])

  const [loading, setLoading] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showDeleteVariantModal, setShowDeleteVariantModal] = useState(false)
  const [variantToDelete, setVariantToDelete] = useState(null)
  const [showCustomType, setShowCustomType] = useState(false)
  const [customType, setCustomType] = useState("")
  const [showFuelTypeDropdown, setShowFuelTypeDropdown] = useState(false)

  const vehicleTypes = ["Sedan", "SUV", "Hatchback", "Convertible", "Truck", "Van", "Luxury", "Other"]
  
  const fuelTypes = [
    "Gasoline",
    "Diesel",
    "Electric",
    "Hybrid",
    "Plug-in Hybrid",
    "CNG (Compressed Natural Gas)",
    "LPG (Liquefied Petroleum Gas)"
  ]

  // ── Fuel icon helpers (matching VehiclesScreen & CarCard) ─────────────────
  // Returns the appropriate Ionicons name for a given fuel type string.
  const getFuelIconName = (fuelType) => {
    if (!fuelType) return "flame-outline"
    const f = fuelType.toLowerCase()
    if (f.includes("electric"))                          return "flash-outline"   // ⚡ EV
    if (f.includes("hybrid") || f.includes("plug"))     return "leaf-outline"    // 🌿 eco
    if (f.includes("diesel"))                            return "water-outline"   // 💧 diesel
    if (f.includes("cng") || f.includes("compressed"))  return "cloud-outline"   // ☁ CNG
    if (f.includes("lpg") || f.includes("liquefied"))   return "beaker-outline"  // 🧪 LPG
    return "flame-outline"                                                        // 🔥 gasoline
  }

  // Returns the accent color for a fuel category.
  const getFuelColor = (fuelType) => {
    if (!fuelType) return "#f59e0b"
    const f = fuelType.toLowerCase()
    if (f.includes("electric"))                          return "#3b82f6"
    if (f.includes("hybrid") || f.includes("plug"))     return "#16a34a"
    if (f.includes("diesel"))                            return "#0ea5e9"
    if (f.includes("cng") || f.includes("compressed"))  return "#8b5cf6"
    if (f.includes("lpg") || f.includes("liquefied"))   return "#f97316"
    return "#f59e0b"   // gasoline amber
  }

  // For each fuel type option in the dropdown, show its icon + color
  const getFuelOptionMeta = (fuelLabel) => ({
    iconName: getFuelIconName(fuelLabel),
    color:    getFuelColor(fuelLabel),
  })

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
      if (editingVehicle.type && !vehicleTypes.slice(0, -1).includes(editingVehicle.type)) {
        setShowCustomType(true)
        setCustomType(editingVehicle.type)
        setFormData(prev => ({ ...prev, type: "Other" }))
      }
    }
  }, [isEditing, editingVehicle?.id])

  const loadExistingVariants = async () => {
    try {
      const variants = await variantsService.listByVehicleId(editingVehicle.id);
      if (!variants) return
      if (variants && variants.length > 0) {
        const formattedVariants = variants.map(variant => ({
          id:          variant.id,
          color:       variant.color,
          plateNumber: variant.plate_number || "",
          pricePerDay: variant.price_per_day?.toString() || "",
          isAvailable: variant.is_available ?? true,
          imageUri:    variant.image_url,
          imageUrl:    variant.image_url,
          ownerId:     variant.owner_id
        }))
        setColorVariants(formattedVariants)
      }
    } catch (error) {
      console.error('Error in loadExistingVariants:', error)
    }
  }

  const addColorVariant = () => {
    const newVariant = {
      id: Date.now(), color: "", plateNumber: "", pricePerDay: "",
      isAvailable: true, imageUri: null, imageUrl: null, ownerId: null
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
      variant.id === variantId ? { ...variant, [field]: value } : variant
    ))
  }

  const openOwnerSelector = (variantId) => {
    setSelectedVariantId(variantId);
    setOwnerDropdownVisible(true);
  }

  const selectOwnerForVariant = (ownerId) => {
    if (selectedVariantId) updateColorVariant(selectedVariantId, 'ownerId', ownerId);
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
      mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.8,
    })
    if (!result.canceled) updateColorVariant(variantId, 'imageUri', result.assets[0].uri)
  }

  const uploadImage = async (uri) => {
    if (!uri) return null;
    try {
      let processedUri = uri;
      if (uri.toLowerCase().endsWith(".heic")) {
        const manipResult = await ImageManipulator.manipulateAsync(uri, [], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
        processedUri = manipResult.uri;
      }
      const fileExt  = processedUri.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt  = fileExt === "heic" ? "jpg" : fileExt;
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${safeExt}`;
      const filePath = `vehicle-variants/${fileName}`;
      const response = await fetch(processedUri);
      const blob     = await response.blob();
      return await storageService.uploadVehicleImage(filePath, blob);
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

  const validateForm = () => {
    if (!formData.make || !formData.model || !formData.year || !formData.seats) {
      Alert.alert("Error", "Please fill in all required basic information fields"); return false
    }
    if (!formData.type) {
      Alert.alert("Error", "Please select a vehicle type"); return false
    }
    if (formData.type === "Other" && !customType.trim()) {
      Alert.alert("Error", "Please enter a custom vehicle type"); return false
    }
    if (!formData.fuel_type) {
      Alert.alert("Error", "Please select a fuel type"); return false
    }
    if (!formData.deposit_amount || formData.deposit_amount.trim() === "") {
      Alert.alert("Error", "Please enter a deposit amount"); return false
    }
    if (Number.parseFloat(formData.deposit_amount) <= 0) {
      Alert.alert("Error", "Deposit amount must be greater than 0"); return false
    }
    if (Number.parseInt(formData.seats) < 1 || Number.parseInt(formData.seats) > 50) {
      Alert.alert("Error", "Please enter a valid number of seats (1-50)"); return false
    }
    const validVariants = colorVariants.filter(variant => variant.color.trim() !== "")
    if (validVariants.length === 0) {
      Alert.alert("Error", "Please add at least one color variant"); return false
    }
    for (let variant of validVariants) {
      if (!variant.plateNumber || variant.plateNumber.trim() === "") {
        Alert.alert("Error", `Please enter a plate number for ${variant.color || 'variant ' + (validVariants.indexOf(variant) + 1)}`); return false
      }
      if (!variant.pricePerDay || variant.pricePerDay.trim() === "") {
        Alert.alert("Error", `Please enter a price per day for ${variant.color || 'variant ' + (validVariants.indexOf(variant) + 1)}`); return false
      }
      if (Number.parseFloat(variant.pricePerDay) <= 0) {
        Alert.alert("Error", `Price per day for ${variant.color} must be greater than 0`); return false
      }
      if (!variant.ownerId) {
        Alert.alert("Error", `Please select an owner for ${variant.color || 'variant ' + (validVariants.indexOf(variant) + 1)}`); return false
      }
    }
    return true
  }

  const handleSubmitPress = () => {
    if (!validateForm()) return
    setShowConfirmModal(true)
  }

  const handleSubmit = async () => {
    setShowConfirmModal(false)
    setLoading(true)
    try {
      const validVariants = colorVariants.filter(variant => variant.color.trim() !== "")
      const variantsWithImages = await Promise.all(
        validVariants.map(async (variant) => {
          let imageUrl = variant.imageUrl
          if (variant.imageUri && variant.imageUri !== variant.imageUrl) {
            try { imageUrl = await uploadImage(variant.imageUri) }
            catch (uploadError) { console.error('Image upload failed for variant:', variant.color, uploadError) }
          }
          return { ...variant, imageUrl }
        })
      )
      const totalQuantity     = variantsWithImages.length
      const availableQuantity = variantsWithImages.filter(v => v.isAvailable).length
      const finalType         = formData.type === "Other" ? customType.trim() : formData.type
      
      const vehicleData = {
        make:               formData.make,
        model:              formData.model,
        year:               Number.parseInt(formData.year),
        type:               finalType,
        seats:              Number.parseInt(formData.seats),
        price_per_day:      Number.parseFloat(variantsWithImages[0]?.pricePerDay || "0"),
        mileage:            formData.mileage ? Number.parseInt(formData.mileage) : null,
        description:        formData.description,
        available:          formData.available,
        fuel_type:          formData.fuel_type,
        deposit_amount:     Number.parseFloat(formData.deposit_amount),
        total_quantity:     totalQuantity,
        available_quantity: availableQuantity,
        image_url:          variantsWithImages[0]?.imageUrl || null,
        owner_id:           variantsWithImages[0]?.ownerId || null,
        updated_at:         new Date().toISOString(),
        owner_name:         carOwners.find(o => o.id === variantsWithImages[0]?.ownerId)?.name || null,
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
          vehicle_id:         vehicleId,
          color:              variant.color,
          plate_number:       variant.plateNumber.trim().toUpperCase(),
          price_per_day:      Number.parseFloat(variant.pricePerDay),
          image_url:          variant.imageUrl,
          is_available:       variant.isAvailable,
          available_quantity: variant.isAvailable ? 1 : 0,
          total_quantity:     1,
          owner_id:           variant.ownerId,
        });
      }

      setFeedbackModal({
        visible: true,
        type: "success",
        message: isEditing
          ? "Vehicle updated successfully! All changes have been saved."
          : "Vehicle added successfully! Your new vehicle is now available in the fleet."
      })
    } catch (error) {
      console.error("Error saving vehicle:", error)
      setFeedbackModal({ visible: true, type: "error", message: `Failed to ${isEditing ? 'update' : 'save'} vehicle: ${error.message}` })
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

  // ── Fuel Type Selector ────────────────────────────────────────────────────
  // IMPROVED: each fuel option in the dropdown shows its category icon + color
  // The trigger button also shows the selected fuel's icon instead of a generic arrow.
  const renderFuelTypeSelector = () => {
    const selectedFuelMeta = formData.fuel_type
      ? { iconName: getFuelIconName(formData.fuel_type), color: getFuelColor(formData.fuel_type) }
      : null

    return (
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Fuel Type *</Text>
        <TouchableOpacity
          style={styles.dropdownSelector}
          onPress={() => setShowFuelTypeDropdown(!showFuelTypeDropdown)}
        >
          {/* Left: fuel icon (category color) OR placeholder icon */}
          <View style={[
            styles.fuelIconBadge,
            selectedFuelMeta
              ? { backgroundColor: `${selectedFuelMeta.color}20` }
              : { backgroundColor: "#f3f4f6" }
          ]}>
            <Ionicons
              name={selectedFuelMeta ? selectedFuelMeta.iconName : "flame-outline"}
              size={16}
              color={selectedFuelMeta ? selectedFuelMeta.color : "#9ca3af"}
            />
          </View>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.dropdownText, !formData.fuel_type && styles.placeholderText]}>
              {formData.fuel_type || "Select fuel type"}
            </Text>
          </View>

          {/* Right: chevron */}
          <Ionicons name={showFuelTypeDropdown ? "chevron-up" : "chevron-down"} size={20} color="#6b7280" />
        </TouchableOpacity>

        {showFuelTypeDropdown && (
          <View style={styles.dropdownMenu}>
            <ScrollView style={{ maxHeight: 220 }}>
              {fuelTypes.map(type => {
                const meta = getFuelOptionMeta(type)
                const isSelected = formData.fuel_type === type
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                    onPress={() => {
                      setFormData({ ...formData, fuel_type: type })
                      setShowFuelTypeDropdown(false)
                    }}
                  >
                    {/* Fuel-category icon, colored per type */}
                    <View style={[styles.fuelOptionIconWrap, { backgroundColor: `${meta.color}18` }]}>
                      <Ionicons name={meta.iconName} size={15} color={meta.color} />
                    </View>
                    <Text style={[
                      styles.dropdownItemText,
                      isSelected && styles.dropdownItemTextSelected,
                      { flex: 1, marginLeft: 10 }
                    ]}>
                      {type}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={meta.color} />}
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        )}
      </View>
    )
  }

  const renderColorVariant = (variant, index) => (
    <View key={variant.id} style={styles.variantCard}>
      <View style={styles.variantHeader}>
        <Text style={styles.variantTitle}>Color Variant {index + 1}</Text>
        {colorVariants.length > 1 && (
          <TouchableOpacity style={styles.removeVariantButton} onPress={() => handleRemoveVariant(variant.id)}>
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
          <TouchableOpacity style={styles.variantImageUpload} onPress={() => pickImageForVariant(variant.id)}>
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
        <TouchableOpacity style={styles.ownerSelector} onPress={() => openOwnerSelector(variant.id)}>
          <View style={styles.ownerSelectorContent}>
            <Ionicons name="person-circle" size={20} color="#6b7280" />
            <Text style={[styles.ownerSelectorText, !variant.ownerId && styles.placeholderText]}>
              {variant.ownerId
                ? carOwners.find(o => o.id === variant.ownerId)?.name || 'Select vehicle owner'
                : 'Select vehicle owner'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <View style={[styles.availabilityContainer, {
        backgroundColor: variant.isAvailable ? '#f0fdf4' : '#fef2f2',
        borderColor: variant.isAvailable ? '#bbf7d0' : '#fecaca'
      }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.availabilityLabel}>Vehicle Availability</Text>
          <Text style={styles.availabilitySubtext}>
            {variant.isAvailable ? 'This vehicle is available for rent' : 'Unavailable (Maintenance/Issue)'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.toggleSwitch, { backgroundColor: variant.isAvailable ? '#22c55e' : '#ef4444' }]}
          onPress={() => updateColorVariant(variant.id, 'isAvailable', !variant.isAvailable)}
          activeOpacity={0.7}
        >
          <View style={[styles.toggleThumb, { transform: [{ translateX: variant.isAvailable ? 24 : 0 }] }]} />
        </TouchableOpacity>
      </View>

      {!variant.isAvailable && (
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={14} color="#991b1b" style={{ marginRight: 6 }} />
          <Text style={styles.warningText}>This vehicle will not appear as available to customers</Text>
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
        contentContainerStyle={[styles.scrollContent, isWeb && styles.scrollContentWeb, { paddingBottom: isWeb ? 40 : 90 }]}
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
                <TextInput style={styles.input} value={formData.make}
                  onChangeText={(text) => setFormData({ ...formData, make: text })}
                  placeholder="e.g., Toyota, Honda, BMW" placeholderTextColor="#9ca3af" />
              </View>
              <View style={[styles.inputGroup, styles.inputHalf]}>
                <Text style={styles.label}>Model *</Text>
                <TextInput style={styles.input} value={formData.model}
                  onChangeText={(text) => setFormData({ ...formData, model: text })}
                  placeholder="e.g., Camry, Civic, X5" placeholderTextColor="#9ca3af" />
              </View>
            </View>

            <View style={[styles.inputRow, isWeb && styles.inputRowWeb]}>
              <View style={[styles.inputGroup, styles.inputHalf]}>
                <Text style={styles.label}>Year *</Text>
                <TextInput style={styles.input} value={formData.year}
                  onChangeText={(text) => setFormData({ ...formData, year: text })}
                  placeholder="e.g., 2023" placeholderTextColor="#9ca3af" keyboardType="numeric" />
              </View>
              <View style={[styles.inputGroup, styles.inputHalf]}>
                <Text style={styles.label}>Seats *</Text>
                <TextInput style={styles.input} value={formData.seats}
                  onChangeText={(text) => setFormData({ ...formData, seats: text })}
                  placeholder="e.g., 5" placeholderTextColor="#9ca3af" keyboardType="numeric" />
              </View>
            </View>

            {renderTypeSelector()}

            {/* Fuel Type + Deposit */}
            <View style={[styles.inputRow, isWeb && styles.inputRowWeb]}>
              <View style={[styles.inputGroup, styles.inputHalf]}>
                {renderFuelTypeSelector()}
              </View>
              <View style={[styles.inputGroup, styles.inputHalf]}>
                <Text style={styles.label}>Deposit Amount (₱) *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.deposit_amount}
                  onChangeText={(text) => setFormData({ ...formData, deposit_amount: text })}
                  placeholder="e.g., 5000.00"
                  placeholderTextColor="#9ca3af"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.helperText}>Security deposit required before rental</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Additional Details</Text>
            <Text style={styles.sectionSubtitle}>Optional information about the vehicle</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Mileage</Text>
              <TextInput style={styles.input} value={formData.mileage}
                onChangeText={(text) => setFormData({ ...formData, mileage: text })}
                placeholder="e.g., 25000" placeholderTextColor="#9ca3af" keyboardType="numeric" />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, styles.textArea]} value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Additional details about the vehicle..."
                placeholderTextColor="#9ca3af" multiline numberOfLines={4} />
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

      {/* Owner Picker Modal */}
      <Modal
        visible={ownerDropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOwnerDropdownVisible(false)}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setOwnerDropdownVisible(false)}>
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
                      <Text style={styles.ownerAvatarText}>{owner.name.charAt(0).toUpperCase()}</Text>
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
                <Text style={styles.emptyOwnerText}>No car owners found. Add owners in Car Owners section.</Text>
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
          : "Are you sure you want to add this vehicle to your fleet?"}
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
        onClose={() => { setShowDeleteVariantModal(false); setVariantToDelete(null) }}
        onConfirm={confirmRemoveVariant}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea:   { flex: 1, backgroundColor: "#fcfcfc" },
  container:  { flex: 1, backgroundColor: "#fcfcfc" },
  header:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#fcfcfc", paddingHorizontal: 25, marginTop: 24, marginBottom: 24, paddingTop: 16 },
  headerTitle:{ fontSize: 28, fontWeight: "800", color: "#111827", letterSpacing: -0.5, marginBottom: 4 },
  headerSpacer:{ width: 28 },
  scrollContent:    { paddingBottom: 90 },
  scrollContentWeb: { minHeight: "100vh", alignItems: "center", paddingVertical: 20, paddingBottom: 40 },
  form:    { paddingHorizontal: 16 },
  formWeb: { maxWidth: 800, width: "100%", paddingHorizontal: 40 },
  card:    { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  sectionTitle:   { fontWeight: '800', fontSize: 18, letterSpacing: -0.5, color: '#222', marginBottom: 4 },
  sectionSubtitle:{ fontSize: 14, color: '#6b7280', marginBottom: 16 },
  helperText:     { fontSize: 11, color: '#6b7280', marginTop: 4, fontStyle: 'italic' },
  inputRow:    { flexDirection: "column", gap: 16 },
  inputRowWeb: { flexDirection: "row", gap: 20 },
  inputGroup:  { marginBottom: 16 },
  inputHalf:   { flex: 1 },
  label:   { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  input:   { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff', color: '#222', fontWeight: '500' },
  textArea:{ height: 100, textAlignVertical: "top" },

  typeSelector:     { marginBottom: 16 },
  typeScrollView:   { flexGrow: 0 },
  typeButton:       { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4, marginRight: 8, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: 'transparent' },
  selectedTypeButton:    { backgroundColor: 'black', borderColor: 'black' },
  typeButtonText:        { fontSize: 12, fontWeight: '600', color: '#374151' },
  selectedTypeButtonText:{ color: 'white' },
  customTypeContainer:   { marginTop: 12 },

  // ── Fuel dropdown ─────────────────────────────────────────────────────────
  dropdownSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, minHeight: 48 },
  dropdownText:     { fontSize: 16, color: '#1f2937', fontWeight: '500' },
  placeholderText:  { color: '#9ca3af' },
  dropdownMenu:     { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', borderRadius: 8, marginTop: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8, borderWidth: 1, borderColor: '#e5e7eb', zIndex: 1000 },
  dropdownItem:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  dropdownItemSelected: { backgroundColor: '#f9fafb' },
  dropdownItemText:     { fontSize: 14, fontWeight: '500', color: '#374151' },
  dropdownItemTextSelected: { color: '#222', fontWeight: '600' },

  // Fuel icon shown in the trigger button and each dropdown row
  fuelIconBadge:     { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  fuelOptionIconWrap:{ width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },

  variantsHeader:        { flexDirection: 'column', marginBottom: 20 },
  variantsHeaderContent: { marginBottom: 12 },
  addVariantButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', alignSelf: 'flex-start', minWidth: 120 },
  addVariantText:   { fontSize: 14, fontWeight: '600', color: '#222', marginLeft: 4 },

  variantCard:   { backgroundColor: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  variantHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  variantTitle:  { fontSize: 16, fontWeight: '700', color: '#374151' },
  removeVariantButton: { padding: 8, borderRadius: 6, backgroundColor: '#fef2f2' },

  variantImageUpload:   { width: '100%', height: 60, borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderStyle: 'dashed' },
  variantImage:         { width: '100%', height: '100%', resizeMode: 'contain', backgroundColor: 'transparent' },
  variantImagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  submitButton: { backgroundColor: '#222', paddingVertical: 16, borderRadius: 8, alignItems: 'center', marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  disabledButton: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },

  ownerSelector:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12, minHeight: 48 },
  ownerSelectorContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  ownerSelectorText:    { fontSize: 16, color: '#1f2937', fontWeight: '500', flex: 1 },

  modalOverlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  ownerPickerContainer: { backgroundColor: 'white', borderRadius: 16, width: '100%', maxWidth: 400, maxHeight: '80%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  pickerTitle:  { fontSize: 18, fontWeight: '600', color: '#111827' },

  ownerPickerItem:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  ownerPickerItemSelected: { backgroundColor: '#f9fafb' },
  ownerPickerItemContent:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  ownerAvatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  ownerAvatarText: { fontSize: 16, fontWeight: '600', color: 'white' },
  ownerPickerText:    { fontSize: 16, fontWeight: '600', color: '#111827' },
  ownerPickerSubtext: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  emptyOwnerText:     { textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 14 },

  availabilityContainer: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 8, borderWidth: 1, marginTop: 12 },
  availabilityLabel:     { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 4 },
  availabilitySubtext:   { fontSize: 12, color: '#6b7280' },
  toggleSwitch:  { width: 56, height: 32, borderRadius: 16, justifyContent: 'center', padding: 4, position: 'relative' },
  toggleThumb:   { width: 24, height: 24, borderRadius: 12, backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 3 },
  warningBox:  { marginTop: 12, padding: 10, backgroundColor: '#fee2e2', borderRadius: 6, flexDirection: 'row', alignItems: 'center' },
  warningText: { fontSize: 12, color: '#991b1b', flex: 1 },
})