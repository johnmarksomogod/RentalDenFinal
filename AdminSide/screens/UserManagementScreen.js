"use strict";

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { appUsersService, firebaseAuth, bookingsService } from "../services/firebaseService";
import ActionModal from "../components/AlertModal/ActionModal";

const ROLES = [
  { label: "Admin", value: "admin" },
  { label: "Driver", value: "driver" },
];
const STATUSES = [
  { label: "Active", value: "active" },
  { label: "Disabled", value: "disabled" },
];

const fmt = (v) => `₱${parseFloat(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

export default function UserManagementScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    contact_number: "",
    password: "",
    role: "admin",
    status: "active",
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: "success", message: "" });
  const [activeTab, setActiveTab] = useState("drivers"); // drivers | admins | overview
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [driverDetailsModal, setDriverDetailsModal] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersList, bookingsList] = await Promise.all([
        appUsersService.listByOwner(),
        typeof bookingsService.listAllWithDetails === "function"
          ? bookingsService.listAllWithDetails()
          : bookingsService.listWithDetails(),
      ]);
      setUsers(usersList || []);
      setBookings(Array.isArray(bookingsList) ? bookingsList : []);
    } catch (e) {
      console.error(e);
      setFeedback({ visible: true, type: "error", message: e?.message || "Failed to load data" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAdd = () => {
    setEditingUser(null);
    setForm({
      full_name: "",
      email: "",
      contact_number: "",
      password: "",
      role: "admin",
      status: "active",
    });
    setModalVisible(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setForm({
      full_name: u.full_name || "",
      email: u.email || "",
      contact_number: u.contact_number || "",
      password: "",
      role: u.role || "admin",
      status: u.status || "active",
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.full_name?.trim() || !form.email?.trim()) {
      Alert.alert("Error", "Full name and email are required.");
      return;
    }
    if (!editingUser && !form.password?.trim()) {
      Alert.alert("Error", "Password is required for new users.");
      return;
    }

    setSubmitLoading(true);

    try {
      if (editingUser) {
        await appUsersService.update(editingUser.id, {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          contact_number: form.contact_number?.trim() || null,
          status: form.status,
        });
        setFeedback({ visible: true, type: "success", message: "User updated." });
      } else {
        await appUsersService.create({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          contact_number: form.contact_number?.trim() || null,
          password: form.password,
          role: form.role,
          status: form.status,
        });
        setFeedback({ visible: true, type: "success", message: "User created successfully." });
      }

      setModalVisible(false);
      loadData();
    } catch (e) {
      setFeedback({ visible: true, type: "error", message: e?.message || "Failed to save" });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleResetPassword = (u) => {
    Alert.alert("Reset Password", `Send password reset email to ${u.email}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send",
        onPress: async () => {
          try {
            await firebaseAuth.resetPasswordForEmail(u.email);
            setFeedback({ visible: true, type: "success", message: "Reset email sent." });
          } catch (e) {
            setFeedback({ visible: true, type: "error", message: e?.message || "Failed to send" });
          }
        },
      },
    ]);
  };

  // ── Calculate driver stats ───────────────────────────────────────────────
  const getDriverStats = (driver) => {
    const driverEmail = (driver.email || "").toLowerCase().trim();
    const driverName = (driver.full_name || "").toLowerCase().trim();

    const driverBookings = bookings.filter((b) => {
      const assignedEmail = (b.assigned_driver_email || "").toLowerCase().trim();
      const assignedName = (b.assigned_driver || "").toLowerCase().trim();
      return (
        assignedEmail === driverEmail ||
        assignedName === driverName ||
        assignedName.includes(driverName) ||
        driverName.includes(assignedName)
      );
    });

    const active = driverBookings.filter((b) =>
      ["confirmed", "ongoing", "delivered", "retrieved"].includes(b.status)
    );
    const completed = driverBookings.filter((b) => b.status === "completed");
    const totalCollected = driverBookings.reduce(
      (sum, b) => sum + (b.payment_log || []).reduce((s, e) => s + (Number(e.amount) || 0), 0),
      0
    );

    return {
      total: driverBookings.length,
      active: active.length,
      completed: completed.length,
      collected: totalCollected,
      bookings: driverBookings,
    };
  };

  const openDriverDetails = (driver) => {
    setSelectedDriver(driver);
    setDriverDetailsModal(true);
  };

  // ── Overall Stats ─────────────────────────────────────────────────────────
  const drivers = users.filter((u) => u.role === "driver" && u.role !== "owner");
  const admins = users.filter((u) => u.role === "admin" && u.role !== "owner");
  const activeDrivers = drivers.filter((d) => d.status === "active");
  
  const totalDriverEarnings = drivers.reduce((sum, d) => sum + getDriverStats(d).collected, 0);
  const allDeliveryBookings = bookings.filter((b) =>
    b.delivery_option === "deliver" || ["ongoing", "delivered", "retrieved", "completed"].includes(b.status)
  );
  const completedDeliveries = allDeliveryBookings.filter((b) => b.status === "completed");

  // ── Admin/Driver Card ─────────────────────────────────────────────────────
  const renderUserCard = ({ item }) => {
    const isDriver = item.role === "driver";
    const stats = isDriver ? getDriverStats(item) : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={isDriver ? () => openDriverDetails(item) : undefined}
        activeOpacity={isDriver ? 0.7 : 1}
      >
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{item.full_name || item.email}</Text>
            <Text style={styles.cardEmail}>{item.email}</Text>
            {item.contact_number ? <Text style={styles.cardContact}>{item.contact_number}</Text> : null}
          </View>
          <View style={styles.badges}>
            <View style={[styles.badge, item.role === "admin" ? styles.badgeAdmin : styles.badgeDriver]}>
              <Text style={styles.badgeText}>{item.role}</Text>
            </View>
            <View style={[styles.badge, item.status === "active" ? styles.badgeActive : styles.badgeDisabled]}>
              <Text style={styles.badgeText}>{item.status}</Text>
            </View>
          </View>
        </View>

        {isDriver && stats && (
          <View style={styles.driverStats}>
            <View style={styles.statBox}>
              <Ionicons name="car" size={16} color="#3b82f6" />
              <Text style={styles.statValue}>{stats.active}</Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.statValue}>{stats.completed}</Text>
              <Text style={styles.statLabel}>Done</Text>
            </View>
            <View style={styles.statBox}>
              <Ionicons name="wallet" size={16} color="#059669" />
              <Text style={[styles.statValue, { color: "#059669" }]}>{fmt(stats.collected)}</Text>
              <Text style={styles.statLabel}>Collected</Text>
            </View>
          </View>
        )}

        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.cardBtn} onPress={() => openEdit(item)}>
            <Ionicons name="pencil" size={16} color="#374151" />
            <Text style={styles.cardBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cardBtn} onPress={() => handleResetPassword(item)}>
            <Ionicons name="key" size={16} color="#374151" />
            <Text style={styles.cardBtnText}>Reset Password</Text>
          </TouchableOpacity>
          {isDriver && (
            <TouchableOpacity style={[styles.cardBtn, styles.cardBtnPrimary]} onPress={() => openDriverDetails(item)}>
              <Ionicons name="stats-chart" size={16} color="#fff" />
              <Text style={[styles.cardBtnText, { color: "#fff" }]}>View Details</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Driver Details Modal ──────────────────────────────────────────────────
  const DriverDetailsModal = () => {
    if (!selectedDriver) return null;
    const stats = getDriverStats(selectedDriver);

    return (
      <Modal visible={driverDetailsModal} animationType="slide" transparent>
        <View style={styles.detailsOverlay}>
          <View style={styles.detailsModal}>
            <View style={styles.detailsHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailsTitle}>{selectedDriver.full_name}</Text>
                <Text style={styles.detailsSubtitle}>{selectedDriver.email}</Text>
              </View>
              <TouchableOpacity onPress={() => setDriverDetailsModal(false)}>
                <Ionicons name="close" size={28} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.detailsStatsRow}>
              <View style={styles.detailsStatCard}>
                <Text style={styles.detailsStatValue}>{stats.total}</Text>
                <Text style={styles.detailsStatLabel}>Total Deliveries</Text>
              </View>
              <View style={styles.detailsStatCard}>
                <Text style={[styles.detailsStatValue, { color: "#3b82f6" }]}>{stats.active}</Text>
                <Text style={styles.detailsStatLabel}>Active</Text>
              </View>
              <View style={styles.detailsStatCard}>
                <Text style={[styles.detailsStatValue, { color: "#10b981" }]}>{stats.completed}</Text>
                <Text style={styles.detailsStatLabel}>Completed</Text>
              </View>
            </View>

            <View style={styles.earningsBox}>
              <Ionicons name="wallet" size={24} color="#059669" />
              <Text style={styles.earningsLabel}>Total Collected</Text>
              <Text style={styles.earningsValue}>{fmt(stats.collected)}</Text>
            </View>

            <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>Assigned Deliveries</Text>
              
              {stats.bookings.length === 0 ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="car-outline" size={48} color="#d1d5db" />
                  <Text style={styles.emptyText}>No deliveries assigned yet</Text>
                </View>
              ) : (
                stats.bookings
                  .sort((a, b) => {
                    const order = { confirmed: 0, ongoing: 1, delivered: 2, retrieved: 3, completed: 4 };
                    return (order[a.status] || 5) - (order[b.status] || 5);
                  })
                  .map((booking) => {
                    const collected = (booking.payment_log || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
                    const status = booking.status || 'pending';
                    const statusColor = {
                      confirmed: '#f59e0b',
                      ongoing: '#3b82f6',
                      delivered: '#8b5cf6',
                      retrieved: '#10b981',
                      completed: '#6b7280',
                      pending: '#9ca3af',
                      cancelled: '#ef4444',
                      declined: '#ef4444',
                    }[status] || '#6b7280';
                    const vehicleLine = [booking.vehicles?.year, booking.vehicles?.make, booking.vehicles?.model].filter(Boolean).join(' ');
                    const plate = booking.vehicle_variants?.plate_number;

                    return (
                      <View key={booking.id} style={[styles.bookingCard, { borderLeftColor: statusColor }]}>
                        {/* Header with avatar and status */}
                        <View style={styles.bookingHeader}>
                          <View style={styles.bookingAvatar}>
                            <Text style={styles.bookingAvatarText}>
                              {(booking.customer_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.bookingCustomerName}>{booking.customer_name}</Text>
                            {vehicleLine ? <Text style={styles.bookingVehicle}>{vehicleLine}</Text> : null}
                          </View>
                          <View style={[styles.bookingStatusPill, { backgroundColor: statusColor + '22' }]}>
                            <Text style={[styles.bookingStatusText, { color: statusColor }]}>{status}</Text>
                          </View>
                        </View>

                        {/* Pills row */}
                        <View style={styles.bookingPillRow}>
                          {plate && (
                            <View style={styles.bookingPill}>
                              <Ionicons name="car-outline" size={11} color="#374151" />
                              <Text style={styles.bookingPillText}>{plate}</Text>
                            </View>
                          )}
                          {booking.license_number && (
                            <View style={styles.bookingPill}>
                              <Ionicons name="id-card-outline" size={11} color="#6b7280" />
                              <Text style={styles.bookingPillText}>Lic: {booking.license_number}</Text>
                            </View>
                          )}
                          {booking.vehicle_variants?.color && (
                            <View style={styles.bookingPill}>
                              <Ionicons name="color-palette-outline" size={11} color="#6b7280" />
                              <Text style={styles.bookingPillText}>{booking.vehicle_variants.color}</Text>
                            </View>
                          )}
                        </View>

                        {/* Info rows */}
                        <View style={styles.bookingInfoRow}>
                          <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
                          <Text style={styles.bookingInfoText}>
                            {new Date(booking.rental_start_date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} → {new Date(booking.rental_end_date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                          </Text>
                        </View>

                        {(booking.delivery_address || booking.pickup_location) && (
                          <View style={styles.bookingInfoRow}>
                            <Ionicons name="location-outline" size={13} color="#db2777" />
                            <Text style={[styles.bookingInfoText, { color: '#db2777' }]} numberOfLines={1}>
                              {booking.delivery_address || booking.pickup_location}
                            </Text>
                          </View>
                        )}

                        <View style={styles.bookingInfoRow}>
                          <Ionicons name="cash-outline" size={13} color="#9ca3af" />
                          <Text style={styles.bookingInfoText}>{fmt(booking.total_price)}</Text>
                        </View>

                        {/* Charge pills */}
                        {(booking.fuel_charge > 0 || booking.delay_charge > 0 || booking.damage_fee > 0) && (
                          <View style={styles.bookingChargePills}>
                            {booking.fuel_charge > 0 && (
                              <View style={styles.bookingChargePill}>
                                <Text style={styles.bookingChargePillText}>⛽ {fmt(booking.fuel_charge)}</Text>
                              </View>
                            )}
                            {booking.delay_charge > 0 && (
                              <View style={[styles.bookingChargePill, { backgroundColor: '#fce7f3' }]}>
                                <Text style={[styles.bookingChargePillText, { color: '#db2777' }]}>⏰ {fmt(booking.delay_charge)}</Text>
                              </View>
                            )}
                            {booking.damage_fee > 0 && (
                              <View style={[styles.bookingChargePill, { backgroundColor: '#fee2e2' }]}>
                                <Text style={[styles.bookingChargePillText, { color: '#b91c1c' }]}>🔧 {fmt(booking.damage_fee)}</Text>
                              </View>
                            )}
                          </View>
                        )}

                        {/* Payment breakdown */}
                        {booking.payment_log && booking.payment_log.length > 0 && (
                          <View style={styles.paymentBreakdown}>
                            <Text style={styles.breakdownTitle}>Payment Breakdown:</Text>
                            {booking.payment_log.map((p, i) => (
                              <View key={i} style={styles.breakdownRow}>
                                <Text style={styles.breakdownLabel}>{p.event}</Text>
                                <Text style={styles.breakdownValue}>{fmt(p.amount)}</Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {/* Total collected */}
                        {collected > 0 && (
                          <View style={styles.bookingTotalCollected}>
                            <Text style={styles.bookingTotalLabel}>Total Collected</Text>
                            <Text style={styles.bookingTotalValue}>{fmt(collected)}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Overview Tab ──────────────────────────────────────────────────────────
  const renderOverview = () => (
    <ScrollView
      style={styles.overviewScroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
    >
      <View style={styles.overviewSection}>
        <Text style={styles.overviewTitle}>System Overview</Text>

        <View style={styles.overviewGrid}>
          <View style={styles.overviewCard}>
            <Ionicons name="people" size={28} color="#3b82f6" />
            <Text style={styles.overviewValue}>{drivers.length}</Text>
            <Text style={styles.overviewLabel}>Total Drivers</Text>
            <Text style={styles.overviewMeta}>{activeDrivers.length} active</Text>
          </View>

          <View style={styles.overviewCard}>
            <Ionicons name="shield-checkmark" size={28} color="#8b5cf6" />
            <Text style={styles.overviewValue}>{admins.length}</Text>
            <Text style={styles.overviewLabel}>Admins</Text>
          </View>

          <View style={styles.overviewCard}>
            <Ionicons name="car" size={28} color="#f59e0b" />
            <Text style={styles.overviewValue}>{allDeliveryBookings.length}</Text>
            <Text style={styles.overviewLabel}>All Deliveries</Text>
            <Text style={styles.overviewMeta}>{completedDeliveries.length} done</Text>
          </View>

          <View style={styles.overviewCard}>
            <Ionicons name="wallet" size={28} color="#059669" />
            <Text style={[styles.overviewValue, { color: "#059669" }]}>{fmt(totalDriverEarnings)}</Text>
            <Text style={styles.overviewLabel}>Total Collected</Text>
            <Text style={styles.overviewMeta}>by all drivers</Text>
          </View>
        </View>
      </View>

      {/* Top Performing Drivers */}
      <View style={styles.overviewSection}>
        <Text style={styles.overviewTitle}>Top Performing Drivers</Text>
        {drivers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>No drivers yet</Text>
          </View>
        ) : (
          drivers
            .map((d) => ({ ...d, stats: getDriverStats(d) }))
            .sort((a, b) => b.stats.collected - a.stats.collected)
            .slice(0, 5)
            .map((driver, index) => (
              <TouchableOpacity
                key={driver.id}
                style={styles.topDriverCard}
                onPress={() => openDriverDetails(driver)}
              >
                <View style={styles.topDriverRank}>
                  <Text style={styles.topDriverRankText}>#{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topDriverName}>{driver.full_name}</Text>
                  <Text style={styles.topDriverMeta}>
                    {driver.stats.completed} completed · {driver.stats.active} active
                  </Text>
                </View>
                <View style={styles.topDriverEarnings}>
                  <Text style={styles.topDriverAmount}>{fmt(driver.stats.collected)}</Text>
                  <Text style={styles.topDriverLabel}>collected</Text>
                </View>
              </TouchableOpacity>
            ))
        )}
      </View>

      {/* Top Clients / Repeat Customers */}
      <View style={styles.overviewSection}>
        <Text style={styles.overviewTitle}>Top Clients & Repeat Customers</Text>
        {(() => {
          // Group bookings by customer
          const customerMap = {};
          bookings.forEach((b) => {
            const key = b.customer_email?.toLowerCase() || b.customer_name?.toLowerCase() || 'unknown';
            if (!customerMap[key]) {
              customerMap[key] = {
                name: b.customer_name || 'Unknown',
                email: b.customer_email || '',
                phone: b.customer_phone || '',
                bookings: [],
                totalSpent: 0,
                completedCount: 0,
              };
            }
            customerMap[key].bookings.push(b);
            customerMap[key].totalSpent += Number(b.total_price) || 0;
            if (b.status === 'completed') customerMap[key].completedCount++;
          });

          const topClients = Object.values(customerMap)
            .filter(c => c.bookings.length > 0)
            .sort((a, b) => {
              // Sort by: 1) number of bookings, 2) total spent
              if (b.bookings.length !== a.bookings.length) {
                return b.bookings.length - a.bookings.length;
              }
              return b.totalSpent - a.totalSpent;
            })
            .slice(0, 10);

          return topClients.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No bookings yet</Text>
            </View>
          ) : (
            topClients.map((client, index) => {
              const isRepeat = client.bookings.length > 1;
              const activeBookings = client.bookings.filter(b => 
                ['pending', 'confirmed', 'ongoing', 'delivered', 'retrieved'].includes(b.status)
              );
              
              return (
                <View key={index} style={styles.clientCard}>
                  <View style={styles.clientHeader}>
                    <View style={styles.clientRank}>
                      <Text style={styles.clientRankText}>#{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.clientName}>{client.name}</Text>
                        {isRepeat && (
                          <View style={styles.repeatBadge}>
                            <Ionicons name="repeat" size={10} color="#7c3aed" />
                            <Text style={styles.repeatBadgeText}>REPEAT</Text>
                          </View>
                        )}
                      </View>
                      {client.email ? <Text style={styles.clientEmail}>{client.email}</Text> : null}
                      {client.phone ? <Text style={styles.clientPhone}>{client.phone}</Text> : null}
                    </View>
                  </View>

                  <View style={styles.clientStats}>
                    <View style={styles.clientStatBox}>
                      <Ionicons name="calendar" size={16} color="#3b82f6" />
                      <Text style={styles.clientStatValue}>{client.bookings.length}</Text>
                      <Text style={styles.clientStatLabel}>
                        {client.bookings.length === 1 ? 'Booking' : 'Bookings'}
                      </Text>
                    </View>
                    <View style={styles.clientStatBox}>
                      <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                      <Text style={styles.clientStatValue}>{client.completedCount}</Text>
                      <Text style={styles.clientStatLabel}>Completed</Text>
                    </View>
                    <View style={styles.clientStatBox}>
                      <Ionicons name="cash" size={16} color="#059669" />
                      <Text style={[styles.clientStatValue, { color: '#059669' }]}>
                        {fmt(client.totalSpent)}
                      </Text>
                      <Text style={styles.clientStatLabel}>Total Spent</Text>
                    </View>
                  </View>

                  {activeBookings.length > 0 && (
                    <View style={styles.activeBookingBadge}>
                      <Ionicons name="time" size={12} color="#d97706" />
                      <Text style={styles.activeBookingText}>
                        {activeBookings.length} active {activeBookings.length === 1 ? 'booking' : 'bookings'}
                      </Text>
                    </View>
                  )}

                  {/* Recent bookings as full cards */}
                  {client.bookings.length > 0 && (
                    <View style={styles.recentBookings}>
                      <Text style={styles.recentBookingsTitle}>Recent Rentals:</Text>
                      {client.bookings
                        .sort((a, b) => new Date(b.created_at || b.rental_start_date) - new Date(a.created_at || a.rental_start_date))
                        .slice(0, 3)
                        .map((booking, idx) => {
                          const status = booking.status || 'pending';
                          const statusColor = {
                            pending:   '#f59e0b', // Amber
                            confirmed: '#3b82f6', // Blue
                            ongoing:   '#8b5cf6', // Purple
                            delivered: '#ec4899', // Pink
                            retrieved: '#06b6d4', // Cyan
                            completed: '#10b981', // Green ✓
                            cancelled: '#ef4444', // Red
                            declined:  '#f97316', // Orange
                          }[status] || '#6b7280';
                          const vehicleLine = [booking.vehicles?.year, booking.vehicles?.make, booking.vehicles?.model].filter(Boolean).join(' ');
                          const plate = booking.vehicle_variants?.plate_number;
                          const collected = (booking.payment_log || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);

                          return (
                            <View key={idx} style={[styles.miniBookingCard, { borderLeftColor: statusColor }]}>
                              {/* Compact header */}
                              <View style={styles.miniBookingHeader}>
                                <View style={{ flex: 1 }}>
                                  {vehicleLine ? <Text style={styles.miniBookingVehicle}>{vehicleLine}</Text> : null}
                                  <View style={styles.miniBookingPillRow}>
                                    {plate && (
                                      <View style={styles.miniBookingPill}>
                                        <Ionicons name="car-outline" size={10} color="#374151" />
                                        <Text style={styles.miniBookingPillText}>{plate}</Text>
                                      </View>
                                    )}
                                    {booking.license_number && (
                                      <View style={styles.miniBookingPill}>
                                        <Ionicons name="id-card-outline" size={10} color="#6b7280" />
                                        <Text style={styles.miniBookingPillText}>{booking.license_number}</Text>
                                      </View>
                                    )}
                                  </View>
                                </View>
                                <View style={[styles.miniBookingStatusPill, { backgroundColor: statusColor + '22' }]}>
                                  <Text style={[styles.miniBookingStatusText, { color: statusColor }]}>{status}</Text>
                                </View>
                              </View>

                              {/* Info rows */}
                              <View style={styles.miniBookingInfoRow}>
                                <Ionicons name="calendar-outline" size={11} color="#9ca3af" />
                                <Text style={styles.miniBookingInfoText}>
                                  {new Date(booking.rental_start_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: '2-digit' })}
                                  {booking.rental_end_date && ` → ${new Date(booking.rental_end_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`}
                                </Text>
                              </View>

                              {(booking.delivery_address || booking.pickup_location) && (
                                <View style={styles.miniBookingInfoRow}>
                                  <Ionicons name="location-outline" size={11} color="#db2777" />
                                  <Text style={[styles.miniBookingInfoText, { color: '#db2777' }]} numberOfLines={1}>
                                    {booking.delivery_address || booking.pickup_location}
                                  </Text>
                                </View>
                              )}

                              <View style={styles.miniBookingInfoRow}>
                                <Ionicons name="cash-outline" size={11} color="#9ca3af" />
                                <Text style={styles.miniBookingInfoText}>{fmt(booking.total_price)}</Text>
                              </View>

                              {/* Collected badge if payment exists */}
                              {collected > 0 && (
                                <View style={styles.miniCollectedBox}>
                                  <Ionicons name="checkmark-circle" size={11} color="#059669" />
                                  <Text style={styles.miniCollectedText}>Collected: {fmt(collected)}</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      {client.bookings.length > 3 && (
                        <Text style={styles.moreBookings}>
                          + {client.bookings.length - 3} more {client.bookings.length - 3 === 1 ? 'rental' : 'rentals'}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          );
        })()}
      </View>

      {/* Unassigned Deliveries Alert */}
      {(() => {
        const unassigned = allDeliveryBookings.filter(
          (b) => !b.assigned_driver && ["confirmed", "ongoing", "delivered"].includes(b.status)
        );
        return unassigned.length > 0 ? (
          <View style={styles.alertBox}>
            <Ionicons name="warning" size={24} color="#d97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>⚠️ {unassigned.length} Unassigned Deliveries</Text>
              <Text style={styles.alertText}>
                Some deliveries need driver assignment. Go to Bookings → Deliveries tab to assign.
              </Text>
            </View>
          </View>
        ) : null;
      })()}
    </ScrollView>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>User Management</Text>
        <Text style={styles.subtitle}>Manage team members & view driver performance</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add User</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: "#374151" }]}
            onPress={() => navigation.navigate("SystemSettings")}
          >
            <Ionicons name="settings" size={20} color="#fff" />
            <Text style={styles.addBtnText}>System Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {[
          { key: "overview", label: "Overview", icon: "analytics" },
          { key: "drivers", label: `Drivers (${drivers.length})`, icon: "car" },
          { key: "admins", label: `Admins (${admins.length})`, icon: "shield-checkmark" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons name={tab.icon} size={18} color={activeTab === tab.key ? "#111827" : "#6b7280"} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "overview" ? (
        renderOverview()
      ) : (
        <FlatList
          data={activeTab === "drivers" ? drivers : admins}
          keyExtractor={(item) => item.id}
          renderItem={renderUserCard}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name={activeTab === "drivers" ? "car-outline" : "shield-outline"} size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No {activeTab} yet</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit User Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{editingUser ? "Edit User" : "Add User"}</Text>
            <ScrollView style={styles.form}>
              <Text style={styles.label}>Full name *</Text>
              <TextInput
                style={styles.input}
                value={form.full_name}
                onChangeText={(t) => setForm({ ...form, full_name: t })}
                placeholder="Full name"
                placeholderTextColor="#9ca3af"
              />
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={[styles.input, editingUser && styles.inputDisabled]}
                value={form.email}
                onChangeText={(t) => setForm({ ...form, email: t })}
                placeholder="email@example.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                editable={!editingUser}
              />
              <Text style={styles.label}>Contact number</Text>
              <TextInput
                style={styles.input}
                value={form.contact_number}
                onChangeText={(t) => setForm({ ...form, contact_number: t })}
                placeholder="+63..."
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
              />
              {!editingUser && (
                <>
                  <Text style={styles.label}>Password *</Text>
                  <TextInput
                    style={styles.input}
                    value={form.password}
                    onChangeText={(t) => setForm({ ...form, password: t })}
                    placeholder="Min 6 characters"
                    placeholderTextColor="#9ca3af"
                    secureTextEntry
                  />
                </>
              )}
              <Text style={styles.label}>Role</Text>
              <View style={styles.roleRow}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.roleBtn, form.role === r.value && styles.roleBtnActive]}
                    onPress={() => setForm({ ...form, role: r.value })}
                  >
                    <Text style={[styles.roleBtnText, form.role === r.value && styles.roleBtnTextActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Status</Text>
              <View style={styles.roleRow}>
                {STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s.value}
                    style={[styles.roleBtn, form.status === s.value && styles.roleBtnActive]}
                    onPress={() => setForm({ ...form, status: s.value })}
                  >
                    <Text style={[styles.roleBtnText, form.status === s.value && styles.roleBtnTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={submitLoading}>
                <Text style={styles.saveBtnText}>{submitLoading ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <DriverDetailsModal />

      <ActionModal
        visible={feedback.visible}
        type={feedback.type}
        title={feedback.type === "success" ? "Success" : "Error"}
        message={feedback.message}
        confirmText="OK"
        onClose={() => setFeedback({ ...feedback, visible: false })}
        onConfirm={() => setFeedback({ ...feedback, visible: false })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 20, paddingTop: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  title: { fontSize: 24, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  
  tabBar: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: "#111827" },
  tabText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#111827" },
  
  list: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  badges: { flexDirection: "row", gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeAdmin: { backgroundColor: "#dbeafe" },
  badgeDriver: { backgroundColor: "#d1fae5" },
  badgeActive: { backgroundColor: "#dcfce7" },
  badgeDisabled: { backgroundColor: "#fee2e2" },
  badgeText: { fontSize: 10, fontWeight: "700", color: "#374151", textTransform: "uppercase" },
  cardEmail: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  cardContact: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  
  driverStats: { flexDirection: "row", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6", gap: 8 },
  statBox: { flex: 1, alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 8, padding: 10 },
  statValue: { fontSize: 16, fontWeight: "800", color: "#111827", marginTop: 4 },
  statLabel: { fontSize: 10, color: "#6b7280", marginTop: 2, fontWeight: "500" },
  
  cardActions: { flexDirection: "row", marginTop: 12, gap: 8, flexWrap: "wrap" },
  cardBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#f3f4f6", borderRadius: 8 },
  cardBtnPrimary: { backgroundColor: "#111827" },
  cardBtnText: { fontSize: 12, fontWeight: "600", color: "#374151" },
  
  emptyBox: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 14, color: "#9ca3af", marginTop: 12 },
  
  // Overview
  overviewScroll: { flex: 1 },
  overviewSection: { padding: 16 },
  overviewTitle: { fontSize: 18, fontWeight: "800", color: "#111827", marginBottom: 16 },
  overviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  overviewCard: { flex: 1, minWidth: "45%", backgroundColor: "#fff", borderRadius: 12, padding: 16, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  overviewValue: { fontSize: 24, fontWeight: "900", color: "#111827", marginTop: 8 },
  overviewLabel: { fontSize: 11, color: "#6b7280", marginTop: 4, fontWeight: "600" },
  overviewMeta: { fontSize: 10, color: "#9ca3af", marginTop: 2 },
  
  topDriverCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  topDriverRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", marginRight: 12 },
  topDriverRankText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  topDriverName: { fontSize: 15, fontWeight: "700", color: "#111827" },
  topDriverMeta: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  topDriverEarnings: { alignItems: "flex-end", marginLeft: 12 },
  topDriverAmount: { fontSize: 16, fontWeight: "800", color: "#059669" },
  topDriverLabel: { fontSize: 10, color: "#9ca3af", marginTop: 2 },
  
  // Top Clients
  clientCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  clientHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  clientRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#7c3aed", justifyContent: "center", alignItems: "center", marginRight: 12 },
  clientRankText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  clientName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  clientEmail: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  clientPhone: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  repeatBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#f3e8ff", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  repeatBadgeText: { fontSize: 9, fontWeight: "800", color: "#7c3aed", letterSpacing: 0.5 },
  
  clientStats: { flexDirection: "row", gap: 8, marginBottom: 10 },
  clientStatBox: { flex: 1, alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 8, padding: 10 },
  clientStatValue: { fontSize: 16, fontWeight: "800", color: "#111827", marginTop: 4 },
  clientStatLabel: { fontSize: 10, color: "#6b7280", marginTop: 2, fontWeight: "500", textAlign: "center" },
  
  activeBookingBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fffbeb", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 10 },
  activeBookingText: { fontSize: 11, fontWeight: "700", color: "#d97706" },
  
  recentBookings: { paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  recentBookingsTitle: { fontSize: 11, fontWeight: "700", color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  
  // Mini booking cards for recent rentals
  miniBookingCard: { backgroundColor: "#f9fafb", borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderWidth: 1, borderColor: "#e5e7eb" },
  miniBookingHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  miniBookingVehicle: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 4 },
  miniBookingPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  miniBookingPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fff", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  miniBookingPillText: { fontSize: 10, color: "#374151", fontWeight: "600" },
  miniBookingStatusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  miniBookingStatusText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  miniBookingInfoRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  miniBookingInfoText: { fontSize: 11, color: "#6b7280", flex: 1 },
  miniCollectedBox: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f0fdf4", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start", marginTop: 6 },
  miniCollectedText: { fontSize: 10, fontWeight: "700", color: "#059669" },
  
  recentBookingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  recentBookingText: { flex: 1, fontSize: 12, color: "#374151" },
  recentBookingDate: { fontSize: 11, color: "#9ca3af", fontWeight: "600" },
  moreBookings: { fontSize: 11, color: "#7c3aed", fontWeight: "600", marginTop: 4, fontStyle: "italic" },
  
  alertBox: { flexDirection: "row", alignItems: "flex-start", gap: 12, margin: 16, backgroundColor: "#fffbeb", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#fde68a" },
  alertTitle: { fontSize: 14, fontWeight: "700", color: "#92400e", marginBottom: 4 },
  alertText: { fontSize: 13, color: "#92400e", lineHeight: 18 },
  
  // Driver Details Modal
  detailsOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  detailsModal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", paddingBottom: 20 },
  detailsHeader: { flexDirection: "row", alignItems: "flex-start", padding: 20, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  detailsTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  detailsSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  
  detailsStatsRow: { flexDirection: "row", padding: 16, gap: 12 },
  detailsStatCard: { flex: 1, backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, alignItems: "center" },
  detailsStatValue: { fontSize: 22, fontWeight: "900", color: "#111827" },
  detailsStatLabel: { fontSize: 11, color: "#6b7280", marginTop: 4, fontWeight: "600" },
  
  earningsBox: { alignItems: "center", margin: 16, backgroundColor: "#f0fdf4", borderRadius: 12, padding: 20, borderWidth: 1, borderColor: "#86efac" },
  earningsLabel: { fontSize: 12, color: "#166534", fontWeight: "600", marginTop: 8 },
  earningsValue: { fontSize: 32, fontWeight: "900", color: "#059669", marginTop: 4 },
  
  detailsScroll: { paddingHorizontal: 16, maxHeight: 400 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  
  // Booking cards - matching BookingsScreen style exactly
  bookingCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, borderLeftWidth: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  bookingHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, gap: 10 },
  bookingAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3f4f6", justifyContent: "center", alignItems: "center" },
  bookingAvatarText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  bookingCustomerName: { fontSize: 16, fontWeight: "700", color: "#111827" },
  bookingVehicle: { fontSize: 13, color: "#374151", marginTop: 2 },
  bookingStatusPill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  bookingStatusText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  bookingPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  bookingPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f3f4f6", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  bookingPillText: { fontSize: 11, color: "#374151", fontWeight: "600" },
  bookingInfoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  bookingInfoText: { fontSize: 13, color: "#6b7280", flex: 1 },
  bookingChargePills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  bookingChargePill: { backgroundColor: "#fffbeb", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  bookingChargePillText: { fontSize: 12, fontWeight: "600", color: "#92400e" },
  bookingTotalCollected: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f0fdf4", borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: "#86efac" },
  bookingTotalLabel: { fontSize: 13, fontWeight: "600", color: "#166534" },
  bookingTotalValue: { fontSize: 15, fontWeight: "800", color: "#15803d" },
  
  emptyBox: { alignItems: "center", paddingVertical: 60 },
  emptyText: { fontSize: 14, color: "#9ca3af", marginTop: 12 },
  
  collectedBox: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start", marginTop: 6 },
  collectedText: { fontSize: 12, fontWeight: "700", color: "#059669" },
  
  paymentBreakdown: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  breakdownTitle: { fontSize: 11, fontWeight: "700", color: "#6b7280", marginBottom: 6, textTransform: "uppercase" },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  breakdownLabel: { fontSize: 12, color: "#374151" },
  breakdownValue: { fontSize: 12, fontWeight: "700", color: "#059669" },
  
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modal: { backgroundColor: "#fff", borderRadius: 16, maxHeight: "80%" },
  modalTitle: { fontSize: 18, fontWeight: "700", padding: 20, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  form: { padding: 20, maxHeight: 400 },
  label: { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 6, textTransform: "uppercase" },
  input: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 12, fontSize: 15, marginBottom: 16, color: "#111827" },
  inputDisabled: { backgroundColor: "#f3f4f6", color: "#6b7280" },
  roleRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  roleBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, backgroundColor: "#f3f4f6", alignItems: "center" },
  roleBtnActive: { backgroundColor: "#111827" },
  roleBtnText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  roleBtnTextActive: { color: "#fff" },
  modalActions: { flexDirection: "row", padding: 20, gap: 12, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: "#f3f4f6", alignItems: "center" },
  cancelBtnText: { fontWeight: "600", color: "#374151", fontSize: 15 },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: "#111827", alignItems: "center" },
  saveBtnText: { fontWeight: "600", color: "#fff", fontSize: 15 },
});