import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { carOwnersService, variantsService, bookingsService, vehiclesService } from '../services/firebaseService';

export default function OwnerProfileScreen({ navigation, route }) {
  const { ownerId } = route.params;
  const [owner, setOwner] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchOwnerData();

    // Set up real-time subscriptions
    const unsubB = bookingsService.subscribe(() => fetchOwnerData(), () => {});
    return () => unsubB();
  }, [ownerId]);

  const fetchOwnerData = async () => {
    try {
      const ownerData = await carOwnersService.getById(ownerId);
      if (!ownerData) throw new Error('Owner not found');

      const variantsData = await variantsService.listByOwnerId(ownerId);
      const vehicles = await vehiclesService.list();
      const vehiclesMap = Object.fromEntries(vehicles.map((v) => [v.id, v]));
      const variantsWithVehicles = (variantsData || []).map((v) => ({
        ...v,
        vehicles: vehiclesMap[v.vehicle_id] || null,
      }));

      const variantIds = variantsWithVehicles.map((v) => v.id);
      let allBookings = [];
      if (variantIds.length > 0) {
        allBookings = await bookingsService.listByVariantIds(variantIds);
        allBookings = allBookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
    

      const variantsWithEarnings = variantsWithVehicles?.map(variant => {
        const variantBookings = allBookings.filter(b => b.vehicle_variant_id === variant.id);
        const totalEarned = variantBookings
          .filter(b => b.status === 'completed')
          .reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

        return {
          ...variant,
          totalEarned,
          bookingsCount: variantBookings.length
        };
      }) || [];

      // Calculate stats
      const totalEarnings = allBookings
        .filter(b => b.status === 'completed')
        .reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

      const pendingPayments = allBookings
        .filter(b => b.status === 'confirmed')
        .reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

      const activeBookings = allBookings.filter(b => b.status === 'confirmed').length;

      setOwner({
        ...ownerData,
        totalEarnings,
        pendingPayments,
        activeBookings
      });
      setVehicles(variantsWithEarnings);
      setBookings(allBookings);
    } catch (error) {
      console.error('Error fetching owner data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOwnerData();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  };

  if (loading || !owner) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
       {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Owner Profile</Text>
        <TouchableOpacity 
        style={styles.addVehicleButton}
        onPress={() => navigation.navigate("AddVehicle")}
      >
        <Ionicons name="add" size={20} color="white" />
        <Text style={styles.addVehicleButtonText}>Add Vehicle</Text>
      </TouchableOpacity>
      </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{owner.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.ownerName}>{owner.name}</Text>
          <Text style={styles.ownerEmail}>{owner.email}</Text>
          
          <View style={[styles.statusBadge, { 
            backgroundColor: owner.status === 'active' ? '#10b981' : '#6b7280',
            alignSelf: 'center',
            marginTop: 12
          }]}>
            <Text style={styles.statusText}>{owner.status}</Text>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.profileInfoRow}>
              <Text style={styles.profileInfoLabel}>Phone:</Text>
              <Text style={styles.profileInfoValue}>{owner.phone}</Text>
            </View>
            <View style={styles.profileInfoRow}>
              <Text style={styles.profileInfoLabel}>Joined:</Text>
              <Text style={styles.profileInfoValue}>{formatDate(owner.created_at)}</Text>
            </View>
            <View style={styles.profileInfoRow}>
              <Text style={styles.profileInfoLabel}>Vehicles:</Text>
              <Text style={styles.profileInfoValue}>{vehicles.length}</Text>
            </View>
            <View style={styles.profileInfoRow}>
              <Text style={styles.profileInfoLabel}>Active Bookings:</Text>
              <Text style={styles.profileInfoValue}>{owner.activeBookings}</Text>
            </View>
          </View>
        </View>

        {/* Earnings Cards */}
        <View style={styles.earningsContainer}>
          <View style={styles.earningCard}>
            <View style={styles.earningIconContainer}>
              <Ionicons name="cash" size={24} color="#222" />
            </View>
            <Text style={[styles.earningAmount, { color: '#222' }]}>
              ₱{owner.totalEarnings.toLocaleString()}
            </Text>
            <Text style={styles.earningLabel}>Total Earnings</Text>
          </View>

          <View style={styles.earningCard}>
            <View style={styles.earningIconContainer}>
              <Ionicons name="calendar" size={24} color="#222" />
            </View>
            <Text style={[styles.earningAmount, { color: '#222' }]}>
              ₱{owner.pendingPayments.toLocaleString()}
            </Text>
            <Text style={styles.earningLabel}>Pending Payments</Text>
          </View>
        </View>

        {/* Vehicle Earnings Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Earnings Breakdown</Text>
          <Text style={styles.sectionSubtitle}>Revenue generated by each vehicle</Text>

          {vehicles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyStateText}>No vehicles found</Text>
            </View>
          ) : (
            vehicles.map(variant => (
              <TouchableOpacity 
                key={variant.id} 
                style={styles.vehicleEarningCard}
                onPress={() => {
                  if (variant.vehicles?.id) {
                    // Navigate to Vehicles tab and pass the vehicle ID
                    navigation.navigate('Vehicles', {
                      screen: 'VehiclesList',
                      params: { vehicleId: variant.vehicles.id }
                    });
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.vehicleEarningIcon}>
                  <Ionicons name="car" size={24} color="#fcfcfc" />
                </View>
                <View style={styles.vehicleEarningInfo}>
                  <Text style={styles.vehicleEarningName}>
                    {variant.vehicles?.year} {variant.vehicles?.make} {variant.vehicles?.model}
                  </Text>
                  <View style={styles.vehicleEarningDetails}>
                    <View style={styles.vehicleDetailRow}>
                      <Ionicons name="color-palette" size={14} color="#6b7280" />
                      <Text style={styles.vehicleEarningSubtext}>{variant.color}</Text>
                    </View>
                    <View style={styles.vehicleDetailRow}>
                      <Ionicons name="card" size={14} color="#6b7280" />
                      <Text style={styles.vehicleEarningSubtext}>{variant.plate_number}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.vehicleEarningAmount}>
                  <Text style={[styles.earningAmount, { color: '#10b981', fontSize: 18 }]}>
                    ₱{variant.totalEarned.toLocaleString()}
                  </Text>
                  <Text style={styles.earningLabel}>Total earned</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Recent Bookings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Bookings</Text>
          <Text style={styles.sectionSubtitle}>Latest bookings for this owner's vehicles</Text>

          {bookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyStateText}>No bookings found</Text>
            </View>
          ) : (
            bookings.slice(0, 5).map(booking => (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingCustomerRow}>
                    <Ionicons name="person" size={16} color="#111827" />
                    <Text style={styles.bookingCustomer}>{booking.customer_name}</Text>
                  </View>
                  <View style={[styles.bookingStatusBadge, { 
                    backgroundColor: getStatusColor(booking.status) + '20' 
                  }]}>
                    <Text style={[styles.bookingStatusText, { 
                      color: getStatusColor(booking.status) 
                    }]}>
                      {booking.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.bookingVehicleRow}>
                  <Ionicons name="car" size={14} color="#6b7280" />
                  <Text style={styles.bookingVehicle}>
                    {booking.vehicles?.year} {booking.vehicles?.make} {booking.vehicles?.model}
                    {booking.vehicle_variants?.color && ` - ${booking.vehicle_variants.color}`}
                  </Text>
                </View>
                {booking.vehicle_variants?.plate_number && (
                  <View style={styles.bookingPlateRow}>
                    <Ionicons name="card" size={14} color="#6b7280" />
                    <Text style={styles.bookingPlateText}>{booking.vehicle_variants.plate_number}</Text>
                  </View>
                )}
                <View style={styles.bookingFooter}>
                  <View style={styles.bookingDateRow}>
                    <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                    <Text style={styles.bookingDate}>{formatDate(booking.created_at)}</Text>
                  </View>
                  <View style={styles.bookingAmountRow}>
                    <Ionicons name="cash-outline" size={14} color="#10b981" />
                    <Text style={styles.bookingAmount}>₱{parseFloat(booking.total_price).toLocaleString()}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusColor = (status) => {
  switch (status) {
    case 'confirmed':
      return '#10b981';
    case 'pending':
      return '#f59e0b';
    case 'completed':
      return '#3b82f6';
    case 'cancelled':
      return '#ef4444';
    case 'declined':
      return '#8b5cf6';
    default:
      return '#6b7280';
  }
};

// ... rest of your styles remain the same

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfcfc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',  // ✅ Add this
    justifyContent: 'space-between',  // ✅ Add this
    alignItems: 'center',  // ✅ Add this
  },
  addVehicleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    gap: 6,
  },
  addVehicleButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    color: '#222',
    marginLeft: 8,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  profileCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLargeText: {
    fontSize: 32,
    fontWeight: '600',
    color: 'white',
  },
  ownerName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  ownerEmail: {
    fontSize: 16,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    textTransform: 'capitalize',
  },
  profileInfo: {
    width: '100%',
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  profileInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  profileInfoLabel: {
    fontSize: 16,
    color: '#6b7280',
  },
  profileInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  earningsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  earningCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  earningIconContainer: {
    marginBottom: 12,
  },
  earningAmount: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  earningLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  vehicleEarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  vehicleEarningIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  vehicleEarningInfo: {
    flex: 1,
  },
  vehicleEarningName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  vehicleEarningDetails: {
    gap: 4,
  },
  vehicleDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleEarningSubtext: {
    fontSize: 13,
    color: '#6b7280',
  },
  vehicleEarningAmount: {
    alignItems: 'flex-end',
  },
  bookingCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bookingCustomer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  bookingStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bookingStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  bookingVehicle: {
    fontSize: 14,
    color: '#6b7280',
  },

  bookingCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  bookingVehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  bookingPlateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  bookingPlateText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookingDate: {
    fontSize: 13,
    color: '#6b7280',
  },
  bookingAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bookingAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9ca3af',
    marginTop: 12,
  },
});