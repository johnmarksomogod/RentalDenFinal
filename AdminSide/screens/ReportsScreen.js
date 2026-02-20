import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import BookingOverviewChart from '../components/BookingOverviewChart';
import RevenueOverviewChart from '../components/BookingScreen/RevenueOverviewChart';
import VehicleAnalyticsChart from '../components/BookingScreen/VehicleAnalyticsChart';
import { bookingsService } from '../services/firebaseService';


export default function BookingsAnalyticsScreen() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBookings: 0,
    totalRevenue: 0,
    averageBookingValue: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
  });
  const [timeFilter, setTimeFilter] = useState('weekly'); // monthly, weekly, today

  useEffect(() => {
    fetchBookingsData();
  }, [timeFilter]);

  const getDateFilter = () => {
    const now = new Date();
    let startDate;

    switch (timeFilter) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return startDate.toISOString();
  };

  const fetchBookingsData = async () => {
    try {
      setLoading(true);
      const startDate = getDateFilter();

      const bookingsRaw = await bookingsService.listWithDetails();
      const bookingsData = (bookingsRaw || []).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      setBookings(bookingsData);

      // Calculate statistics
      const totalBookings = bookingsData?.length || 0;
      // ✅ Only completed bookings count towards revenue
      const totalRevenue =
  bookingsData
    ?.filter((b) => b.status?.trim().toLowerCase() === "completed")
    .reduce((sum, booking) => sum + parseFloat(booking.total_price || 0), 0) || 0;
   
      const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;
        

      const statusCounts =
  bookingsData?.reduce((acc, booking) => {
    const status = booking.status?.trim().toLowerCase(); // normalize
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {}) || {};


      setStats({
        totalBookings,
        totalRevenue,
        averageBookingValue,
        pendingBookings: statusCounts.pending || 0,
        confirmedBookings: statusCounts.confirmed || 0,
        completedBookings: statusCounts.completed || 0,
        cancelledBookings: statusCounts.cancelled || 0,
      });

    } catch (error) {
      console.error('Error fetching bookings:', error);
      Alert.alert('Error', 'Failed to fetch bookings data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Ionicons name="time-outline" size={16} color="#f59e0b" />;
      case 'confirmed':
        return <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />;
      case 'completed':
        return <Ionicons name="checkmark-done-circle-outline" size={16} color="#3b82f6" />;
      case 'cancelled':
        return <Ionicons name="close-circle-outline" size={16} color="#ef4444" />;
      default:
        return <Ionicons name="help-circle-outline" size={16} color="#6b7280" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'confirmed':
        return '#10b981';
      case 'completed':
        return '#059669';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>Loading bookings data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Bookings Analytics</Text>
            </View>

            {/* Stats Cards */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Ionicons name="car" size={28} color="#222" style={styles.statIcon} />
                <Text style={styles.statValue}>{stats.totalBookings}</Text>
                <Text style={styles.statLabel}>Total Bookings</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="trending-up" size={28} color="#222" style={styles.statIcon} />
                <Text style={styles.statValue}>{formatCurrency(stats.totalRevenue)}</Text>
                <Text style={styles.statLabel}>Total Revenue</Text>
              </View>
            </View>

            {/* Additional Stats */}
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Ionicons name="cash-outline" size={28} color="#222" style={styles.statIcon} />
                <Text style={styles.statValue}>{formatCurrency(stats.averageBookingValue)}</Text>
                <Text style={styles.statLabel}>Avg Booking Value</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="checkmark-done-outline" size={28} color="#222" style={styles.statIcon} />
                <Text style={styles.statValue}>{stats.completedBookings}</Text>
                <Text style={styles.statLabel}>Completed</Text>
              </View>
            </View>

            {/* Booking Overview Chart */}
            <BookingOverviewChart />

            {/* Revenue Overview Chart */}
            <RevenueOverviewChart />

            {/* Vehicle Analytics Chart */}
            <VehicleAnalyticsChart />

           
          </>
        }
      
        
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfcfc',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 25,
    marginBottom: 24,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: -0.5,
  },
  bookingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  vehicleImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderImage: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookingInfo: {
    flex: 1,
  },
  vehicleName: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 2,
    color: '#111827',
  },
  customerName: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  rentalDates: {
    fontSize: 12,
    color: '#9ca3af',
  },
  bookingDetails: {
    alignItems: 'flex-end',
  },
  bookingPrice: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 4,
    color: '#111827',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
});