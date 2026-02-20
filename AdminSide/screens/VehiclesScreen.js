"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  Platform,
  Dimensions,
  Modal,
  ScrollView,
  ImageBackground,
  TextInput,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { SafeAreaView } from "react-native-safe-area-context"
import background from "../assets/background.jpg"
import { vehiclesService, variantsService, bookingsService } from '../services/firebaseService'
import ActionModal from "../components/AlertModal/ActionModal"

const { width } = Dimensions.get("window")
const isWeb = Platform.OS === "web"

// Pagination constants
const ITEMS_PER_PAGE = 10

export default function VehiclesScreen({ navigation, route }) {
  const [vehicles, setVehicles] = useState([])
  const [vehicleVariants, setVehicleVariants] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState("all")
  const [bookings, setBookings] = useState([])
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [vehicleToDelete, setVehicleToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [feedbackModal, setFeedbackModal] = useState({
    visible: false,
    type: "success",
    message: ""
  })
  
  // Filter dropdowns - ALL DROPDOWN STATES
  const [showMakeFilter, setShowMakeFilter] = useState(false)
  const [showSeatsFilter, setShowSeatsFilter] = useState(false)
  const [showTypeFilter, setShowTypeFilter] = useState(false)
  const [showPriceFilter, setShowPriceFilter] = useState(false)
  const [selectedMake, setSelectedMake] = useState("all")
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  
  // Advanced filter states
  const [showFilters, setShowFilters] = useState(false)
  const [selectedSeats, setSelectedSeats] = useState("all")
  const [selectedType, setSelectedType] = useState("all")
  const [priceRange, setPriceRange] = useState("all")

  // Optimize getVehicleVariants with useMemo to prevent recreation on every render
  const vehicleVariantsMap = useMemo(() => {
    const map = {}
    vehicleVariants.forEach(variant => {
      if (!map[variant.vehicle_id]) {
        map[variant.vehicle_id] = []
      }
      map[variant.vehicle_id].push(variant)
    })
    return map
  }, [vehicleVariants])

  const getVehicleVariants = useCallback((vehicleId) => {
    return vehicleVariantsMap[vehicleId] || []
  }, [vehicleVariantsMap])

  // Enhanced filteredVehicles with make filter and rented status check
  const filteredVehicles = useMemo(() => {
    let filtered = vehicles

    // Apply make filter
    if (selectedMake !== "all") {
      filtered = filtered.filter(vehicle => vehicle.make === selectedMake)
    }

    // Apply status filter with confirmed bookings check
    if (activeFilter !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison

      if (activeFilter === "available") {
        // Show vehicles that are not currently rented (no confirmed bookings for any variant)
        filtered = filtered.filter(vehicle => {
          // Get all variants for this vehicle
          const vehicleVariantIds = vehicleVariants
            .filter(variant => variant.vehicle_id === vehicle.id)
            .map(variant => variant.id);

          // Check if any variant has confirmed bookings
          const hasConfirmedBooking = bookings.some(booking => {
            if (booking.status !== "confirmed") return false;
            
            // Check both vehicle_id and vehicle_variant_id
            const matchesVehicle = booking.vehicle_id === vehicle.id || 
                                  vehicleVariantIds.includes(booking.vehicle_variant_id);
            
            if (!matchesVehicle) return false;

            const startDate = new Date(booking.rental_start_date);
            const endDate = new Date(booking.rental_end_date);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);

            return startDate <= today && endDate >= today;
          });

          return !hasConfirmedBooking;
        });
      } else if (activeFilter === "rented") {
        // Show vehicles that are currently rented (have confirmed bookings)
        filtered = filtered.filter(vehicle => {
          // Get all variants for this vehicle
          const vehicleVariantIds = vehicleVariants
            .filter(variant => variant.vehicle_id === vehicle.id)
            .map(variant => variant.id);

          // Check if any variant has confirmed bookings
          const hasConfirmedBooking = bookings.some(booking => {
            if (booking.status !== "confirmed") return false;
            
            // Check both vehicle_id and vehicle_variant_id
            const matchesVehicle = booking.vehicle_id === vehicle.id || 
                                  vehicleVariantIds.includes(booking.vehicle_variant_id);
            
            if (!matchesVehicle) return false;

            const startDate = new Date(booking.rental_start_date);
            const endDate = new Date(booking.rental_end_date);
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);

            return startDate <= today && endDate >= today;
          });

          return hasConfirmedBooking;
        });
      }
    }

    // Apply seats filter
    if (selectedSeats !== "all") {
      filtered = filtered.filter(vehicle => vehicle.seats === parseInt(selectedSeats))
    }

    // Apply type filter
    if (selectedType !== "all") {
      filtered = filtered.filter(vehicle => vehicle.type === selectedType)
    }

    // Apply price filter
    if (priceRange !== "all") {
      filtered = filtered.filter(vehicle => {
        const price = parseFloat(vehicle.price_per_day || 0)
        switch (priceRange) {
          case "under-1000":
            return price < 1000
          case "1000-2000":
            return price >= 1000 && price <= 2000
          case "2000-5000":
            return price >= 2000 && price <= 5000
          case "over-5000":
            return price > 5000
          default:
            return true
        }
      })
    }

    return filtered
  }, [vehicles, selectedMake, activeFilter, selectedSeats, selectedType, priceRange, bookings])

  // Paginated vehicles
  const paginatedVehicles = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return filteredVehicles.slice(startIndex, endIndex)
  }, [filteredVehicles, currentPage])

  // Pagination info
  const paginationInfo = useMemo(() => {
    const totalItems = filteredVehicles.length
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems)
    
    return {
      totalItems,
      totalPages,
      startItem,
      endItem,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    }
  }, [filteredVehicles.length, currentPage])

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMake, activeFilter, selectedSeats, selectedType, priceRange])

  // Close dropdowns when activeFilter changes
  useEffect(() => {
    setShowMakeFilter(false)
    setShowSeatsFilter(false)
    setShowTypeFilter(false)
    setShowPriceFilter(false)
  }, [activeFilter])

  // Handle vehicleId parameter from navigation (e.g., when coming from owner profile)
  useEffect(() => {
    if (route?.params?.vehicleId && vehicles.length > 0) {
      const vehicleToShow = vehicles.find(v => v.id === route.params.vehicleId)
      if (vehicleToShow) {
        // Navigate to AddVehicle screen to view vehicle details
        navigation.navigate('AddVehicle', { vehicle: vehicleToShow })
        // Clear the parameter so it doesn't trigger again
        navigation.setParams({ vehicleId: undefined })
      }
    }
  }, [route?.params?.vehicleId, vehicles, navigation])
  
  useEffect(() => {
    fetchVehicles()
    fetchVehicleVariants()
    fetchBookings()

    const unsubV = vehiclesService.subscribe(
      (data) => { setVehicles(data); setLoading(false); },
      (err) => { console.error('Vehicles subscription error:', err); setLoading(false); }
    )
    const unsubVar = variantsService.subscribe(
      (data) => setVehicleVariants(data),
      (err) => console.error('Variants subscription error:', err)
    )
    const unsubB = bookingsService.subscribe(
      (data) => setBookings(data),
      (err) => console.error('Bookings subscription error:', err)
    )

    return () => {
      unsubV()
      unsubVar()
      unsubB()
    }
  }, [])
  
  const fetchVehicles = async () => {
    try {
      const vehiclesData = await vehiclesService.list()
      setVehicles(vehiclesData || [])
    } catch (error) {
      console.error('Error in fetchVehicles:', error)
      Alert.alert('Error', 'Something went wrong while fetching vehicles')
    } finally {
      setLoading(false)
    }
  }

  const fetchVehicleVariants = async () => {
    try {
      const variantsData = await variantsService.list()
      setVehicleVariants(variantsData || [])
    } catch (error) {
      console.error('Error in fetchVehicleVariants:', error)
    }
  }

  const fetchBookings = async () => {
    try {
      const bookingsData = await bookingsService.list()
      setBookings(bookingsData || [])
    } catch (error) {
      console.error('Error in fetchBookings:', error)
    }
  }

  const refreshData = async () => {
    setLoading(true)
    await Promise.all([fetchVehicles(), fetchVehicleVariants(), fetchBookings()])
  }

  const getVehicleStats = () => {
    const totalBookings = bookings.length
    const activeRentals = bookings.filter(b => b.status === "confirmed").length
    const maintenanceVehicles = vehicles.filter(v => v.status === "maintenance").length
    const totalRevenue = bookings.filter(b => b.status === "completed")
      .reduce((sum, b) => sum + (parseFloat(b.total_price) || 0), 0)

    return {
      totalBookings,
      activeRentals,
      maintenanceVehicles,
      totalRevenue
    }
  }

  // Optimize unique values calculation with memoization
  const getUniqueMakes = useMemo(() => {
    const makes = [...new Set(vehicles.map(v => v.make).filter(Boolean))]
    return makes.sort()
  }, [vehicles])

  const getUniqueSeats = useMemo(() => {
    const seats = [...new Set(vehicles.map(v => v.seats).filter(Boolean))]
    return seats.sort((a, b) => a - b)
  }, [vehicles])

  const getUniqueTypes = useMemo(() => {
    const types = [...new Set(vehicles.map(v => v.type).filter(Boolean))]
    return types.sort()
  }, [vehicles])

  const clearAllFilters = useCallback(() => {
    setSelectedMake("all")
    setSelectedSeats("all")
    setSelectedType("all")
    setPriceRange("all")
    setActiveFilter("all")
    setCurrentPage(1)
    // Close all dropdowns
    setShowMakeFilter(false)
    setShowSeatsFilter(false)
    setShowTypeFilter(false)
    setShowPriceFilter(false)
  }, [])

  // Function to close all dropdowns
  const closeAllDropdowns = useCallback(() => {
    setShowMakeFilter(false)
    setShowSeatsFilter(false)
    setShowTypeFilter(false)
    setShowPriceFilter(false)
  }, [])

  // Pagination handlers
  const goToNextPage = useCallback(() => {
    if (paginationInfo.hasNextPage) {
      setCurrentPage(prev => prev + 1)
    }
  }, [paginationInfo.hasNextPage])

  const goToPrevPage = useCallback(() => {
    if (paginationInfo.hasPrevPage) {
      setCurrentPage(prev => prev - 1)
    }
  }, [paginationInfo.hasPrevPage])

  const goToPage = useCallback((page) => {
    if (page >= 1 && page <= paginationInfo.totalPages) {
      setCurrentPage(page)
    }
  }, [paginationInfo.totalPages])

  const showDeleteConfirmation = useCallback((vehicle) => {
    setVehicleToDelete(vehicle)
    setDeleteModalVisible(true)
  }, [])

  const hideDeleteConfirmation = useCallback(() => {
    setDeleteModalVisible(false)
    setVehicleToDelete(null)
  }, [])

  const confirmDeleteVehicle = async () => {
    if (!vehicleToDelete) return

    setDeleting(true)
    
    try {
      await vehiclesService.delete(vehicleToDelete.id)
      setFeedbackModal({
        visible: true,
        type: "success",
        message: "Vehicle deleted successfully"
      })
      hideDeleteConfirmation()
      
      // Data will be updated automatically via real-time subscription
    } catch (error) {
      console.error('Error in confirmDeleteVehicle:', error)
      Alert.alert("Error", "Failed to delete vehicle")
    } finally {
      setDeleting(false)
    }
  }

  // Optimize renderVehicleItem with useCallback to prevent unnecessary re-renders
  const renderVehicleItem = useCallback(({ item }) => {
    const variants = getVehicleVariants(item.id)
    const totalVariantQuantity = variants.reduce((sum, variant) => sum + variant.total_quantity, 0)
    const availableVariantQuantity = variants.reduce((sum, variant) => sum + variant.available_quantity, 0)

    return (
      <View style={styles.vehicleCard}>
         <View style={styles.imageContainer}>
         <ImageBackground
          source={background}
          style={styles.backgroundImage}
          imageStyle={{ borderRadius: 12 }}
        >
      <Image
        source={{ uri: item.image_url || "https://via.placeholder.com/400x240?text=No+Image" }}
        style={styles.vehicleImage}
        resizeMode="contain"
      />
    </ImageBackground>
  </View>
        

        <View style={styles.vehicleContent}>
          <View style={styles.vehicleHeader}>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleName}>
                {item.make} {item.model}
              </Text>
              <Text style={styles.vehicleYear}>{item.year} • {item.type}</Text>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.priceAmount}>₱{parseFloat(item.price_per_day || 0).toLocaleString()}</Text>
              <Text style={styles.priceLabel}>/day</Text>
            </View>
          </View>

          <View style={styles.vehicleFeatures}>
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="people" size={14} color="#6b7280" />
              </View>
              <Text style={styles.featureText}>{item.seats} seats</Text>
            </View>
            
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="speedometer" size={14} color="#6b7280" />
              </View>
              <Text style={styles.featureText}>
                {item.mileage ? `${item.mileage.toLocaleString()} mi` : "N/A"}
              </Text>
            </View>
            
            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="car" size={14} color="#6b7280" />
              </View>
              <Text style={styles.featureText}>{item.type}</Text>
            </View>

            <View style={styles.featureItem}>
              <View style={styles.featureIcon}>
                <Ionicons name="color-palette" size={14} color="#6b7280" />
              </View>
              <Text style={styles.featureText}>{variants.length} color{variants.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>

          {/* Color Variants Preview */}
          {variants.length > 0 && (
            <View style={styles.variantsPreview}>
              <Text style={styles.variantsTitle}>Available Colors:</Text>
              <View style={styles.variantsList}>
                {variants.slice(0, 3).map((variant, index) => (
                  <View key={variant.id} style={styles.variantChip}>
                    <Text style={styles.variantColor}>{variant.color}</Text>
                    <Text style={styles.variantQuantity}>({variant.available_quantity})</Text>
                  </View>
                ))}
                {variants.length > 3 && (
                  <Text style={styles.moreVariants}>+{variants.length - 3} more</Text>
                )}
              </View>
            </View>
          )}

          {item.description && (
            <Text style={styles.vehicleDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.secondaryButton, styles.flexButton]}
              onPress={() => navigation.navigate("AddVehicle", { vehicle: item })}
            >
              <Ionicons name="create" size={16} color="black" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dangerButton, styles.flexButton]}
              onPress={() => showDeleteConfirmation(item)}
            >
              <Ionicons name="trash" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }, [getVehicleVariants, navigation, showDeleteConfirmation])

  const renderFiltersModal = () => (
    <Modal
      visible={showFilters}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.filtersModalOverlay}>
        <View style={styles.filtersModalContainer}>
          <View style={styles.filtersHeader}>
            <Text style={styles.filtersTitle}>Advanced Filters</Text>
            <TouchableOpacity
              style={styles.filtersCloseButton}
              onPress={() => setShowFilters(false)}
            >
              <Ionicons name="close" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filtersContent} showsVerticalScrollIndicator={false}>
            {/* Seats Filter */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>Number of Seats</Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[styles.filterOption, selectedSeats === "all" && styles.filterOptionActive]}
                  onPress={() => setSelectedSeats("all")}
                >
                  <Text style={[styles.filterOptionText, selectedSeats === "all" && styles.filterOptionTextActive]}>
                    All Seats
                  </Text>
                </TouchableOpacity>
                {getUniqueSeats.map(seats => (
                  <TouchableOpacity
                    key={seats}
                    style={[styles.filterOption, selectedSeats === seats.toString() && styles.filterOptionActive]}
                    onPress={() => setSelectedSeats(seats.toString())}
                  >
                    <Text style={[styles.filterOptionText, selectedSeats === seats.toString() && styles.filterOptionTextActive]}>
                      {seats} seats
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Vehicle Type Filter */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>Vehicle Type</Text>
              <View style={styles.filterOptions}>
                <TouchableOpacity
                  style={[styles.filterOption, selectedType === "all" && styles.filterOptionActive]}
                  onPress={() => setSelectedType("all")}
                >
                  <Text style={[styles.filterOptionText, selectedType === "all" && styles.filterOptionTextActive]}>
                    All Types
                  </Text>
                </TouchableOpacity>
                {getUniqueTypes.map(type => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.filterOption, selectedType === type && styles.filterOptionActive]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Text style={[styles.filterOptionText, selectedType === type && styles.filterOptionTextActive]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Price Range Filter */}
            <View style={styles.filterGroup}>
              <Text style={styles.filterGroupTitle}>Price Range (per day)</Text>
              <View style={styles.filterOptions}>
                {[
                  { key: "all", label: "All Prices" },
                  { key: "under-1000", label: "Under ₱1,000" },
                  { key: "1000-2000", label: "₱1,000 - ₱2,000" },
                  { key: "2000-5000", label: "₱2,000 - ₱5,000" },
                  { key: "over-5000", label: "Over ₱5,000" }
                ].map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.filterOption, priceRange === option.key && styles.filterOptionActive]}
                    onPress={() => setPriceRange(option.key)}
                  >
                    <Text style={[styles.filterOptionText, priceRange === option.key && styles.filterOptionTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={styles.filtersActions}>
            <TouchableOpacity
              style={styles.filtersClearButton}
              onPress={clearAllFilters}
            >
              <Text style={styles.filtersClearText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filtersApplyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.filtersApplyText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )

  const renderDeleteModal = () => (
    <Modal
      visible={deleteModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={hideDeleteConfirmation}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="warning" size={32} color="black" />
            </View>
            <Text style={styles.modalTitle}>Delete Vehicle</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to delete{' '}
              <Text style={styles.modalVehicleName}>
                {vehicleToDelete?.make} {vehicleToDelete?.model}
              </Text>
              ? This action cannot be undone and will also delete all associated color variants.
            </Text>
          </View>
          
          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={hideDeleteConfirmation}
              disabled={deleting}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalDeleteButton, deleting && styles.modalButtonDisabled]}
              onPress={confirmDeleteVehicle}
              disabled={deleting}
            >
              {deleting ? (
                <Text style={styles.modalDeleteText}>Deleting...</Text>
              ) : (
                <>
                  <Ionicons name="trash" size={16} color="white" />
                  <Text style={styles.modalDeleteText}>Delete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )

  // Pagination component
  const renderPagination = () => {
    if (paginationInfo.totalPages <= 1) return null

    const renderPageButton = (page, isActive = false) => (
      <TouchableOpacity
        key={page}
        style={[styles.pageButton, isActive && styles.activePageButton]}
        onPress={() => goToPage(page)}
      >
        <Text style={[styles.pageButtonText, isActive && styles.activePageButtonText]}>
          {page}
        </Text>
      </TouchableOpacity>
    )

    const renderPageButtons = () => {
      const buttons = []
      const { totalPages } = paginationInfo
      
      // Always show first page
      if (currentPage > 3) {
        buttons.push(renderPageButton(1))
        if (currentPage > 4) {
          buttons.push(
            <Text key="dots1" style={styles.paginationDots}>...</Text>
          )
        }
      }
      
      // Show pages around current page
      for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        buttons.push(renderPageButton(i, i === currentPage))
      }
      
      // Always show last page
      if (currentPage < totalPages - 2) {
        if (currentPage < totalPages - 3) {
          buttons.push(
            <Text key="dots2" style={styles.paginationDots}>...</Text>
          )
        }
        buttons.push(renderPageButton(totalPages))
      }
      
      return buttons
    }

    return (
      <View style={styles.paginationContainer}>
        <View style={styles.paginationInfo}>
          <Text style={styles.paginationText}>
            Showing {paginationInfo.startItem}-{paginationInfo.endItem} of {paginationInfo.totalItems} vehicles
          </Text>
        </View>
        
        <View style={styles.paginationControls}>
          <TouchableOpacity
            style={[styles.paginationButton, !paginationInfo.hasPrevPage && styles.paginationButtonDisabled]}
            onPress={goToPrevPage}
            disabled={!paginationInfo.hasPrevPage}
          >
            <Ionicons name="chevron-back" size={16} color={paginationInfo.hasPrevPage ? "#374151" : "#9ca3af"} />
            <Text style={[styles.paginationButtonText, !paginationInfo.hasPrevPage && styles.paginationButtonTextDisabled]}>
              Previous
            </Text>
          </TouchableOpacity>
          
          <View style={styles.pageNumbers}>
            {renderPageButtons()}
          </View>
          
          <TouchableOpacity
            style={[styles.paginationButton, !paginationInfo.hasNextPage && styles.paginationButtonDisabled]}
            onPress={goToNextPage}
            disabled={!paginationInfo.hasNextPage}
          >
            <Text style={[styles.paginationButtonText, !paginationInfo.hasNextPage && styles.paginationButtonTextDisabled]}>
              Next
            </Text>
            <Ionicons name="chevron-forward" size={16} color={paginationInfo.hasNextPage ? "#374151" : "#9ca3af"} />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const renderHeader = () => {
    const stats = getVehicleStats()
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Calculate rented vehicles count
    const rentedVehiclesCount = vehicles.filter(vehicle => {
      // Get all variants for this vehicle
      const vehicleVariantIds = vehicleVariants
        .filter(variant => variant.vehicle_id === vehicle.id)
        .map(variant => variant.id);

      // Check if any variant has confirmed bookings
      const hasConfirmedBooking = bookings.some(booking => {
        if (booking.status !== "confirmed") return false;
        
        // Check both vehicle_id and vehicle_variant_id
        const matchesVehicle = booking.vehicle_id === vehicle.id || 
                              vehicleVariantIds.includes(booking.vehicle_variant_id);
        
        if (!matchesVehicle) return false;

        const startDate = new Date(booking.rental_start_date);
        const endDate = new Date(booking.rental_end_date);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        return startDate <= today && endDate >= today;
      });

      return hasConfirmedBooking;
    }).length;

    // Calculate available vehicles count
    const availableVehiclesCount = vehicles.filter(vehicle => {
      // Get all variants for this vehicle
      const vehicleVariantIds = vehicleVariants
        .filter(variant => variant.vehicle_id === vehicle.id)
        .map(variant => variant.id);

      // Check if any variant has confirmed bookings
      const hasConfirmedBooking = bookings.some(booking => {
        if (booking.status !== "confirmed") return false;
        
        // Check both vehicle_id and vehicle_variant_id
        const matchesVehicle = booking.vehicle_id === vehicle.id || 
                              vehicleVariantIds.includes(booking.vehicle_variant_id);
        
        if (!matchesVehicle) return false;

        const startDate = new Date(booking.rental_start_date);
        const endDate = new Date(booking.rental_end_date);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        return startDate <= today && endDate >= today;
      });

      return !hasConfirmedBooking;
    }).length;

    return (
      <>
        {/* Header with Enhanced Design */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>Vehicle Management</Text>
            
            </View>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => navigation.navigate("AddVehicle")}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.addButtonText}>Add Vehicle</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Enhanced Stats Cards */}
        <View style={styles.statsSection}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="car" size={28} color="#222" />
              </View>
              <Text style={styles.statValue}>{vehicles.length}</Text>
              <Text style={styles.statLabel}>Total Fleet</Text>
              <View style={styles.statTrend}>
              </View>
            </View>
            
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="color-palette" size={28} color="#222" />
              </View>
              <Text style={styles.statValue}>{vehicleVariants.length}</Text>
              <Text style={styles.statLabel}>Color Variants</Text>
              <View style={styles.statTrend}>
                
              </View>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="time" size={28} color="#222" />
              </View>
              <Text style={styles.statValue}>{stats.activeRentals}</Text>
              <Text style={styles.statLabel}>Active Rentals</Text>
              <View style={styles.statTrend}>
                
              </View>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <Ionicons name="analytics" size={28} color="#222" />
              </View>
              <Text style={styles.statValue}>{stats.totalBookings}</Text>
              <Text style={styles.statLabel}>Total Bookings</Text>
              <View style={styles.statTrend}>
                
              </View>
            </View>
          </View>
        </View>

        {/* Filter Dropdowns Section - FIXED VERSION */}
        <View style={styles.filterDropdownsSection}>
          <Text style={styles.filterDropdownsTitle}>Filter Vehicles</Text>
          
          <View style={styles.filterDropdownsGrid}>
            {/* Make Filter Dropdown */}
            <View style={styles.filterDropdownContainer}>
              <Text style={styles.filterDropdownLabel}>Make</Text>
              <TouchableOpacity
                style={[styles.filterDropdown, selectedMake !== "all" && styles.filterDropdownActive]}
                onPress={() => {
                  setShowMakeFilter(!showMakeFilter)
                  // Close other dropdowns
                  setShowSeatsFilter(false)
                  setShowTypeFilter(false)
                  setShowPriceFilter(false)
                }}
              >
                <Text style={[styles.filterDropdownText, selectedMake !== "all" && styles.filterDropdownTextActive]}>
                  {selectedMake === "all" ? "All Makes" : selectedMake}
                </Text>
                <Ionicons 
                  name={showMakeFilter ? "chevron-up" : "chevron-down"} 
                  size={16} 
                  color={selectedMake !== "all" ? "white" : "#6b7280"} 
                />
              </TouchableOpacity>
              
              {showMakeFilter && (
            <ScrollView 
              style={styles.filterDropdownMenu}
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={true}
            >
              <TouchableOpacity
                style={styles.filterDropdownItem}
                onPress={() => {
                  setSelectedMake("all")
                  setShowMakeFilter(false)
                }}
              >
                <Text style={[styles.filterDropdownItemText, selectedMake === "all" && styles.filterDropdownItemTextActive]}>
                  All Makes
                </Text>
              </TouchableOpacity>
              {getUniqueMakes.map(make => (
                <TouchableOpacity
                  key={make}
                  style={styles.filterDropdownItem}
                  onPress={() => {
                    setSelectedMake(make)
                    setShowMakeFilter(false)
                  }}
                >
                  <Text style={[styles.filterDropdownItemText, selectedMake === make && styles.filterDropdownItemTextActive]}>
                    {make}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          
            </View>
{/* Seats Filter Dropdown */}
<View style={styles.filterDropdownContainer}>
  <Text style={styles.filterDropdownLabel}>Seats</Text>
  <TouchableOpacity
    style={[styles.filterDropdown, selectedSeats !== "all" && styles.filterDropdownActive]}
    onPress={() => {
      setShowSeatsFilter(!showSeatsFilter)
      // Close other dropdowns
      setShowMakeFilter(false)
      setShowTypeFilter(false)
      setShowPriceFilter(false)
    }}
  >
    <Text style={[styles.filterDropdownText, selectedSeats !== "all" && styles.filterDropdownTextActive]}>
      {selectedSeats === "all" ? "All Seats" : `${selectedSeats} seats`}
    </Text>
    <Ionicons 
      name={showSeatsFilter ? "chevron-up" : "chevron-down"} 
      size={16} 
      color={selectedSeats !== "all" ? "white" : "#6b7280"} 
    />
  </TouchableOpacity>
  
  {showSeatsFilter && (
    <ScrollView 
      style={styles.filterDropdownMenu}
      nestedScrollEnabled={true}
      showsVerticalScrollIndicator={true}
    >
      <TouchableOpacity
        style={styles.filterDropdownItem}
        onPress={() => {
          setSelectedSeats("all")
          setShowSeatsFilter(false)
        }}
      >
        <Text style={[styles.filterDropdownItemText, selectedSeats === "all" && styles.filterDropdownItemTextActive]}>
          All Seats
        </Text>
      </TouchableOpacity>
      {getUniqueSeats.map(seats => (
        <TouchableOpacity
          key={seats}
          style={styles.filterDropdownItem}
          onPress={() => {
            setSelectedSeats(seats.toString())
            setShowSeatsFilter(false)
          }}
        >
          <Text style={[styles.filterDropdownItemText, selectedSeats === seats.toString() && styles.filterDropdownItemTextActive]}>
            {seats} seats
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )}
</View>
</View>
          
          <View style={styles.filterDropdownsGrid}>
            {/* Type Filter Dropdown - FIXED */}
           {/* Type Filter Dropdown */}
<View style={styles.filterDropdownContainer}>
  <Text style={styles.filterDropdownLabel}>Type</Text>
  <TouchableOpacity
    style={[styles.filterDropdown, selectedType !== "all" && styles.filterDropdownActive]}
    onPress={() => {
      setShowTypeFilter(!showTypeFilter)
      // Close other dropdowns
      setShowMakeFilter(false)
      setShowSeatsFilter(false)
      setShowPriceFilter(false)
    }}
  >
    <Text style={[styles.filterDropdownText, selectedType !== "all" && styles.filterDropdownTextActive]}>
      {selectedType === "all" ? "All Types" : selectedType}
    </Text>
    <Ionicons 
      name={showTypeFilter ? "chevron-up" : "chevron-down"} 
      size={16} 
      color={selectedType !== "all" ? "white" : "#6b7280"} 
    />
  </TouchableOpacity>
  
  {showTypeFilter && (
    <ScrollView 
      style={styles.filterDropdownMenu}
      nestedScrollEnabled={true}
      showsVerticalScrollIndicator={true}
    >
      <TouchableOpacity
        style={styles.filterDropdownItem}
        onPress={() => {
          setSelectedType("all")
          setShowTypeFilter(false)
        }}
      >
        <Text style={[styles.filterDropdownItemText, selectedType === "all" && styles.filterDropdownItemTextActive]}>
          All Types
        </Text>
      </TouchableOpacity>
      {getUniqueTypes.map(type => (
        <TouchableOpacity
          key={type}
          style={styles.filterDropdownItem}
          onPress={() => {
            setSelectedType(type)
            setShowTypeFilter(false)
          }}
        >
          <Text style={[styles.filterDropdownItemText, selectedType === type && styles.filterDropdownItemTextActive]}>
            {type}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )}
</View>

{/* Price Filter Dropdown */}
<View style={styles.filterDropdownContainer}>
  <Text style={styles.filterDropdownLabel}>Price Range</Text>
  <TouchableOpacity
    style={[styles.filterDropdown, priceRange !== "all" && styles.filterDropdownActive]}
    onPress={() => {
      setShowPriceFilter(!showPriceFilter)
      // Close other dropdowns
      setShowMakeFilter(false)
      setShowSeatsFilter(false)
      setShowTypeFilter(false)
    }}
  >
    <Text style={[styles.filterDropdownText, priceRange !== "all" && styles.filterDropdownTextActive]}>
      {priceRange === "all" ? "All Prices" : 
       priceRange === "under-1000" ? "Under ₱1,000" :
       priceRange === "1000-2000" ? "₱1,000-₱2,000" :
       priceRange === "2000-5000" ? "₱2,000-₱5,000" :
       priceRange === "over-5000" ? "Over ₱5,000" : "All Prices"
      }
    </Text>
    <Ionicons 
      name={showPriceFilter ? "chevron-up" : "chevron-down"} 
      size={16} 
      color={priceRange !== "all" ? "white" : "#6b7280"} 
    />
  </TouchableOpacity>
  
  {showPriceFilter && (
    <ScrollView 
      style={styles.filterDropdownMenu}
      nestedScrollEnabled={true}
      showsVerticalScrollIndicator={true}
    >
      {[
        { key: "all", label: "All Prices" },
        { key: "under-1000", label: "Under ₱1,000" },
        { key: "1000-2000", label: "₱1,000 - ₱2,000" },
        { key: "2000-5000", label: "₱2,000 - ₱5,000" },
        { key: "over-5000", label: "Over ₱5,000" }
      ].map(option => (
        <TouchableOpacity
          key={option.key}
          style={styles.filterDropdownItem}
          onPress={() => {
            setPriceRange(option.key)
            setShowPriceFilter(false)
          }}
        >
          <Text style={[styles.filterDropdownItemText, priceRange === option.key && styles.filterDropdownItemTextActive]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  )}
</View>
          </View>
          
          {/* Clear Filters Button */}
          {(selectedMake !== "all" || selectedSeats !== "all" || selectedType !== "all" || priceRange !== "all") && (
            <TouchableOpacity
              style={styles.clearAllFiltersButton}
              onPress={clearAllFilters}
            >
              <Ionicons name="refresh" size={16} color="#ef4444" />
              <Text style={styles.clearAllFiltersText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Enhanced Filter Section */}
        <View style={styles.filterSection}>
          <View style={styles.filterHeader}>
            <Text style={styles.sectionTitle}>Vehicle Overview</Text>
            <View style={styles.filterHeaderActions}>
              <Text style={styles.sectionSubtitle}>
                {filteredVehicles.length} vehicles
              </Text>
            </View>
          </View>
          
          <View style={styles.filterTabs}>
            {[
              { key: "all", label: "All", count: vehicles.length },
              { key: "available", label: "Available", count: availableVehiclesCount },
              { key: "rented", label: "Rented", count: rentedVehiclesCount }
            ].map((filter) => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterTab,
                  activeFilter === filter.key && styles.activeFilterTab
                ]}
                onPress={() => setActiveFilter(filter.key)}
              >
                <Text style={[
                  styles.filterTabText,
                  activeFilter === filter.key && styles.activeFilterTabText
                ]}>
                  {filter.label}
                </Text>
                <View style={[
                  styles.filterCount,
                  activeFilter === filter.key && styles.activeFilterCount
                ]}>
                  <Text style={[
                    styles.filterCountText,
                    activeFilter === filter.key && styles.activeFilterCountText
                  ]}>
                    {filter.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Active Filters Display */}
        {(selectedMake !== "all" || selectedSeats !== "all" || selectedType !== "all" || priceRange !== "all") && (
          <View style={styles.activeFiltersSection}>
            <View style={styles.activeFiltersHeader}>
              <Text style={styles.activeFiltersTitle}>Active Filters</Text>
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={clearAllFilters}
              >
                <Text style={styles.clearFiltersText}>Clear All</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.activeFiltersList}>
              {selectedMake !== "all" && (
                <View style={styles.activeFilter}>
                  <Text style={styles.activeFilterText}>{selectedMake}</Text>
                  <TouchableOpacity onPress={() => setSelectedMake("all")}>
                    <Ionicons name="close" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              )}
              {selectedSeats !== "all" && (
                <View style={styles.activeFilter}>
                  <Text style={styles.activeFilterText}>{selectedSeats} seats</Text>
                  <TouchableOpacity onPress={() => setSelectedSeats("all")}>
                    <Ionicons name="close" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              )}
              {selectedType !== "all" && (
                <View style={styles.activeFilter}>
                  <Text style={styles.activeFilterText}>{selectedType}</Text>
                  <TouchableOpacity onPress={() => setSelectedType("all")}>
                    <Ionicons name="close" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              )}
              {priceRange !== "all" && (
                <View style={styles.activeFilter}>
                  <Text style={styles.activeFilterText}>
                    {priceRange === "under-1000" && "Under ₱1,000"}
                    {priceRange === "1000-2000" && "₱1,000-₱2,000"}
                    {priceRange === "2000-5000" && "₱2,000-₱5,000"}
                    {priceRange === "over-5000" && "Over ₱5,000"}
                  </Text>
                  <TouchableOpacity onPress={() => setPriceRange("all")}>
                    <Ionicons name="close" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}
      </>
    )
  }

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="car-outline" size={64} color="#d1d5db" />
      </View>
      <Text style={styles.emptyStateTitle}>
        {activeFilter === "all" && selectedMake === "all" && selectedSeats === "all" && selectedType === "all" && priceRange === "all" 
          ? "No vehicles yet" 
          : "No vehicles found"
        }
      </Text>
      <Text style={styles.emptyStateDescription}>
        {activeFilter === "all" && selectedMake === "all" && selectedSeats === "all" && selectedType === "all" && priceRange === "all"
          ? "Add your first vehicle to get started with your rental business"
          : "Try adjusting your filters to find what you're looking for"
        }
      </Text>
      {(selectedMake !== "all" || selectedSeats !== "all" || selectedType !== "all" || priceRange !== "all") ? (
        <TouchableOpacity
          style={styles.emptyStateButton}
          onPress={clearAllFilters}
        >
          <Ionicons name="refresh" size={18} color="white" />
          <Text style={styles.emptyStateButtonText}>Clear Filters</Text>
        </TouchableOpacity>
      ) : activeFilter === "all" && (
        <TouchableOpacity
          style={styles.emptyStateButton}
          onPress={() => navigation.navigate("AddVehicle")}
        >
          <Ionicons name="add" size={18} color="white" />
          <Text style={styles.emptyStateButtonText}>Add Your First Vehicle</Text>
        </TouchableOpacity>
      )}
    </View>
  )

  return (
<View style={styles.container}>
<ActionModal
        visible={feedbackModal.visible}
        type={feedbackModal.type}
        title={feedbackModal.type === "success" ? "Success" : "Error"}
        message={feedbackModal.message}
        confirmText="OK"
        onClose={() => setFeedbackModal({ visible: false, type: "success", message: "" })}
        onConfirm={() => setFeedbackModal({ visible: false, type: "success", message: "" })}
      />
      <FlatList
        data={paginatedVehicles}
        renderItem={renderVehicleItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderPagination}
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={refreshData}
            colors={["#222"]}
            tintColor="#222"
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        numColumns={1}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
        getItemLayout={undefined}
      />
      
      {renderDeleteModal()}
      {renderFiltersModal()}
    </View>
  )
}

const styles = StyleSheet.create({
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
 
 
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#fcfcfc",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  addButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    flex: 1,
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
    alignItems: 'center',
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  statTrend: {},
  filterDropdownsSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  filterDropdownsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  filterDropdownsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  filterDropdownContainer: {
    flex: 1,
    position: "relative",
  },
  filterDropdownLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  filterDropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flex: 1,
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
  filterDropdownActive: {
    backgroundColor: "#222",
    borderColor: "#222",
  },
  filterDropdownText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    flex: 1,
  },
  filterDropdownTextActive: {
    color: "white",
  },
  filterDropdownMenu: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    backgroundColor: "white",
    borderRadius: 12,
    marginTop: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    zIndex: 9999,
    maxHeight: 250,
  },
  filterDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  filterDropdownItemText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  filterDropdownItemTextActive: {
    color: "#222",
    fontWeight: "600",
  },
  clearAllFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef2f2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: 6,
  },
  clearAllFiltersText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
  filterSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
  },
  filterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  filterHeaderActions: {
    alignItems: "flex-end",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  sectionSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  filterTabs: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  activeFilterTab: {
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginRight: 6,
  },
  activeFilterTabText: {
    color: "#111827",
  },
  filterCount: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 20,
    alignItems: "center",
  },
  activeFilterCount: {
    backgroundColor: "#222",
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6b7280",
  },
  activeFilterCountText: {
    color: "white",
  },
  activeFiltersSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  activeFiltersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  activeFiltersTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  clearFiltersButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
  },
  activeFiltersList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  activeFilter: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#0369a1",
  },
  filtersModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  filtersModalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  filtersHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  filtersTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  filtersCloseButton: {
    padding: 4,
  },
  filtersContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterGroup: {
    marginBottom: 32,
  },
  filterGroupTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 16,
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
  },
  filterOptionActive: {
    backgroundColor: "#222",
    borderColor: "#222",
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6b7280",
  },
  filterOptionTextActive: {
    color: "white",
  },
  filtersActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  filtersClearButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    alignItems: "center",
  },
  filtersClearText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  filtersApplyButton: {
    flex: 2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#222",
    borderRadius: 12,
    alignItems: "center",
  },
  filtersApplyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
  paginationContainer: {
    backgroundColor: "white",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    marginTop: 20,
  },
  paginationInfo: {
    alignItems: "center",
    marginBottom: 16,
  },
  paginationText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  paginationControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  paginationButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 4,
  },
  paginationButtonDisabled: {
    opacity: 0.5,
  },
  paginationButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  paginationButtonTextDisabled: {
    color: "#9ca3af",
  },
  pageNumbers: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pageButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  activePageButton: {
    backgroundColor: "#222",
    borderColor: "#222",
  },
  pageButtonText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
  },
  activePageButtonText: {
    color: "white",
  },
  paginationDots: {
    fontSize: 14,
    color: "#9ca3af",
    paddingHorizontal: 4,
  },
  listContainer: {
    paddingBottom: 20,
  },
  vehicleCard: {
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
    marginHorizontal: 20,
  },
  imageContainer: {
    position: "relative",
    height: 200,
  },
  backgroundImage: {
    width: "100%",
    height: 200,
    justifyContent: "center",
    alignItems: "center",
  },
  vehicleImage: {
    width: "90%",
    height: 180,
  },
  vehicleContent: {
    padding: 20,
  },
  vehicleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  vehicleInfo: {
    flex: 1,
    marginRight: 12,
  },
  vehicleName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  vehicleYear: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  priceContainer: {
    alignItems: "flex-end",
  },
  priceAmount: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  priceLabel: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
  },
  vehicleFeatures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: "30%",
  },
  featureIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  featureText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  variantsPreview: {
    marginBottom: 16,
  },
  variantsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  variantsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  variantChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  variantColor: {
    fontSize: 12,
    color: "#374151",
    fontWeight: "500",
  },
  variantQuantity: {
    fontSize: 11,
    color: "#6b7280",
    marginLeft: 4,
  },
  moreVariants: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
    alignSelf: "center",
  },
  vehicleDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  secondaryButton: {
    backgroundColor: "#f3f4f6",
  },
  dangerButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  flexButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#f1f5f9",
    borderStyle: "dashed",
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateDescription: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
  },
  emptyStateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
  modalVehicleName: {
    fontWeight: "600",
    color: "#111827",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  modalDeleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "black",
    gap: 6,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalDeleteText: {
    fontSize: 14,
    fontWeight: "600",
    color: "white",
  },
})