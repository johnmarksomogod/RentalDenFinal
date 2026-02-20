import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  RefreshControl,
  SafeAreaView,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { carOwnersService, variantsService, bookingsService } from '../services/firebaseService';
import ActionModal from '../components/AlertModal/ActionModal';

export default function CarOwnersScreen({ navigation }) {
  const [owners, setOwners] = useState([]);
  const [filteredOwners, setFilteredOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [confirmAddModal, setConfirmAddModal] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [feedbackModal, setFeedbackModal] = useState({
    visible: false,
    type: "success",
    message: ""
  });

  // Form data for new owner
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    fetchOwners();
    const unsubO = carOwnersService.subscribe(() => fetchOwners(), () => {});
    const unsubB = bookingsService.subscribe(() => fetchOwners(), () => {});
    return () => { unsubO(); unsubB(); };
  }, []);

  useEffect(() => {
    filterOwners();
  }, [owners, searchQuery, statusFilter]);

  const fetchOwners = async () => {
    try {
      const ownersData = await carOwnersService.listAll();

      const ownersWithStats = await Promise.all(
        ownersData.map(async (owner) => {
          const variants = await variantsService.listByOwnerId(owner.id);
          const variantIds = variants?.map((v) => v.id) || [];
          const vehiclesCount = variants?.length || 0;

          let bookings = [];
          if (variantIds.length > 0) {
            bookings = await bookingsService.listByVariantIds(variantIds);
          }

          // Calculate earnings and stats
          const totalEarnings = bookings
            ?.filter(b => b.status === 'completed')
            .reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0) || 0;

          const pendingPayments = bookings
            ?.filter(b => b.status === 'confirmed')
            .reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0) || 0;

          const activeBookings = bookings
            ?.filter(b => b.status === 'confirmed').length || 0;

          console.log(`Owner: ${owner.name}, Active bookings:`, activeBookings);

          return {
            ...owner,
            vehiclesCount,
            totalEarnings,
            pendingPayments,
            activeBookings
          };
        })
      );

      // Sort to keep "Rental Den" at the top
      const sortedOwners = ownersWithStats.sort((a, b) => {
        if (a.name.toLowerCase() === 'rental den') return -1;
        if (b.name.toLowerCase() === 'rental den') return 1;
        return 0;
      });

      setOwners(sortedOwners);
    } catch (error) {
      console.error('Error fetching owners:', error);
      Alert.alert('Error', 'Failed to fetch car owners');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterOwners = () => {
    let filtered = [...owners];

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(owner =>
        owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        owner.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(owner => owner.status === statusFilter);
    }

    setFilteredOwners(filtered);
  };

  const handleAddOwnerClick = () => {
    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setAddModalVisible(false);
    setConfirmAddModal(true);
  };

  const addNewOwner = async () => {
    try {
      await carOwnersService.add({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        status: 'active',
      });

      setFeedbackModal({
        visible: true,
        type: "success",
        message: "Car owner added successfully!"
      });

      setConfirmAddModal(false);
      setFormData({ name: '', email: '', phone: '' });
      await fetchOwners();
    } catch (error) {
      console.error('Error adding owner:', error);
      setFeedbackModal({
        visible: true,
        type: "error",
        message: "Failed to add car owner"
      });
      setConfirmAddModal(false);
    }
  };

  const handleDeleteOwner = (owner) => {
    // Prevent deletion of Rental Den
    if (owner.name.toLowerCase() === 'rental den') {
      Alert.alert('Cannot Delete', 'Rental Den is the main business owner and cannot be deleted.');
      return;
    }
    setSelectedOwner(owner);
    setConfirmDeleteModal(true);
  };

  const proceedToDelete = () => {
    setConfirmDeleteModal(false);
    setDeleteModalVisible(true);
  };

  const confirmDeleteOwner = async () => {
    if (!selectedOwner) return;

    try {
      // Check if owner has vehicles
      if (selectedOwner.vehiclesCount > 0) {
        setDeleteModalVisible(false);
        setFeedbackModal({
          visible: true,
          type: "error",
          message: "Cannot delete owner with existing vehicles. Please remove all vehicles first."
        });
        setSelectedOwner(null);
        return;
      }

      await carOwnersService.delete(selectedOwner.id);

      setFeedbackModal({
        visible: true,
        type: "success",
        message: "Car owner deleted successfully!"
      });

      setDeleteModalVisible(false);
      setSelectedOwner(null);
      await fetchOwners();
    } catch (error) {
      console.error('Error deleting owner:', error);
      setFeedbackModal({
        visible: true,
        type: "error",
        message: "Failed to delete car owner"
      });
      setDeleteModalVisible(false);
      setSelectedOwner(null);
    }
  };

  const getStatsCards = () => {
    const totalOwners = owners.length;
    const activeOwners = owners.filter(o => o.status === 'active').length;
    const totalEarnings = owners.reduce((sum, o) => sum + (o.totalEarnings || 0), 0);
    const pendingPayments = owners.reduce((sum, o) => sum + (o.pendingPayments || 0), 0);

    return { totalOwners, activeOwners, totalEarnings, pendingPayments };
  };

  const stats = getStatsCards();

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Car Owners Management</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="people" size={28} color="#222" />
            </View>
            <Text style={styles.statValue}>{stats.totalOwners}</Text>
            <Text style={styles.statLabel}>Total Owners</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="person" size={28} color="#222" />
            </View>
            <Text style={[styles.statValue, { color: '#222' }]}>{stats.activeOwners}</Text>
            <Text style={styles.statLabel}>Active Owners</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="cash" size={28} color="#222" />
            </View>
            <Text style={[styles.statValue, { color: '#222' }]}>
              ₱{stats.totalEarnings.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="calendar" size={28} color="#222" />
            </View>
            <Text style={[styles.statValue, { color: '#222' }]}>
              ₱{stats.pendingPayments.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Pending Payments</Text>
          </View>
        </View>
      </View>

      {/* Search and Filter */}
      <View style={styles.controlsContainer}>
        <View style={styles.topControlsRow}>
          <TouchableOpacity style={styles.addButtonSmall} onPress={() => setAddModalVisible(true)}>
            <Ionicons name="add" size={20} color="white" />
            <Text style={styles.addButtonSmallText}>Add Owner</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search owners by name or email..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterButton, statusFilter === 'All' && styles.filterButtonActive]}
            onPress={() => setStatusFilter('All')}
          >
            <Text style={[styles.filterText, statusFilter === 'All' && styles.filterTextActive]}>
              All Statuses
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, statusFilter === 'active' && styles.filterButtonActive]}
            onPress={() => setStatusFilter('active')}
          >
            <Text style={[styles.filterText, statusFilter === 'active' && styles.filterTextActive]}>
              Active
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, statusFilter === 'inactive' && styles.filterButtonActive]}
            onPress={() => setStatusFilter('inactive')}
          >
            <Text style={[styles.filterText, statusFilter === 'inactive' && styles.filterTextActive]}>
              Inactive
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderOwnerItem = ({ item }) => {
    const isRentalDen = item.name.toLowerCase() === 'rental den';
    
    return (
      <TouchableOpacity
        style={[styles.ownerCard, isRentalDen && styles.ownerCardRentalDen]}
        onPress={() => navigation.navigate('OwnerProfile', { ownerId: item.id })}
      >
        {isRentalDen && (
          <View style={styles.mainOwnerBadge}>
            <Ionicons name="star" size={14} color="#f59e0b" />
            <Text style={styles.mainOwnerText}>Main Business Owner</Text>
          </View>
        )}
        
        <View style={styles.ownerHeader}>
          <View style={[styles.avatarContainer, isRentalDen && styles.avatarRentalDen]}>
            <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.ownerInfo}>
            <Text style={styles.ownerName}>{item.name}</Text>
            <Text style={styles.ownerEmail}>{item.email}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: item.status === 'active' ? '#10b981' : '#6b7280' }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.ownerStats}>
          <View style={styles.statRow}>
            <Text style={[styles.statAmount, { color: '#10b981' }]}>
              ₱{item.totalEarnings.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Total Earnings</Text>
          </View>

          <View style={styles.statRow}>
            <Text style={[styles.statAmount, { color: '#f59e0b' }]}>
              ₱{item.pendingPayments.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        <View style={styles.ownerFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="car" size={16} color="#6b7280" />
            <Text style={styles.footerText}>{item.vehiclesCount} vehicles</Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="calendar" size={16} color="#6b7280" />
            <Text style={styles.footerText}>{item.activeBookings} active bookings</Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.viewButton}
            onPress={() => navigation.navigate('OwnerProfile', { ownerId: item.id })}
          >
            <Ionicons name="eye" size={16} color="black" />
            <Text style={styles.viewButtonText}>View Profile</Text>
          </TouchableOpacity>

          {!isRentalDen && (
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => handleDeleteOwner(item)}
            >
              <Ionicons name="trash-outline" size={16} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="people-outline" size={64} color="#d1d5db" />
      <Text style={styles.emptyStateTitle}>No car owners found</Text>
      <Text style={styles.emptyStateText}>Add your first car owner to get started</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
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
        data={filteredOwners}
        renderItem={renderOwnerItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOwners(); }} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Owner Modal */}
      <Modal visible={addModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Owner</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>Enter the details of the new car owner below.</Text>

            <View style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="john.doe@email.com"
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+63 XXX XXX XXXX"
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  keyboardType="phone-pad"
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setAddModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleAddOwnerClick}>
                <Text style={styles.submitButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Confirm Add Modal */}
      <ActionModal
        visible={confirmAddModal}
        type="confirm"
        title="Confirm Add Owner"
        message={`Are you sure you want to add "${formData.name}" as a car owner?`}
        confirmText="Add Owner"
        cancelText="Cancel"
        onClose={() => setConfirmAddModal(false)}
        onConfirm={addNewOwner}
      />

      {/* First Delete Confirmation Modal */}
      <ActionModal
        visible={confirmDeleteModal}
        type="delete"
        title="Delete Car Owner"
        message={`Are you sure you want to delete "${selectedOwner?.name}"?`}
        confirmText="Continue"
        cancelText="Cancel"
        onClose={() => {
          setConfirmDeleteModal(false);
          setSelectedOwner(null);
        }}
        onConfirm={proceedToDelete}
      />

      {/* Final Delete Confirmation Modal */}
      <ActionModal
        visible={deleteModalVisible}
        type="delete"
        title="Final Confirmation"
        message={`This action cannot be undone. Are you absolutely sure you want to delete "${selectedOwner?.name}"?`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        onClose={() => {
          setDeleteModalVisible(false);
          setSelectedOwner(null);
        }}
        onConfirm={confirmDeleteOwner}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fcfcfc',
  },
  listContent: {
    paddingBottom: 20,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 25,
    marginTop: 8,
    paddingVertical: 16,
  },
  headerContent: {
    flex: 1,
    backgroundColor: "#fcfcfc",
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
  statsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
  },
  statsRow: {
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
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  controlsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  topControlsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  addButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonSmallText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#111827',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterButtonActive: {
    backgroundColor: '#222',
    borderColor: '#222',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: 'white',
  },
  ownerCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ownerCardRentalDen: {
    borderWidth: 2,
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
  },
  mainOwnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 6,
  },
  mainOwnerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d97706',
  },
  ownerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarRentalDen: {
    backgroundColor: '#f59e0b',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
  },
  ownerInfo: {
    flex: 1,
  },
  ownerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  ownerEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    textTransform: 'capitalize',
  },
  ownerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  statRow: {
    alignItems: 'center',
  },
  statAmount: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  ownerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#222',
  },
  deleteButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  modalContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#222',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});