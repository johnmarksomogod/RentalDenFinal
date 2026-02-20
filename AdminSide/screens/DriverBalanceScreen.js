"use strict";
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { bookingsService, firebaseAuth } from "../services/firebaseService";

const fmt = (v) => `₱${parseFloat(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => !d ? "—" : new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

export default function DriverBalanceScreen() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("active"); // active | completed | payments

  const currentUser = firebaseAuth.getCurrentUser();
  const driverName = currentUser?.displayName || currentUser?.email || "";

  const isMine = useCallback((b) => {
    if (!currentUser) return false;
    const myEmail = (currentUser.email || "").toLowerCase().trim();
    const myName  = (currentUser.displayName || "").toLowerCase().trim();
    
    // Check assigned_driver_email first (most reliable)
    if (b.assigned_driver_email && b.assigned_driver_email.toLowerCase().trim() === myEmail) return true;
    
    const assigned = (b.assigned_driver || "").toLowerCase().trim();
    if (!assigned) return false;
    
    // Exact matches
    if (assigned === myEmail) return true;
    if (myName && assigned === myName) return true;
    
    // Partial matches (for cases where only first name or part of name is stored)
    if (myName && assigned.includes(myName)) return true;
    if (myName && myName.includes(assigned)) return true;
    
    // Email format check
    if (assigned.includes("@") && assigned === myEmail) return true;
    
    return false;
  }, [currentUser]);

  const load = useCallback(async () => {
    try {
      const list = typeof bookingsService.listAllWithDetails === "function"
        ? await bookingsService.listAllWithDetails()
        : await bookingsService.listWithDetails();
      setBookings(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("DriverBalance fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const myBookings = bookings.filter(isMine);
  const myCompleted = myBookings.filter((b) => b.status === "completed");
  const myActive = myBookings.filter((b) => ["confirmed", "ongoing", "delivered", "retrieved"].includes(b.status));

  // Payment totals — only what driver collected
  const allMyPayments = myBookings.flatMap((b) =>
    (b.payment_log || []).map((entry) => ({ 
      ...entry, 
      booking_id: b.id, 
      customer_name: b.customer_name, 
      vehicle: `${b.vehicles?.make || ""} ${b.vehicles?.model || ""}`.trim(), 
      booking_status: b.status,
      rental_period: `${fmtDate(b.rental_start_date)} → ${fmtDate(b.rental_end_date)}`
    }))
  ).sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

  const totalCollected = allMyPayments.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  if (loading) {
    return <View style={st.centered}><ActivityIndicator size="large" color="#111827" /></View>;
  }

  return (
    <View style={st.container}>
      <View style={st.header}>
        <Text style={st.title}>My Earnings</Text>
        <Text style={st.subtitle}>Money I collected from my assigned deliveries</Text>
      </View>

      {/* Debug info - only show assigned bookings */}
      {myBookings.length === 0 && bookings.length > 0 && (
        <View style={st.noAssignmentBanner}>
          <Ionicons name="information-circle-outline" size={18} color="#7c3aed" />
          <Text style={st.noAssignmentText}>
            You have no assigned deliveries yet. Total bookings in system: {bookings.length}.
            {"\n"}Contact admin to get deliveries assigned to: <Text style={{ fontWeight: "700" }}>{driverName}</Text>
          </Text>
        </View>
      )}

      {/* Main Balance Card */}
      <View style={st.balanceCard}>
        <Ionicons name="wallet" size={32} color="#059669" />
        <Text style={st.balanceLabel}>Total Collected</Text>
        <Text style={st.balanceValue}>{fmt(totalCollected)}</Text>
        <View style={st.balanceMeta}>
          <View style={st.metaItem}>
            <Text style={st.metaValue}>{myCompleted.length}</Text>
            <Text style={st.metaLabel}>Completed</Text>
          </View>
          <View style={st.metaDivider} />
          <View style={st.metaItem}>
            <Text style={st.metaValue}>{myActive.length}</Text>
            <Text style={st.metaLabel}>Active</Text>
          </View>
          <View style={st.metaDivider} />
          <View style={st.metaItem}>
            <Text style={st.metaValue}>{allMyPayments.length}</Text>
            <Text style={st.metaLabel}>Payments</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={st.tabRow}>
        {[
          { key: "active", label: `Active (${myActive.length})` }, 
          { key: "completed", label: `Done (${myCompleted.length})` }, 
          { key: "payments", label: `All Payments` }
        ].map((t) => (
          <TouchableOpacity key={t.key} style={[st.tab, activeTab === t.key && st.tabActive]} onPress={() => setActiveTab(t.key)}>
            <Text style={[st.tabTxt, activeTab === t.key && st.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

        {/* Active Trips Tab */}
        {activeTab === "active" && (
          myActive.length === 0
            ? <View style={st.empty}>
                <Ionicons name="car-outline" size={48} color="#d1d5db" />
                <Text style={st.emptyTitle}>No Active Deliveries</Text>
                <Text style={st.emptySub}>Your active assignments will appear here</Text>
              </View>
            : myActive.map((b) => {
                const tripPaid = (b.payment_log || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
                return (
                  <View key={b.id} style={st.tripCard}>
                    <View style={[st.tripStatusBar, { 
                      backgroundColor: b.status === "pending" ? "#f59e0b"
                        : b.status === "confirmed" ? "#3b82f6" 
                        : b.status === "ongoing" ? "#8b5cf6" 
                        : b.status === "delivered" ? "#ec4899"
                        : b.status === "retrieved" ? "#06b6d4"
                        : "#10b981" 
                    }]} />
                    <View style={st.tripBody}>
                      <Text style={st.tripCustomer}>{b.customer_name}</Text>
                      <Text style={st.tripVehicle}>{b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</Text>
                      <View style={st.tripRow}>
                        <Ionicons name="calendar-outline" size={12} color="#6b7280" />
                        <Text style={st.tripMeta}>{fmtDate(b.rental_start_date)} → {fmtDate(b.rental_end_date)}</Text>
                      </View>
                      <View style={st.tripRow}>
                        <Ionicons name="location-outline" size={12} color="#db2777" />
                        <Text style={[st.tripMeta, { color: "#db2777" }]} numberOfLines={1}>{b.delivery_address || b.pickup_location || "—"}</Text>
                      </View>
                      {tripPaid > 0 && (
                        <View style={st.collectedBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#059669" />
                          <Text style={st.collectedTxt}>Collected {fmt(tripPaid)}</Text>
                        </View>
                      )}
                    </View>
                    <View style={st.tripRight}>
                      <View style={[st.statusPill, { 
                        backgroundColor: (b.status === "pending" ? "#f59e0b"
                          : b.status === "confirmed" ? "#3b82f6" 
                          : b.status === "ongoing" ? "#8b5cf6" 
                          : b.status === "delivered" ? "#ec4899"
                          : b.status === "retrieved" ? "#06b6d4"
                          : "#10b981") + "20" 
                      }]}>
                        <Text style={[st.statusPillTxt, { 
                          color: b.status === "pending" ? "#f59e0b"
                            : b.status === "confirmed" ? "#3b82f6" 
                            : b.status === "ongoing" ? "#8b5cf6" 
                            : b.status === "delivered" ? "#ec4899"
                            : b.status === "retrieved" ? "#06b6d4"
                            : "#10b981" 
                        }]}>{b.status}</Text>
                      </View>
                      <Text style={st.tripAmount}>{fmt(b.total_price)}</Text>
                      <Text style={st.tripAmountLabel}>rental</Text>
                    </View>
                  </View>
                );
              })
        )}

        {/* Completed Trips Tab */}
        {activeTab === "completed" && (
          myCompleted.length === 0
            ? <View style={st.empty}>
                <Ionicons name="flag-outline" size={48} color="#d1d5db" />
                <Text style={st.emptyTitle}>No Completed Trips</Text>
                <Text style={st.emptySub}>Completed deliveries will appear here</Text>
              </View>
            : myCompleted.map((b) => {
                const tripPaid = (b.payment_log || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
                return (
                  <View key={b.id} style={st.completedCard}>
                    <View style={st.completedHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={st.completedCustomer}>{b.customer_name}</Text>
                        <Text style={st.completedVehicle}>{b.vehicles?.year} {b.vehicles?.make} {b.vehicles?.model}</Text>
                      </View>
                      <View style={st.completedEarning}>
                        <Text style={st.completedEarningLabel}>I Collected</Text>
                        <Text style={st.completedEarningValue}>{fmt(tripPaid)}</Text>
                      </View>
                    </View>
                    
                    <View style={st.completedMeta}>
                      <View style={st.metaRow}>
                        <Ionicons name="calendar-outline" size={11} color="#9ca3af" />
                        <Text style={st.metaText}>{fmtDate(b.rental_start_date)}</Text>
                      </View>
                      <View style={st.metaRow}>
                        <Ionicons name="location-outline" size={11} color="#9ca3af" />
                        <Text style={st.metaText} numberOfLines={1}>{b.delivery_address || b.pickup_location || "—"}</Text>
                      </View>
                    </View>

                    {/* Breakdown of what I collected */}
                    {b.payment_log && b.payment_log.length > 0 && (
                      <View style={st.breakdown}>
                        <Text style={st.breakdownTitle}>Payment Breakdown:</Text>
                        {b.payment_log.map((e, i) => (
                          <View key={i} style={st.breakdownRow}>
                            <Text style={st.breakdownLabel}>{e.event}</Text>
                            <Text style={st.breakdownValue}>{fmt(e.amount)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
        )}

        {/* All Payments Tab */}
        {activeTab === "payments" && (
          allMyPayments.length === 0
            ? <View style={st.empty}>
                <Ionicons name="cash-outline" size={48} color="#d1d5db" />
                <Text style={st.emptyTitle}>No Payments Recorded</Text>
                <Text style={st.emptySub}>Payments you collect will appear here</Text>
              </View>
            : allMyPayments.map((entry, i) => (
                <View key={i} style={st.paymentCard}>
                  <View style={st.paymentIcon}>
                    <Ionicons name="cash" size={20} color="#059669" />
                  </View>
                  <View style={st.paymentInfo}>
                    <Text style={st.paymentEvent}>{entry.event}</Text>
                    <Text style={st.paymentCustomer}>{entry.customer_name} · {entry.vehicle}</Text>
                    <Text style={st.paymentPeriod}>{entry.rental_period}</Text>
                    <Text style={st.paymentTime}>
                      {entry.recorded_at ? new Date(entry.recorded_at).toLocaleString("en-PH", { 
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" 
                      }) : "—"}
                    </Text>
                  </View>
                  <View style={st.paymentRight}>
                    <Text style={st.paymentAmount}>{fmt(entry.amount)}</Text>
                    <View style={[st.paymentStatusPill, { 
                      backgroundColor: entry.booking_status === "completed" ? "#f0fdf4" : "#fef3c7" 
                    }]}>
                      <Text style={[st.paymentStatusTxt, { 
                        color: entry.booking_status === "completed" ? "#059669" : "#d97706" 
                      }]}>
                        {entry.booking_status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { padding: 20, paddingTop: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  title: { fontSize: 24, fontWeight: "800", color: "#111827" },
  subtitle: { fontSize: 13, color: "#6b7280", marginTop: 4 },
  
  noAssignmentBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginHorizontal: 16, marginTop: 16, backgroundColor: "#faf5ff", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#e9d5ff" },
  noAssignmentText: { flex: 1, fontSize: 12, color: "#6b21a8", lineHeight: 18 },
  
  balanceCard: { margin: 16, backgroundColor: "#fff", borderRadius: 16, padding: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 4 },
  balanceLabel: { fontSize: 13, color: "#6b7280", fontWeight: "600", marginTop: 12 },
  balanceValue: { fontSize: 36, fontWeight: "900", color: "#059669", marginTop: 4 },
  balanceMeta: { flexDirection: "row", marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: "#f3f4f6", width: "100%" },
  metaItem: { flex: 1, alignItems: "center" },
  metaValue: { fontSize: 20, fontWeight: "800", color: "#111827" },
  metaLabel: { fontSize: 11, color: "#9ca3af", marginTop: 4 },
  metaDivider: { width: 1, backgroundColor: "#e5e7eb", marginHorizontal: 8 },
  
  tabRow: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, backgroundColor: "#f3f4f6", borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabTxt: { fontSize: 11, fontWeight: "600", color: "#6b7280" },
  tabTxtActive: { color: "#111827" },
  
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 40 },
  
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151", marginTop: 12 },
  emptySub: { fontSize: 13, color: "#9ca3af", marginTop: 4, textAlign: "center" },
  
  tripCard: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, marginBottom: 10, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  tripStatusBar: { width: 4 },
  tripBody: { flex: 1, padding: 12 },
  tripCustomer: { fontSize: 15, fontWeight: "700", color: "#111827" },
  tripVehicle: { fontSize: 13, color: "#374151", marginTop: 2, marginBottom: 4 },
  tripRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  tripMeta: { fontSize: 12, color: "#6b7280", flex: 1 },
  collectedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f0fdf4", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start", marginTop: 6 },
  collectedTxt: { fontSize: 11, color: "#059669", fontWeight: "700" },
  tripRight: { alignItems: "flex-end", padding: 12, justifyContent: "center", gap: 6 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusPillTxt: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  tripAmount: { fontSize: 15, fontWeight: "800", color: "#111827" },
  tripAmountLabel: { fontSize: 10, color: "#9ca3af", fontWeight: "500" },
  
  completedCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  completedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  completedCustomer: { fontSize: 15, fontWeight: "700", color: "#111827" },
  completedVehicle: { fontSize: 13, color: "#374151", marginTop: 2 },
  completedEarning: { alignItems: "flex-end" },
  completedEarningLabel: { fontSize: 10, color: "#9ca3af", fontWeight: "600", textTransform: "uppercase" },
  completedEarningValue: { fontSize: 18, fontWeight: "900", color: "#059669", marginTop: 2 },
  completedMeta: { gap: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, color: "#6b7280", flex: 1 },
  breakdown: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  breakdownTitle: { fontSize: 11, fontWeight: "700", color: "#6b7280", marginBottom: 6, textTransform: "uppercase" },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  breakdownLabel: { fontSize: 12, color: "#374151" },
  breakdownValue: { fontSize: 12, fontWeight: "700", color: "#059669" },
  
  paymentCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  paymentIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#dcfce7", justifyContent: "center", alignItems: "center" },
  paymentInfo: { flex: 1 },
  paymentEvent: { fontSize: 14, fontWeight: "600", color: "#111827" },
  paymentCustomer: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  paymentPeriod: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  paymentTime: { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  paymentRight: { alignItems: "flex-end", gap: 6 },
  paymentAmount: { fontSize: 16, fontWeight: "800", color: "#059669" },
  paymentStatusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  paymentStatusTxt: { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
});