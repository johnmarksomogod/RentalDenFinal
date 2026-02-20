import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { vehiclesService, variantsService, bookingsService } from '../services/firebaseService';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 40) / 7;

export default function CalendarComponent({ 
  showHeader = true,
  headerTitle = "Rental Calendar",
  headerSubtitle = "Tap any date to view bookings",
  showLegend = true,
  containerStyle,
  onDateSelect,
  onBookingSelect
}) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]);
  const [bookings, setBookings] = useState({});
  const [dayBookings, setDayBookings] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [vehicles, setVehicles] = useState([]);
  const [vehicleVariants, setVehicleVariants] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const [bookingStats, setBookingStats] = useState({
    pending: 0,
    confirmed: 0,
    ongoing: 0,
    delivered: 0,
    retrieved: 0,
    completed: 0,
    cancelled: 0,
    declined: 0,
    total: 0
  });

  useEffect(() => {
    fetchVehicles();
    fetchVehicleVariants();
    fetchBookings();
    
    const unsub = bookingsService.subscribe(() => fetchBookings(), () => {});

    return () => unsub();
  }, []);

  useEffect(() => {
    if (vehicleVariants.length > 0 || selectedVariant === null) {
      fetchBookings();
    }
  }, [selectedVariant]);

  const fetchVehicles = async () => {
    try {
      const vehiclesData = await vehiclesService.list();
      setVehicles((vehiclesData || []).sort((a, b) => (a.make || '').localeCompare(b.make || '')));
    } catch (error) {
      console.error('Error processing vehicles:', error);
    }
  };

  const fetchVehicleVariants = async () => {
    try {
      const variantsData = await variantsService.list();
      const vehicles = await vehiclesService.list();
      const vehiclesMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));
      const withVehicles = (variantsData || []).map((v) => ({ ...v, vehicles: vehiclesMap[v.vehicle_id] || null }));
      setVehicleVariants(withVehicles);
    } catch (error) {
      console.error('Error processing vehicle variants:', error);
    }
  };

  const calculateBookingStats = (bookingsData) => {
    const stats = {
      pending: 0,
      confirmed: 0,
      ongoing: 0,
      delivered: 0,
      retrieved: 0,
      completed: 0,
      cancelled: 0,
      declined: 0,
      total: 0
    };

    bookingsData?.forEach(booking => {
      const status = booking.status?.toLowerCase();
      if (stats.hasOwnProperty(status)) {
        stats[status]++;
      }
      stats.total++;
    });

    setBookingStats(stats);
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      
      let bookingsData = await bookingsService.listWithDetails();
      if (selectedVariant) {
        bookingsData = bookingsData.filter((b) => b.vehicle_variant_id === selectedVariant);
      }
      bookingsData = bookingsData.sort(
        (a, b) => new Date(a.rental_start_date) - new Date(b.rental_start_date)
      );

      calculateBookingStats(bookingsData);

      const processedBookings = {};
      
      bookingsData?.forEach((booking) => {
        const startDate = booking.rental_start_date;
        const endDate = booking.rental_end_date;
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          
          if (!processedBookings[dateStr]) {
            processedBookings[dateStr] = {
              bookings: []
            };
          }
          
          processedBookings[dateStr].bookings.push(booking);
        }
      });
      
      setBookings(processedBookings);
    } catch (error) {
      console.error('Error processing bookings:', error);
      Alert.alert('Error', 'An error occurred while processing bookings');
      setBookings({});
      setBookingStats({ pending: 0, confirmed: 0, ongoing: 0, delivered: 0, retrieved: 0, completed: 0, cancelled: 0, declined: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push({ empty: true, key: `empty-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day,
        dateStr,
        bookings: bookings[dateStr]?.bookings || [],
        key: dateStr
      });
    }

    return days;
  };

  const changeMonth = (direction) => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':   return '#f59e0b'; // Amber - awaiting confirmation
      case 'confirmed': return '#3b82f6'; // Blue - confirmed and ready
      case 'ongoing':   return '#8b5cf6'; // Purple - in progress/transit
      case 'delivered': return '#ec4899'; // Pink - delivered to customer
      case 'retrieved': return '#06b6d4'; // Cyan - retrieved from customer
      case 'completed': return '#10b981'; // Green - successfully completed ✓
      case 'cancelled': return '#ef4444'; // Red - cancelled
      case 'declined':  return '#f97316'; // Orange - declined
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'confirmed': return 'checkmark-circle-outline';
      case 'ongoing': return 'car-outline';
      case 'delivered': return 'location-outline';
      case 'retrieved': return 'return-up-back-outline';
      case 'completed': return 'checkmark-done-circle-outline';
      case 'cancelled': return 'close-circle-outline';
      case 'declined': return 'remove-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const getCellBackgroundColor = (dayBookings) => {
    if (dayBookings.length === 0) return '#fff';
    
    if (dayBookings.length === 1) {
      const statusColor = getStatusColor(dayBookings[0].status);
      return statusColor + '20';
    }
    
    const statusColor = getStatusColor(dayBookings[0].status);
    return statusColor + '20';
  };

  const getCellBorderColor = (dayBookings) => {
    if (dayBookings.length === 0) return '#e5e7eb';
    return getStatusColor(dayBookings[0].status);
  };

  const onDayPress = (dateStr, dayBookings) => {
    if (!dateStr) return;
    
    setSelectedDate(dateStr);
    setDayBookings(dayBookings);
    setModalVisible(true);
    
    if (onDateSelect) {
      onDateSelect(dateStr, dayBookings);
    }
  };

  const formatCurrency = (amount) => {
    return `₱${parseFloat(amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const handleBookingPress = (booking) => {
    if (onBookingSelect) {
      onBookingSelect(booking);
    }
  };

  const handleVariantSelect = (variantId) => {
    setSelectedVariant(variantId);
    setFilterModalVisible(false);
  };

  const renderBookingItem = ({ item }) => {
    const totalCollected = (item.payment_log || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    return (
      <TouchableOpacity 
        style={styles.bookingItem}
        onPress={() => handleBookingPress(item)}
        activeOpacity={onBookingSelect ? 0.7 : 1}
      >
        {(item.vehicle_variants?.image_url || item.vehicles?.image_url) && (
          <View style={styles.bookingImageContainer}>
            <Image
              source={{ uri: item.vehicle_variants?.image_url || item.vehicles?.image_url }}
              style={styles.bookingVehicleImage}
              resizeMode="cover"
            />
            <View style={styles.vehicleOverlay}>
              <Text style={styles.vehicleName}>
                {item.vehicles.year} {item.vehicles.make} {item.vehicles.model}
                {item.vehicle_variants?.color && ` - ${item.vehicle_variants.color}`}
              </Text>
              {item.vehicle_variants?.plate_number && (
                <View style={styles.plateNumberRow}>
                  <Ionicons name="card" size={14} color="#fff" />
                  <Text style={styles.plateNumberText}>
                    Plate No: {item.vehicle_variants?.plate_number || 'N/A'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.bookingContentContainer}>
          <View style={styles.bookingHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="person" size={16} color="#666" />
              <Text style={styles.customerName}>{item.customer_name}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Ionicons name={getStatusIcon(item.status)} size={12} color="white" style={{ marginRight: 4 }} />
              <Text style={styles.statusText}>{item.status?.toUpperCase()}</Text>
            </View>
          </View>
        
          <View style={styles.bookingDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="car" size={16} color="#666" />
              <Text style={styles.detailText}>
                {item.vehicles ? `${item.vehicles.year} ${item.vehicles.make} ${item.vehicles.model}` : 'Vehicle Info Unavailable'}
                {item.vehicle_variants?.color && ` - ${item.vehicle_variants.color}`}
              </Text>
            </View>
        
            <View style={styles.detailRow}>
              <Ionicons name="calendar" size={16} color="#666" />
              <Text style={styles.detailText}>
                {formatDate(item.rental_start_date)} - {formatDate(item.rental_end_date)}
              </Text>
            </View>
          
            <View style={styles.detailRow}>
              <Ionicons name="call" size={16} color="#666" />
              <Text style={styles.detailText}>{item.customer_phone}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="mail" size={16} color="#666" />
              <Text style={styles.detailText}>{item.customer_email}</Text>
            </View>
          
            <View style={styles.detailRow}>
              <Ionicons name="cash" size={16} color="#666" />
              <Text style={styles.detailText}>Rental: {formatCurrency(item.total_price)}</Text>
            </View>

            {/* Driver Information */}
            {item.assigned_driver && (
              <View style={styles.detailRow}>
                <Ionicons name="person-circle" size={16} color="#666" />
                <Text style={styles.detailText}>Driver: {item.assigned_driver}</Text>
              </View>
            )}

            {/* Delivery Address */}
            {item.delivery_address && (
              <View style={styles.detailRow}>
                <Ionicons name="location" size={16} color="#666" />
                <Text style={styles.detailText}>{item.delivery_address}</Text>
              </View>
            )}

            {/* Pickup Location */}
            {item.pickup_location && !item.delivery_address && (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={16} color="#666" />
                <Text style={styles.detailText}>{item.pickup_location}</Text>
              </View>
            )}

            {/* License Number */}
            {item.license_number && (
              <View style={styles.detailRow}>
                <Ionicons name="id-card" size={16} color="#666" />
                <Text style={styles.detailText}>License: {item.license_number}</Text>
              </View>
            )}

            {/* Payment Collected */}
            {totalCollected > 0 && (
              <View style={styles.detailRow}>
                <Ionicons name="wallet" size={16} color="#666" />
                <Text style={styles.detailText}>Collected: {formatCurrency(totalCollected)}</Text>
              </View>
            )}

            {/* Delivery Fee */}
            {item.delivery_fee && Number(item.delivery_fee) > 0 && (
              <View style={styles.detailRow}>
                <Ionicons name="car-sport" size={16} color="#666" />
                <Text style={styles.detailText}>Delivery Fee: {formatCurrency(item.delivery_fee)}</Text>
              </View>
            )}

            {/* Extra Charges */}
            {item.fuel_charge && Number(item.fuel_charge) > 0 && (
              <View style={styles.detailRow}>
                <Ionicons name="flame" size={16} color="#666" />
                <Text style={styles.detailText}>Fuel Charge: {formatCurrency(item.fuel_charge)}</Text>
              </View>
            )}

            {item.delay_charge && Number(item.delay_charge) > 0 && (
              <View style={styles.detailRow}>
                <Ionicons name="time" size={16} color="#666" />
                <Text style={styles.detailText}>Delay Charge: {formatCurrency(item.delay_charge)}</Text>
              </View>
            )}

            {item.damage_fee && Number(item.damage_fee) > 0 && (
              <View style={styles.detailRow}>
                <Ionicons name="warning" size={16} color="#666" />
                <Text style={styles.detailText}>Damage Fee: {formatCurrency(item.damage_fee)}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDay = ({ item }) => {
    if (item.empty) {
      return <View style={styles.emptyCell} />;
    }

    const isToday = item.dateStr === today.toISOString().split('T')[0];
    const isSelected = item.dateStr === selectedDate;
    const hasBookings = item.bookings.length > 0;
    
    const firstBooking = item.bookings[0];
    const vehicleImage = firstBooking?.vehicle_variants?.image_url || firstBooking?.vehicles?.image_url;

    const cellBackgroundColor = hasBookings ? getCellBackgroundColor(item.bookings) : '#fff';
    const cellBorderColor = hasBookings ? getCellBorderColor(item.bookings) : '#e5e7eb';

    return (
      <TouchableOpacity
        style={[
          styles.dayCell,
          { backgroundColor: cellBackgroundColor },
          { borderColor: cellBorderColor },
          hasBookings && { borderWidth: 2 },
          isToday && styles.todayCell,
          isSelected && styles.selectedCell,
        ]}
        onPress={() => onDayPress(item.dateStr, item.bookings)}
      >
        <Text style={[
          styles.dayNumber,
          isToday && styles.todayText,
          isSelected && styles.selectedText
        ]}>
          {item.day}
        </Text>
        
        {hasBookings && vehicleImage ? (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: vehicleImage }}
              style={styles.vehicleImage}
              resizeMode="cover"
            />
            {item.bookings.length > 1 && (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>+{item.bookings.length - 1}</Text>
              </View>
            )}
          </View>
        ) : hasBookings ? (
          <View style={styles.dotsContainer}>
            {item.bookings.slice(0, 3).map((booking, index) => (
              <View
                key={`${booking.id || booking.booking_id || 'no-id'}-${index}`}
                style={[styles.dot, { backgroundColor: getStatusColor(booking.status) }]}
              />
            ))}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, containerStyle]}>
        <ActivityIndicator size="large" color="#222" />
        <Text style={styles.loadingText}>Loading calendar...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, containerStyle]}>
      {showHeader && (
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setFilterModalVisible(true)}
          >
            <Ionicons name="car" size={20} color="#222" />
            <Text style={styles.filterButtonText} numberOfLines={1}>
              {selectedVariant 
                ? (() => {
                    const variant = vehicleVariants.find(v => v.id === selectedVariant);
                    return variant 
                      ? `${variant.vehicles?.make || ''} ${variant.vehicles?.model || ''} - ${variant.plate_number || ''}`
                      : 'All Cars';
                  })()
                : 'All Cars'
              }
            </Text>
            <Ionicons name="chevron-down" size={16} color="#222" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.calendarContainer}>
        <View style={styles.monthNavigation}>
          <TouchableOpacity onPress={() => changeMonth('prev')} style={styles.navButton}>
            <Ionicons name="chevron-back" size={24} color="#222" />
          </TouchableOpacity>
          
          <Text style={styles.monthText}>
            {monthNames[currentMonth]} {currentYear}
          </Text>
          
          <TouchableOpacity onPress={() => changeMonth('next')} style={styles.navButton}>
            <Ionicons name="chevron-forward" size={24} color="#222" />
          </TouchableOpacity>
        </View>

        <View style={styles.dayHeaders}>
          {dayNames.map((day) => (
            <View key={day} style={styles.dayHeader}>
              <Text style={styles.dayHeaderText}>{day}</Text>
            </View>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {generateCalendarDays().map((day) => (
            <React.Fragment key={day.key}>
              {renderDay({ item: day })}
            </React.Fragment>
          ))}
        </View>
      </View>

      {showLegend && (
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Booking Status</Text>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendText}>Pending</Text>
                <Text style={styles.legendCount}>{bookingStats.pending}</Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendText}>Confirmed</Text>
                <Text style={styles.legendCount}>{bookingStats.confirmed}</Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendText}>Ongoing</Text>
                <Text style={styles.legendCount}>{bookingStats.ongoing}</Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ec4899' }]} />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendText}>Delivered</Text>
                <Text style={styles.legendCount}>{bookingStats.delivered}</Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#06b6d4' }]} />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendText}>Retrieved</Text>
                <Text style={styles.legendCount}>{bookingStats.retrieved}</Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendText}>Completed</Text>
                <Text style={styles.legendCount}>{bookingStats.completed}</Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#ef4444' }]} />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendText}>Cancelled</Text>
                <Text style={styles.legendCount}>{bookingStats.cancelled}</Text>
              </View>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
              <View style={styles.legendTextContainer}>
                <Text style={styles.legendText}>Declined</Text>
                <Text style={styles.legendCount}>{bookingStats.declined}</Text>
              </View>
            </View>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Bookings:</Text>
            <Text style={styles.totalValue}>{bookingStats.total}</Text>
          </View>
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Bookings for {formatDate(selectedDate)}
              </Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {dayBookings.length > 0 ? (
              <FlatList
                data={dayBookings}
                renderItem={renderBookingItem}
                keyExtractor={(item) => item.id?.toString() || item.booking_id?.toString()}
                showsVerticalScrollIndicator={false}
                style={styles.bookingsList}
              />
            ) : (
              <View style={styles.noBookings}>
                <Ionicons name="calendar-outline" size={48} color="#ccc" />
                <Text style={styles.noBookingsText}>No bookings for this date</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        transparent={true}
        visible={filterModalVisible}
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.filterModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Vehicle</Text>
              <TouchableOpacity 
                onPress={() => setFilterModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#222" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.vehicleList}>
              <TouchableOpacity
                style={[
                  styles.vehicleOption,
                  selectedVariant === null && styles.vehicleOptionSelected
                ]}
                onPress={() => handleVariantSelect(null)}
              >
                <View style={styles.vehicleOptionContent}>
                  <Ionicons name="car" size={24} color="#222" />
                  <Text style={styles.vehicleOptionText}>All Cars</Text>
                </View>
                {selectedVariant === null && (
                  <Ionicons name="checkmark-circle" size={24} color="#222" />
                )}
              </TouchableOpacity>

              {vehicleVariants.map((variant) => (
                <TouchableOpacity
                  key={variant.id?.toString() || `variant-${Math.random()}`}
                  style={[
                    styles.vehicleOption,
                    selectedVariant === variant.id && styles.vehicleOptionSelected
                  ]}
                  onPress={() => handleVariantSelect(variant.id)}
                >
                  <View style={styles.vehicleOptionContent}>
                    {variant.image_url ? (
                      <Image
                        source={{ uri: variant.image_url }}
                        style={styles.vehicleOptionImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.vehicleOptionImagePlaceholder}>
                        <Ionicons name="car" size={24} color="#999" />
                      </View>
                    )}
                    <View style={styles.vehicleOptionInfo}>
                      <Text style={styles.vehicleOptionText}>
                        {variant.vehicles?.model} {variant.vehicles?.make} {variant.vehicles?.year}
                      </Text>
                      <View style={styles.vehicleOptionDetails}>
                        {variant.color && (
                          <View style={styles.vehicleOptionDetail}>
                            <Ionicons name="color-palette" size={14} color="#666" />
                            <Text style={styles.vehicleOptionDetailText}>{variant.color}</Text>
                          </View>
                        )}
                        {variant.plate_number && (
                          <View style={styles.vehicleOptionDetail}>
                            <Ionicons name="card" size={14} color="#666" />
                            <Text style={styles.vehicleOptionDetailText}>{variant.plate_number}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                  {selectedVariant === variant.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#222" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfcfc',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    padding: 20,
    backgroundColor: '#fcfcfc',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    gap: 6,
  },
  filterButtonText: {
    color: '#222',
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 80
  },
  calendarContainer: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5  
  },
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  navButton: {
    padding: 8,
  },
  monthText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  dayHeader: {
    width: CELL_SIZE,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
  },
  dayCell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 4,
    backgroundColor: '#fff',
  },
  todayCell: {
    borderColor: '#222',
    borderWidth: 2,
  },
  selectedCell: {
    backgroundColor: '#f3f4f6',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  todayText: {
    color: '#222',
  },
  selectedText: {
    color: '#222',
    fontWeight: 'bold',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
    marginTop: 0,
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  countBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#222',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    minWidth: 16,
    alignItems: 'center',
  },
  countText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legendContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
    minWidth: '22%',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  legendCount: {
    fontSize: 11,
    color: '#111827',
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  bookingsList: {
    padding: 20,
  },
  bookingItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  bookingImageContainer: {
    width: '100%',
    height: 200,
    position: 'relative',
  },
  bookingVehicleImage: {
    width: '100%',
    height: '100%',
  },
  vehicleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
  },
  vehicleName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  plateNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  plateNumberText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  bookingContentContainer: {
    padding: 16,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bookingDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  noBookings: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noBookingsText: {
    fontSize: 16,
    color: '#ccc',
    marginTop: 12,
  },
  filterModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '100%',
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
  },
  vehicleList: {
    padding: 16,
    maxHeight: 400,
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  vehicleOptionSelected: {
    borderColor: '#222',
    backgroundColor: '#fcfcfc',
  },
  vehicleOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  vehicleOptionImage: {
    width: 100,
    height: 60,
    borderRadius: 8,
  },
  vehicleOptionImagePlaceholder: {
    width: 100,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleOptionInfo: {
    flex: 1,
  },
  vehicleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  vehicleOptionDetails: {
    marginTop: 6,
    gap: 4,
  },
  vehicleOptionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleOptionDetailText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
});