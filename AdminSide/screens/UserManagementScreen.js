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
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  appUsersService,
  firebaseAuth,
  bookingsService,
  carOwnersService,
  variantsService,
  vehiclesService,
} from "../services/firebaseService";
import ActionModal from "../components/AlertModal/ActionModal";

// ─── Constants ────────────────────────────────────────────────────────────────

const DRIVER_ROLES  = [{ label: "Driver", value: "driver" }];
const ADMIN_ROLES   = [{ label: "Admin",  value: "admin"  }];
const STATUSES = [
  { label: "Active",   value: "active"   },
  { label: "Disabled", value: "disabled" },
];

const fmt = (v) =>
  `₱${parseFloat(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const fmtDate = (d) =>
  !d ? "—" : new Date(d).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

const STATUS_COLORS = {
  pending:   "#f59e0b",
  confirmed: "#3b82f6",
  ongoing:   "#8b5cf6",
  delivered: "#ec4899",
  retrieved: "#06b6d4",
  completed: "#10b981",
  cancelled: "#ef4444",
  declined:  "#f97316",
};

const getStatusColor = (status) => STATUS_COLORS[status] || "#6b7280";

// ─── Fuel type helpers ────────────────────────────────────────────────────────

const FUEL_CATEGORY_META = {
  gasoline:      { label: "Gasoline",      icon: "flame-outline",  color: "#f59e0b", bg: "#fef3c7" },
  diesel:        { label: "Diesel",         icon: "water-outline",  color: "#0ea5e9", bg: "#e0f2fe" },
  electric:      { label: "Electric",       icon: "flash-outline",  color: "#3b82f6", bg: "#dbeafe" },
  hybrid:        { label: "Hybrid",         icon: "leaf-outline",   color: "#16a34a", bg: "#dcfce7" },
  plugin_hybrid: { label: "Plug-in Hybrid", icon: "leaf-outline",   color: "#059669", bg: "#d1fae5" },
  cng:           { label: "CNG",            icon: "cloud-outline",  color: "#8b5cf6", bg: "#ede9fe" },
  lpg:           { label: "LPG",            icon: "beaker-outline", color: "#f97316", bg: "#ffedd5" },
};

const getFuelMeta = (fuelTypeString) => {
  if (!fuelTypeString) return null;
  const f = fuelTypeString.toLowerCase();
  if (f.includes("electric"))                          return FUEL_CATEGORY_META.electric;
  if (f.includes("plug"))                              return FUEL_CATEGORY_META.plugin_hybrid;
  if (f.includes("hybrid"))                            return FUEL_CATEGORY_META.hybrid;
  if (f.includes("diesel"))                            return FUEL_CATEGORY_META.diesel;
  if (f.includes("cng") || f.includes("compressed"))  return FUEL_CATEGORY_META.cng;
  if (f.includes("lpg") || f.includes("liquefied"))   return FUEL_CATEGORY_META.lpg;
  return FUEL_CATEGORY_META.gasoline;
};

// ─── Driver Status Timeline ───────────────────────────────────────────────────

const DriverStatusTimeline = ({ booking }) => {
  const steps = [
    { key: "confirmed", label: "Confirmed", icon: "checkmark-circle" },
    { key: "ongoing",   label: "Ongoing",   icon: "car"              },
    { key: "delivered", label: "Delivered", icon: "location"         },
    { key: "retrieved", label: "Retrieved", icon: "return-up-back"   },
    { key: "completed", label: "Completed", icon: "flag"             },
  ];
  const statusOrder  = ["confirmed", "ongoing", "delivered", "retrieved", "completed"];
  const currentIndex = statusOrder.indexOf(booking.status);

  return (
    <View style={tlS.container}>
      <Text style={tlS.title}>Delivery Progress</Text>
      <View style={tlS.row}>
        {steps.map((step, index) => {
          const isDone    = currentIndex >= index;
          const isCurrent = currentIndex === index;
          return (
            <View key={step.key} style={tlS.stepCol}>
              {index > 0 && <View style={[tlS.line, isDone && tlS.lineDone]} />}
              <View style={[tlS.dot, isDone && tlS.dotDone, isCurrent && tlS.dotCurrent]}>
                <Ionicons name={step.icon} size={11} color={isDone ? "#fff" : "#9ca3af"} />
              </View>
              <Text
                style={[tlS.label, isDone && tlS.labelDone, isCurrent && tlS.labelCurrent]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
      {booking.assigned_driver && (
        <View style={tlS.driverBadge}>
          <Ionicons name="person-circle-outline" size={14} color="#374151" />
          <Text style={tlS.driverText}>{booking.assigned_driver}</Text>
        </View>
      )}
      {(booking.fuel_charge > 0 || booking.delay_charge > 0) && (
        <View style={tlS.pills}>
          {booking.fuel_charge > 0 && (
            <View style={[tlS.pill, { backgroundColor: "#fef3c7" }]}>
              <Ionicons name="flame-outline" size={11} color="#d97706" />
              <Text style={[tlS.pillTxt, { color: "#d97706" }]}>Fuel {fmt(booking.fuel_charge)}</Text>
            </View>
          )}
          {booking.delay_charge > 0 && (
            <View style={[tlS.pill, { backgroundColor: "#fce7f3" }]}>
              <Ionicons name="time-outline" size={11} color="#db2777" />
              <Text style={[tlS.pillTxt, { color: "#db2777" }]}>Delay {fmt(booking.delay_charge)}</Text>
            </View>
          )}
        </View>
      )}
      {booking.payment_log && booking.payment_log.length > 0 && (
        <View style={tlS.paySection}>
          <Text style={tlS.payTitle}>Payment Log</Text>
          {booking.payment_log.map((e, i) => (
            <View key={i} style={tlS.payRow}>
              <View style={{ flex: 1 }}>
                <Text style={tlS.payEvent}>{e.event}</Text>
                <Text style={tlS.payTime}>
                  {new Date(e.recorded_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              <Text style={tlS.payAmt}>{fmt(e.amount)}</Text>
            </View>
          ))}
          <View style={tlS.payTotal}>
            <Text style={tlS.payTotalL}>Total Collected</Text>
            <Text style={tlS.payTotalV}>
              {fmt(booking.payment_log.reduce((s, e) => s + parseFloat(e.amount || 0), 0))}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const tlS = StyleSheet.create({
  container:    { backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  title:        { fontSize: 11, fontWeight: "700", color: "#374151", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  row:          { flexDirection: "row", alignItems: "flex-start", marginBottom: 6 },
  stepCol:      { flex: 1, alignItems: "center", position: "relative" },
  line:         { position: "absolute", left: "-50%", right: "50%", top: 11, height: 2, backgroundColor: "#e5e7eb", zIndex: 0 },
  lineDone:     { backgroundColor: "#111827" },
  dot:          { width: 24, height: 24, borderRadius: 12, backgroundColor: "#e5e7eb", justifyContent: "center", alignItems: "center", zIndex: 1, marginBottom: 3 },
  dotDone:      { backgroundColor: "#111827" },
  dotCurrent:   { backgroundColor: "#111827", shadowColor: "#111827", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 4 },
  label:        { fontSize: 8, color: "#9ca3af", textAlign: "center", fontWeight: "500" },
  labelDone:    { color: "#374151" },
  labelCurrent: { color: "#111827", fontWeight: "700" },
  driverBadge:  { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start", marginTop: 6 },
  driverText:   { fontSize: 12, color: "#111827", fontWeight: "600" },
  pills:        { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  pill:         { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  pillTxt:      { fontSize: 11, fontWeight: "600" },
  paySection:   { marginTop: 10, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 8 },
  payTitle:     { fontSize: 10, fontWeight: "700", color: "#374151", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 },
  payRow:       { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  payEvent:     { fontSize: 12, color: "#1f2937", fontWeight: "500" },
  payTime:      { fontSize: 10, color: "#9ca3af", marginTop: 1 },
  payAmt:       { fontSize: 12, color: "#059669", fontWeight: "700" },
  payTotal:     { flexDirection: "row", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  payTotalL:    { fontSize: 12, fontWeight: "700", color: "#111827" },
  payTotalV:    { fontSize: 14, fontWeight: "800", color: "#059669" },
});

// ─── Unified Booking Card (matches BookingsScreen) ────────────────────────────

const BookingCard = ({ booking, showTimeline = false }) => {
  const status      = booking.status || "pending";
  const color       = getStatusColor(status);
  const isDelivery  = booking.delivery_option === "deliver" || ["ongoing", "delivered", "retrieved", "completed"].includes(status);
  const plate       = booking.vehicle_variants?.plate_number;
  const vehicleLine = [booking.vehicles?.year, booking.vehicles?.make, booking.vehicles?.model].filter(Boolean).join(" ");
  const totalPaid   = (booking.payment_log || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);

  const fuelType = booking.vehicles?.fuel_type;
  const fuelMeta = fuelType ? getFuelMeta(fuelType) : null;

  const depositAmount    = Number(booking.vehicles?.deposit_amount || booking.deposit_amount || 0);
  const depositCollected = Number(booking.deposit_collected || 0);
  const depositReturned  = !!booking.deposit_returned;
  const showDeposit      = depositAmount > 0;

  const shouldShowTimeline = showTimeline && isDelivery &&
    ["confirmed", "ongoing", "delivered", "retrieved", "completed"].includes(status);

  return (
    <View style={[bcS.card, { borderLeftColor: color }]}>
      {/* Header row */}
      <View style={bcS.head}>
        <View style={bcS.avatar}>
          <Text style={bcS.avatarTxt}>
            {(booking.customer_name || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={bcS.name}>{booking.customer_name || "—"}</Text>
          {vehicleLine ? <Text style={bcS.vehicle}>{vehicleLine}</Text> : null}
        </View>
        <View style={[bcS.statusPill, { backgroundColor: color + "22" }]}>
          <Text style={[bcS.statusTxt, { color }]}>{status}</Text>
        </View>
      </View>

      {/* Pills row */}
      <View style={bcS.pillRow}>
        {plate && (
          <View style={bcS.pill}>
            <Ionicons name="car-outline" size={11} color="#374151" />
            <Text style={bcS.pillTxt}>{plate}</Text>
          </View>
        )}
        {booking.license_number && (
          <View style={bcS.pill}>
            <Ionicons name="id-card-outline" size={11} color="#6b7280" />
            <Text style={bcS.pillTxt}>Lic: {booking.license_number}</Text>
          </View>
        )}
        {booking.vehicle_variants?.color && (
          <View style={bcS.pill}>
            <Ionicons name="color-palette-outline" size={11} color="#6b7280" />
            <Text style={bcS.pillTxt}>{booking.vehicle_variants.color}</Text>
          </View>
        )}
        {fuelMeta && (
          <View style={[bcS.pill, { backgroundColor: fuelMeta.bg }]}>
            <Ionicons name={fuelMeta.icon} size={11} color={fuelMeta.color} />
            <Text style={[bcS.pillTxt, { color: fuelMeta.color }]}>{fuelType}</Text>
          </View>
        )}
      </View>

      {/* Date row */}
      <View style={bcS.row}>
        <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
        <Text style={bcS.rowTxt}>{fmtDate(booking.rental_start_date)} → {fmtDate(booking.rental_end_date)}</Text>
      </View>

      {/* Location */}
      {(booking.delivery_address || booking.pickup_location) && (
        <View style={bcS.row}>
          <Ionicons name="location-outline" size={13} color="#db2777" />
          <Text style={[bcS.rowTxt, { color: "#db2777" }]} numberOfLines={1}>
            {booking.delivery_address || booking.pickup_location}
          </Text>
        </View>
      )}

      {/* Price */}
      <View style={bcS.row}>
        <Ionicons name="cash-outline" size={13} color="#9ca3af" />
        <Text style={bcS.rowTxt}>{fmt(booking.total_price)}</Text>
      </View>

      {/* Deposit badge */}
      {showDeposit && (
        <View style={[
          bcS.depositBadge,
          depositReturned
            ? bcS.depositBadgeReturned
            : depositCollected > 0
              ? bcS.depositBadgeCollected
              : bcS.depositBadgePending,
        ]}>
          <Ionicons
            name={depositReturned ? "shield-checkmark" : depositCollected > 0 ? "shield" : "shield-outline"}
            size={14}
            color={depositReturned ? "#059669" : depositCollected > 0 ? "#7c3aed" : "#6b7280"}
          />
          <View style={{ flex: 1, marginLeft: 6 }}>
            <Text style={[
              bcS.depositAmt,
              { color: depositReturned ? "#059669" : depositCollected > 0 ? "#7c3aed" : "#374151" },
            ]}>
              {fmt(depositAmount)} Security Deposit
            </Text>
            <Text style={bcS.depositSub}>
              {depositReturned
                ? "✓ Returned to customer"
                : depositCollected > 0
                  ? "Collected — to be returned at retrieval"
                  : "Collect at delivery"}
            </Text>
          </View>
        </View>
      )}

      {/* Driver row */}
      <View style={bcS.driverRow}>
        <Ionicons name="person-circle-outline" size={14} color="#374151" />
        {booking.assigned_driver
          ? <Text style={bcS.driverTxt}>Driver: <Text style={{ fontWeight: "700", color: "#111827" }}>{booking.assigned_driver}</Text></Text>
          : <Text style={bcS.noDriver}>No driver assigned</Text>
        }
      </View>

      {/* Charge pills */}
      {(booking.fuel_charge > 0 || booking.delay_charge > 0 || booking.damage_fee > 0) && (
        <View style={bcS.chargePills}>
          {booking.fuel_charge  > 0 && <View style={bcS.cpill}><Text style={bcS.cpillTxt}>⛽ {fmt(booking.fuel_charge)}</Text></View>}
          {booking.delay_charge > 0 && <View style={[bcS.cpill, { backgroundColor: "#fce7f3" }]}><Text style={[bcS.cpillTxt, { color: "#db2777" }]}>⏰ {fmt(booking.delay_charge)}</Text></View>}
          {booking.damage_fee   > 0 && <View style={[bcS.cpill, { backgroundColor: "#fee2e2" }]}><Text style={[bcS.cpillTxt, { color: "#b91c1c" }]}>🔧 {fmt(booking.damage_fee)}</Text></View>}
        </View>
      )}

      {/* Timeline */}
      {shouldShowTimeline && <DriverStatusTimeline booking={booking} />}

      {/* Payment breakdown (when no timeline) */}
      {!shouldShowTimeline && booking.payment_log && booking.payment_log.length > 0 && (
        <View style={bcS.payBreakdown}>
          <Text style={bcS.payBreakdownTitle}>Payment Breakdown:</Text>
          {booking.payment_log.map((p, i) => (
            <View key={i} style={bcS.payBreakdownRow}>
              <Text style={bcS.payBreakdownLabel}>{p.event}</Text>
              <Text style={bcS.payBreakdownValue}>{fmt(p.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Total collected */}
      {totalPaid > 0 && (
        <View style={bcS.totalPaid}>
          <Text style={bcS.totalPaidL}>Total Collected</Text>
          <Text style={bcS.totalPaidV}>{fmt(totalPaid)}</Text>
        </View>
      )}
    </View>
  );
};

const bcS = StyleSheet.create({
  card:        { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, borderLeftWidth: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  head:        { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, gap: 10 },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3f4f6", justifyContent: "center", alignItems: "center" },
  avatarTxt:   { fontSize: 14, fontWeight: "700", color: "#374151" },
  name:        { fontSize: 16, fontWeight: "700", color: "#111827" },
  vehicle:     { fontSize: 13, color: "#374151", marginTop: 2 },
  statusPill:  { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusTxt:   { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  pillRow:     { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  pill:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f3f4f6", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pillTxt:     { fontSize: 11, color: "#374151", fontWeight: "600" },
  row:         { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  rowTxt:      { fontSize: 13, color: "#6b7280", flex: 1 },
  driverRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: "#f8fafc", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  driverTxt:   { fontSize: 13, color: "#374151" },
  noDriver:    { fontSize: 12, color: "#f59e0b", fontWeight: "600" },
  chargePills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  cpill:       { backgroundColor: "#fffbeb", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  cpillTxt:    { fontSize: 12, fontWeight: "600", color: "#92400e" },
  depositBadge:          { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 8, borderWidth: 1 },
  depositBadgePending:   { backgroundColor: "#f9fafb", borderColor: "#e5e7eb" },
  depositBadgeCollected: { backgroundColor: "#f5f3ff", borderColor: "#ddd6fe" },
  depositBadgeReturned:  { backgroundColor: "#f0fdf4", borderColor: "#86efac" },
  depositAmt:  { fontSize: 13, fontWeight: "700" },
  depositSub:  { fontSize: 11, color: "#6b7280", marginTop: 1 },
  payBreakdown:      { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  payBreakdownTitle: { fontSize: 10, fontWeight: "700", color: "#6b7280", marginBottom: 5, textTransform: "uppercase" },
  payBreakdownRow:   { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  payBreakdownLabel: { fontSize: 11, color: "#374151" },
  payBreakdownValue: { fontSize: 11, fontWeight: "700", color: "#059669" },
  totalPaid:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f0fdf4", borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: "#86efac" },
  totalPaidL:  { fontSize: 13, fontWeight: "600", color: "#166534" },
  totalPaidV:  { fontSize: 15, fontWeight: "800", color: "#15803d" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function UserManagementScreen({ navigation }) {
  // ── Shared state ──────────────────────────────────────────────────────────
  const [users, setUsers]       = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState({ visible: false, type: "success", message: "" });

  // activeTab: "overview" | "drivers" | "admins" | "owners"
  const [activeTab, setActiveTab] = useState("overview");

  // ── User management (admin/driver) state ──────────────────────────────────
  const [modalVisible, setModalVisible]   = useState(false);
  const [editingUser, setEditingUser]     = useState(null);
  const [addingRole, setAddingRole]       = useState("driver");
  const [form, setForm] = useState({ full_name: "", email: "", contact_number: "", password: "", role: "driver", status: "active" });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [selectedDriver, setSelectedDriver]       = useState(null);
  const [driverDetailsModal, setDriverDetailsModal] = useState(false);

  // ── Car owners state ──────────────────────────────────────────────────────
  const [owners, setOwners]             = useState([]);
  const [filteredOwners, setFilteredOwners] = useState([]);
  const [ownerSearch, setOwnerSearch]   = useState("");
  const [ownerStatusFilter, setOwnerStatusFilter] = useState("All");
  const [addOwnerModalVisible, setAddOwnerModalVisible] = useState(false);
  const [confirmAddOwner, setConfirmAddOwner]           = useState(false);
  const [confirmDeleteOwner, setConfirmDeleteOwner]     = useState(false);
  const [deleteOwnerModalVisible, setDeleteOwnerModalVisible] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [ownerForm, setOwnerForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
  const [showPassword, setShowPassword]               = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── Owner Profile (inline) state ──────────────────────────────────────────
  const [viewingOwner, setViewingOwner]       = useState(null);
  const [ownerVehicles, setOwnerVehicles]     = useState([]);
  const [ownerBookings, setOwnerBookings]     = useState([]);
  const [ownerProfileLoading, setOwnerProfileLoading] = useState(false);

  // ─── Load data ─────────────────────────────────────────────────────────────

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

  const fetchOwners = async () => {
    try {
      const ownersData = await carOwnersService.listAll();
      const ownersWithStats = await Promise.all(
        ownersData.map(async (owner) => {
          const variants   = await variantsService.listByOwnerId(owner.id);
          const variantIds = variants?.map((v) => v.id) || [];
          let bkgs = [];
          if (variantIds.length > 0) bkgs = await bookingsService.listByVariantIds(variantIds);
          const totalEarnings   = bkgs.filter(b => b.status === "completed").reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
          const pendingPayments = bkgs.filter(b => b.status === "confirmed").reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
          const activeBookings  = bkgs.filter(b => b.status === "confirmed").length;
          return { ...owner, vehiclesCount: variants?.length || 0, totalEarnings, pendingPayments, activeBookings };
        })
      );
      const sorted = ownersWithStats.sort((a, b) => {
        if (a.name?.toLowerCase() === "rental den") return -1;
        if (b.name?.toLowerCase() === "rental den") return 1;
        return 0;
      });
      setOwners(sorted);
    } catch (e) {
      console.error("Error fetching owners:", e);
    }
  };

  useEffect(() => {
    loadData();
    fetchOwners();
    const unsubO = carOwnersService.subscribe(() => fetchOwners(), () => {});
    const unsubB = bookingsService.subscribe(() => { loadData(); fetchOwners(); }, () => {});
    return () => { unsubO(); unsubB(); };
  }, []);

  useEffect(() => {
    let filtered = [...owners];
    if (ownerSearch.trim()) {
      filtered = filtered.filter(o =>
        o.name?.toLowerCase().includes(ownerSearch.toLowerCase()) ||
        o.email?.toLowerCase().includes(ownerSearch.toLowerCase())
      );
    }
    if (ownerStatusFilter !== "All") {
      filtered = filtered.filter(o => o.status === ownerStatusFilter);
    }
    setFilteredOwners(filtered);
  }, [owners, ownerSearch, ownerStatusFilter]);

  // ─── Admin / Driver helpers ────────────────────────────────────────────────

  const openAdd = (role) => {
    setEditingUser(null);
    setAddingRole(role);
    setForm({ full_name: "", email: "", contact_number: "", password: "", role, status: "active" });
    setModalVisible(true);
  };

  const openEdit = (u) => {
    setEditingUser(u);
    setAddingRole(u.role || "driver");
    setForm({ full_name: u.full_name || "", email: u.email || "", contact_number: u.contact_number || "", password: "", role: u.role || "driver", status: u.status || "active" });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.full_name?.trim() || !form.email?.trim()) { Alert.alert("Error", "Full name and email are required."); return; }
    if (!editingUser && !form.password?.trim()) { Alert.alert("Error", "Password is required for new users."); return; }
    setSubmitLoading(true);
    try {
      if (editingUser) {
        await appUsersService.update(editingUser.id, { full_name: form.full_name.trim(), email: form.email.trim(), contact_number: form.contact_number?.trim() || null, status: form.status });
        setFeedback({ visible: true, type: "success", message: "User updated." });
      } else {
        await appUsersService.create({ full_name: form.full_name.trim(), email: form.email.trim(), contact_number: form.contact_number?.trim() || null, password: form.password, role: form.role, status: form.status });
        setFeedback({ visible: true, type: "success", message: `${form.role === "driver" ? "Driver" : "Admin"} created successfully.` });
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
      { text: "Send", onPress: async () => {
        try {
          await firebaseAuth.resetPasswordForEmail(u.email);
          setFeedback({ visible: true, type: "success", message: "Reset email sent." });
        } catch (e) {
          setFeedback({ visible: true, type: "error", message: e?.message || "Failed to send" });
        }
      }},
    ]);
  };

  const getDriverStats = (driver) => {
    const driverEmail = (driver.email || "").toLowerCase().trim();
    const driverName  = (driver.full_name || "").toLowerCase().trim();
    const driverBookings = bookings.filter((b) => {
      const ae = (b.assigned_driver_email || "").toLowerCase().trim();
      const an = (b.assigned_driver || "").toLowerCase().trim();
      return ae === driverEmail || an === driverName || an.includes(driverName) || driverName.includes(an);
    });
    const active    = driverBookings.filter(b => ["confirmed","ongoing","delivered","retrieved"].includes(b.status));
    const completed = driverBookings.filter(b => b.status === "completed");
    const totalCollected = driverBookings.reduce((sum, b) => sum + (b.payment_log || []).reduce((s, e) => s + (Number(e.amount) || 0), 0), 0);
    return { total: driverBookings.length, active: active.length, completed: completed.length, collected: totalCollected, bookings: driverBookings };
  };

  const openDriverDetails = (driver) => { setSelectedDriver(driver); setDriverDetailsModal(true); };

  // ─── Car Owner helpers ─────────────────────────────────────────────────────

  const handleAddOwnerClick = () => {
    const { name, email, phone, password, confirmPassword } = ownerForm;
    if (!name.trim() || !email.trim() || !phone.trim()) { Alert.alert("Error", "Please fill in Name, Email, and Phone."); return; }
    if (!password.trim() || password.length < 6) { Alert.alert("Error", "Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { Alert.alert("Error", "Passwords do not match."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { Alert.alert("Error", "Please enter a valid email address."); return; }
    setAddOwnerModalVisible(false);
    setConfirmAddOwner(true);
  };

  const addNewOwner = async () => {
    try {
      const ownerId = await carOwnersService.add({
        name: ownerForm.name.trim(),
        email: ownerForm.email.trim(),
        phone: ownerForm.phone.trim(),
        status: "active",
      });
      await appUsersService.create({
        full_name: ownerForm.name.trim(),
        email: ownerForm.email.trim(),
        contact_number: ownerForm.phone.trim() || null,
        password: ownerForm.password,
        role: "car_owner",
        status: "active",
        owner_profile_id: ownerId || null,
      });
      setFeedback({ visible: true, type: "success", message: `Car owner added! They can now log in with ${ownerForm.email.trim()} to access the Car Owner Portal.` });
      setConfirmAddOwner(false);
      setOwnerForm({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
      await fetchOwners();
    } catch (e) {
      let msg = "Failed to add car owner.";
      if (e?.code === "auth/email-already-in-use") msg = "This email is already registered.";
      else if (e?.message) msg = e.message;
      setFeedback({ visible: true, type: "error", message: msg });
      setConfirmAddOwner(false);
    }
  };

  const handleDeleteOwner = (owner) => {
    if (owner.name?.toLowerCase() === "rental den") { Alert.alert("Cannot Delete", "Rental Den is the main business owner and cannot be deleted."); return; }
    setSelectedOwner(owner);
    setConfirmDeleteOwner(true);
  };

  const confirmDeleteOwnerFn = async () => {
    if (!selectedOwner) return;
    try {
      if (selectedOwner.vehiclesCount > 0) {
        setDeleteOwnerModalVisible(false);
        setFeedback({ visible: true, type: "error", message: "Cannot delete owner with existing vehicles. Remove all vehicles first." });
        setSelectedOwner(null); return;
      }
      await carOwnersService.delete(selectedOwner.id);
      setFeedback({ visible: true, type: "success", message: "Car owner deleted successfully!" });
      setDeleteOwnerModalVisible(false);
      setSelectedOwner(null);
      await fetchOwners();
    } catch (e) {
      setFeedback({ visible: true, type: "error", message: "Failed to delete car owner" });
      setDeleteOwnerModalVisible(false);
      setSelectedOwner(null);
    }
  };

  // ─── Owner Profile inline loader ───────────────────────────────────────────

  const openOwnerProfile = async (owner) => {
    setViewingOwner(owner);
    setOwnerProfileLoading(true);
    try {
      const variantsData  = await variantsService.listByOwnerId(owner.id);
      const allVehicles   = await vehiclesService.list();
      const vehiclesMap   = Object.fromEntries(allVehicles.map(v => [v.id, v]));
      const variantsWithVehicles = (variantsData || []).map(v => ({ ...v, vehicles: vehiclesMap[v.vehicle_id] || null }));
      const variantIds = variantsWithVehicles.map(v => v.id);
      let allBookings = [];
      if (variantIds.length > 0) {
        allBookings = await bookingsService.listByVariantIds(variantIds);
        allBookings = allBookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      const variantsWithEarnings = variantsWithVehicles.map(variant => {
        const vb = allBookings.filter(b => b.vehicle_variant_id === variant.id);
        const totalEarned = vb.filter(b => b.status === "completed").reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
        return { ...variant, totalEarned, bookingsCount: vb.length };
      });
      const totalEarnings   = allBookings.filter(b => b.status === "completed").reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
      const pendingPayments = allBookings.filter(b => b.status === "confirmed").reduce((s, b) => s + parseFloat(b.total_price || 0), 0);
      const activeBookings  = allBookings.filter(b => b.status === "confirmed").length;
      setViewingOwner(prev => ({ ...prev, totalEarnings, pendingPayments, activeBookings }));
      setOwnerVehicles(variantsWithEarnings);
      setOwnerBookings(allBookings);
    } catch (e) {
      console.error("Error loading owner profile:", e);
    } finally {
      setOwnerProfileLoading(false);
    }
  };

  const closeOwnerProfile = () => { setViewingOwner(null); setOwnerVehicles([]); setOwnerBookings([]); };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  };

  // ─── Derived data ──────────────────────────────────────────────────────────

  const drivers       = users.filter(u => u.role === "driver");
  const admins        = users.filter(u => u.role === "admin");
  const activeDrivers = drivers.filter(d => d.status === "active");
  const totalDriverEarnings = drivers.reduce((sum, d) => sum + getDriverStats(d).collected, 0);
  const allDeliveryBookings = bookings.filter(b => b.delivery_option === "deliver" || ["ongoing","delivered","retrieved","completed"].includes(b.status));
  const completedDeliveries = allDeliveryBookings.filter(b => b.status === "completed");

  const totalOwners        = owners.length;
  const activeOwners       = owners.filter(o => o.status === "active").length;
  const ownerTotalEarnings = owners.reduce((s, o) => s + (o.totalEarnings || 0), 0);
  const ownerPending       = owners.reduce((s, o) => s + (o.pendingPayments || 0), 0);

  // ─── Improved Driver Card ──────────────────────────────────────────────────
  const renderDriverCard = (item) => {
    const stats    = getDriverStats(item);
    const isActive = item.status === "active";
    return (
      <TouchableOpacity key={item.id} style={styles.driverCard} onPress={() => openDriverDetails(item)} activeOpacity={0.85}>
        <View style={[styles.cardAccent, { backgroundColor: isActive ? "#10b981" : "#9ca3af" }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <View style={[styles.avatar, { backgroundColor: "#111827" }]}>
              <Text style={[styles.avatarText, { color: "#fff" }]}>
                {(item.full_name || item.email || "?")[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardName}>{item.full_name || item.email}</Text>
              <Text style={styles.cardEmail}>{item.email}</Text>
              {item.contact_number ? <Text style={styles.cardContact}><Ionicons name="call-outline" size={11} color="#9ca3af" /> {item.contact_number}</Text> : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View style={[styles.statusPill, { backgroundColor: isActive ? "#d1fae5" : "#fee2e2" }]}>
                <View style={[styles.statusDot, { backgroundColor: isActive ? "#10b981" : "#ef4444" }]} />
                <Text style={[styles.statusPillText, { color: isActive ? "#065f46" : "#991b1b" }]}>
                  {item.status || "active"}
                </Text>
              </View>
              <View style={[styles.rolePill, { backgroundColor: "#f3f4f6" }]}>
                <Ionicons name="car" size={10} color="#374151" />
                <Text style={[styles.rolePillText, { color: "#374151" }]}>Driver</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: "#f3f4f6" }]}>
                <Ionicons name="car" size={13} color="#111827" />
              </View>
              <Text style={[styles.statVal, { color: "#111827" }]}>{stats.active}</Text>
              <Text style={styles.statLbl}>Active</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: "#f3f4f6" }]}>
                <Ionicons name="checkmark-circle" size={13} color="#111827" />
              </View>
              <Text style={[styles.statVal, { color: "#111827" }]}>{stats.completed}</Text>
              <Text style={styles.statLbl}>Done</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: "#f3f4f6" }]}>
                <Ionicons name="wallet" size={13} color="#111827" />
              </View>
              <Text style={[styles.statVal, { color: "#111827", fontSize: 11 }]}>{fmt(stats.collected)}</Text>
              <Text style={styles.statLbl}>Collected</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: "#f3f4f6" }]}>
                <Ionicons name="list" size={13} color="#111827" />
              </View>
              <Text style={[styles.statVal, { color: "#111827" }]}>{stats.total}</Text>
              <Text style={styles.statLbl}>Total</Text>
            </View>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
              <Ionicons name="pencil" size={13} color="#374151" />
              <Text style={styles.actionBtnTxt}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleResetPassword(item)}>
              <Ionicons name="key" size={13} color="#374151" />
              <Text style={styles.actionBtnTxt}>Reset PW</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDark]} onPress={() => openDriverDetails(item)}>
              <Ionicons name="stats-chart" size={13} color="#fff" />
              <Text style={[styles.actionBtnTxt, { color: "#fff" }]}>Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Improved Admin Card ───────────────────────────────────────────────────
  const renderAdminCard = (item) => {
    const isActive = item.status === "active";
    return (
      <View key={item.id} style={styles.adminCard}>
        <View style={[styles.cardAccent, { backgroundColor: isActive ? "#10b981" : "#9ca3af" }]} />
        <View style={styles.cardContent}>
          <View style={styles.cardTopRow}>
            <View style={[styles.avatar, { backgroundColor: "#111827" }]}>
              <Text style={[styles.avatarText, { color: "#fff" }]}>
                {(item.full_name || item.email || "?")[0].toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardName}>{item.full_name || item.email}</Text>
              <Text style={styles.cardEmail}>{item.email}</Text>
              {item.contact_number ? <Text style={styles.cardContact}><Ionicons name="call-outline" size={11} color="#9ca3af" /> {item.contact_number}</Text> : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: 4 }}>
              <View style={[styles.statusPill, { backgroundColor: isActive ? "#d1fae5" : "#fee2e2" }]}>
                <View style={[styles.statusDot, { backgroundColor: isActive ? "#10b981" : "#ef4444" }]} />
                <Text style={[styles.statusPillText, { color: isActive ? "#065f46" : "#991b1b" }]}>
                  {item.status || "active"}
                </Text>
              </View>
              <View style={[styles.rolePill, { backgroundColor: "#f3f4f6" }]}>
                <Ionicons name="shield-checkmark" size={10} color="#374151" />
                <Text style={[styles.rolePillText, { color: "#374151" }]}>Admin</Text>
              </View>
            </View>
          </View>

          <View style={styles.adminBanner}>
            <Ionicons name="shield-checkmark" size={14} color="#374151" />
            <Text style={styles.adminBannerText}>Full system access · Manages bookings & vehicles</Text>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
              <Ionicons name="pencil" size={13} color="#374151" />
              <Text style={styles.actionBtnTxt}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => handleResetPassword(item)}>
              <Ionicons name="key" size={13} color="#374151" />
              <Text style={styles.actionBtnTxt}>Reset PW</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ─── Owners Tab ────────────────────────────────────────────────────────────
  const renderOwnersTab = () => (
    <View style={{ flex: 1 }}>
      <View style={styles.ownersHeader}>
        <View style={styles.ownerStatsGrid}>
          <View style={styles.ownerStatCard}>
            <Ionicons name="people" size={22} color="#111827" />
            <Text style={styles.ownerStatVal}>{totalOwners}</Text>
            <Text style={styles.ownerStatLbl}>Total</Text>
          </View>
          <View style={styles.ownerStatCard}>
            <Ionicons name="person-circle" size={22} color="#111827" />
            <Text style={styles.ownerStatVal}>{activeOwners}</Text>
            <Text style={styles.ownerStatLbl}>Active</Text>
          </View>
          <View style={styles.ownerStatCard}>
            <Ionicons name="cash" size={22} color="#111827" />
            <Text style={[styles.ownerStatVal, { fontSize: 12 }]}>{fmt(ownerTotalEarnings)}</Text>
            <Text style={styles.ownerStatLbl}>Earnings</Text>
          </View>
          <View style={styles.ownerStatCard}>
            <Ionicons name="time" size={22} color="#111827" />
            <Text style={[styles.ownerStatVal, { fontSize: 12 }]}>{fmt(ownerPending)}</Text>
            <Text style={styles.ownerStatLbl}>Pending</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.addOwnerBtn} onPress={() => setAddOwnerModalVisible(true)}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addOwnerBtnTxt}>Add Car Owner</Text>
        </TouchableOpacity>
        <View style={styles.ownerSearchBox}>
          <Ionicons name="search" size={16} color="#9ca3af" />
          <TextInput
            style={styles.ownerSearchInput}
            placeholder="Search car owners..."
            value={ownerSearch}
            onChangeText={setOwnerSearch}
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.filterChips}>
          {["All", "active", "inactive"].map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, ownerStatusFilter === f && styles.filterChipActive]}
              onPress={() => setOwnerStatusFilter(f)}
            >
              <Text style={[styles.filterChipTxt, ownerStatusFilter === f && styles.filterChipTxtActive]}>
                {f === "All" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 14, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOwners().finally(() => setRefreshing(false)); }} />}
      >
        {filteredOwners.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={56} color="#d1d5db" />
            <Text style={styles.emptyText}>No car owners found</Text>
          </View>
        ) : (
          filteredOwners.map(owner => renderOwnerCard(owner))
        )}
      </ScrollView>
    </View>
  );

  const renderOwnerCard = (item) => {
    const isRentalDen = item.name?.toLowerCase() === "rental den";
    const isActive    = item.status === "active" || !item.status;
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.ownerCard, isRentalDen && styles.ownerCardRentalDen]}
        onPress={() => openOwnerProfile(item)}
        activeOpacity={0.85}
      >
        {isRentalDen && (
          <View style={styles.mainOwnerBadge}>
            <Ionicons name="star" size={12} color="#f59e0b" />
            <Text style={styles.mainOwnerTxt}>Main Business Owner</Text>
          </View>
        )}
        {item.email && !isRentalDen && (
          <View style={styles.portalBadge}>
            <Ionicons name="key-outline" size={11} color="#374151" />
            <Text style={styles.portalBadgeTxt}>Car Owner Portal Access</Text>
          </View>
        )}

        <View style={styles.ownerCardHeader}>
          <View style={[styles.ownerAvatar, isRentalDen ? { backgroundColor: "#f59e0b" } : { backgroundColor: "#111827" }]}>
            <Text style={styles.ownerAvatarTxt}>{(item.name || "?")[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.ownerCardName}>{item.name}</Text>
            <Text style={styles.ownerCardEmail}>{item.email}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: isActive ? "#d1fae5" : "#f3f4f6" }]}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? "#10b981" : "#9ca3af" }]} />
            <Text style={[styles.statusPillText, { color: isActive ? "#065f46" : "#6b7280" }]}>
              {item.status || "active"}
            </Text>
          </View>
        </View>

        <View style={styles.ownerEarningsRow}>
          <View style={styles.ownerEarningBox}>
            <Text style={styles.ownerEarningAmt}>₱{(item.totalEarnings || 0).toLocaleString()}</Text>
            <Text style={styles.ownerEarningLbl}>Total Earnings</Text>
          </View>
          <View style={styles.ownerEarningDivider} />
          <View style={styles.ownerEarningBox}>
            <Text style={[styles.ownerEarningAmt, { color: "#f59e0b" }]}>₱{(item.pendingPayments || 0).toLocaleString()}</Text>
            <Text style={styles.ownerEarningLbl}>Pending</Text>
          </View>
        </View>

        <View style={styles.ownerCardFooter}>
          <View style={styles.ownerFooterItem}>
            <Ionicons name="car" size={13} color="#6b7280" />
            <Text style={styles.ownerFooterTxt}>{item.vehiclesCount} vehicles</Text>
          </View>
          <View style={styles.ownerFooterItem}>
            <Ionicons name="calendar" size={13} color="#6b7280" />
            <Text style={styles.ownerFooterTxt}>{item.activeBookings} active bookings</Text>
          </View>
        </View>

        <View style={styles.ownerCardActions}>
          <TouchableOpacity style={styles.ownerViewBtn} onPress={() => openOwnerProfile(item)}>
            <Ionicons name="eye" size={14} color="#111827" />
            <Text style={styles.ownerViewBtnTxt}>View Profile</Text>
          </TouchableOpacity>
          {!isRentalDen && (
            <TouchableOpacity style={styles.ownerDeleteBtn} onPress={() => handleDeleteOwner(item)}>
              <Ionicons name="trash-outline" size={14} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ─── Owner Profile Modal ───────────────────────────────────────────────────
  const OwnerProfileModal = () => {
    if (!viewingOwner) return null;
    return (
      <Modal visible={!!viewingOwner} animationType="slide" transparent>
        <View style={styles.profileOverlay}>
          <SafeAreaView style={styles.profileModal}>
            <View style={styles.profileModalHeader}>
              <TouchableOpacity onPress={closeOwnerProfile} style={styles.profileBackBtn}>
                <Ionicons name="arrow-back" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.profileModalTitle}>Owner Profile</Text>
              <TouchableOpacity
                style={styles.addVehicleHeaderBtn}
                onPress={() => { closeOwnerProfile(); navigation.navigate("AddVehicle"); }}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addVehicleHeaderBtnTxt}>Add Vehicle</Text>
              </TouchableOpacity>
            </View>

            {ownerProfileLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text style={{ marginTop: 12, color: "#6b7280" }}>Loading profile...</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.profileCard}>
                  <View style={styles.profileAvatarLarge}>
                    <Text style={styles.profileAvatarLargeTxt}>{(viewingOwner.name || "?")[0].toUpperCase()}</Text>
                  </View>
                  <Text style={styles.profileOwnerEmail}>{viewingOwner.email}</Text>
                  <View style={[styles.statusPill, { backgroundColor: viewingOwner.status === "active" ? "#d1fae5" : "#f3f4f6", marginTop: 8 }]}>
                    <View style={[styles.statusDot, { backgroundColor: viewingOwner.status === "active" ? "#10b981" : "#9ca3af" }]} />
                    <Text style={[styles.statusPillText, { color: viewingOwner.status === "active" ? "#065f46" : "#6b7280" }]}>
                      {viewingOwner.status || "active"}
                    </Text>
                  </View>
                  <View style={styles.profileInfoTable}>
                    <View style={styles.profileInfoRow}>
                      <Text style={styles.profileInfoLbl}>Phone</Text>
                      <Text style={styles.profileInfoVal}>{viewingOwner.phone || "—"}</Text>
                    </View>
                    <View style={styles.profileInfoRow}>
                      <Text style={styles.profileInfoLbl}>Joined</Text>
                      <Text style={styles.profileInfoVal}>{formatDate(viewingOwner.created_at)}</Text>
                    </View>
                    <View style={styles.profileInfoRow}>
                      <Text style={styles.profileInfoLbl}>Vehicles</Text>
                      <Text style={styles.profileInfoVal}>{ownerVehicles.length}</Text>
                    </View>
                    <View style={styles.profileInfoRow}>
                      <Text style={styles.profileInfoLbl}>Active Bookings</Text>
                      <Text style={styles.profileInfoVal}>{viewingOwner.activeBookings || 0}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.profileEarningsRow}>
                  <View style={styles.profileEarningCard}>
                    <Ionicons name="cash" size={22} color="#059669" />
                    <Text style={styles.profileEarningAmt}>₱{(viewingOwner.totalEarnings || 0).toLocaleString()}</Text>
                    <Text style={styles.profileEarningLbl}>Total Earnings</Text>
                  </View>
                  <View style={styles.profileEarningCard}>
                    <Ionicons name="time" size={22} color="#f59e0b" />
                    <Text style={[styles.profileEarningAmt, { color: "#f59e0b" }]}>₱{(viewingOwner.pendingPayments || 0).toLocaleString()}</Text>
                    <Text style={styles.profileEarningLbl}>Pending</Text>
                  </View>
                </View>

                <View style={styles.profileSection}>
                  <Text style={styles.profileSectionTitle}>Vehicle Earnings Breakdown</Text>
                  <Text style={styles.profileSectionSub}>Revenue generated by each vehicle</Text>
                  {ownerVehicles.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Ionicons name="car-outline" size={48} color="#d1d5db" />
                      <Text style={styles.emptyText}>No vehicles found</Text>
                    </View>
                  ) : (
                    ownerVehicles.map(variant => (
                      <View key={variant.id} style={styles.vehicleEarningCard}>
                        <View style={styles.vehicleEarningIcon}>
                          <Ionicons name="car" size={22} color="#fff" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.vehicleEarningName}>
                            {variant.vehicles?.year} {variant.vehicles?.make} {variant.vehicles?.model}
                          </Text>
                          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Ionicons name="color-palette" size={12} color="#6b7280" />
                              <Text style={styles.vehicleEarningSub}>{variant.color}</Text>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Ionicons name="card" size={12} color="#6b7280" />
                              <Text style={styles.vehicleEarningSub}>{variant.plate_number}</Text>
                            </View>
                          </View>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={styles.vehicleEarningAmt}>₱{(variant.totalEarned || 0).toLocaleString()}</Text>
                          <Text style={styles.vehicleEarningLbl}>earned</Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                {/* ── Recent Bookings using unified BookingCard ── */}
                <View style={styles.profileSection}>
                  <Text style={styles.profileSectionTitle}>Recent Bookings</Text>
                  <Text style={styles.profileSectionSub}>Latest bookings for this owner's vehicles</Text>
                  {ownerBookings.length === 0 ? (
                    <View style={styles.emptyBox}>
                      <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
                      <Text style={styles.emptyText}>No bookings found</Text>
                    </View>
                  ) : (
                    ownerBookings.slice(0, 8).map(booking => (
                      <BookingCard
                        key={booking.id}
                        booking={booking}
                        showTimeline={true}
                      />
                    ))
                  )}
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </SafeAreaView>
        </View>
      </Modal>
    );
  };

  // ─── Overview Tab ──────────────────────────────────────────────────────────
  const renderOverview = () => (
    <ScrollView
      style={styles.overviewScroll}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); fetchOwners(); }} />}
    >
      <View style={styles.overviewSection}>
        <Text style={styles.overviewTitle}>System Overview</Text>
        <View style={styles.overviewGrid}>
          <View style={styles.overviewCard}>
            <Ionicons name="people" size={28} color="#111827" />
            <Text style={styles.overviewValue}>{drivers.length}</Text>
            <Text style={styles.overviewLabel}>Total Drivers</Text>
            <Text style={styles.overviewMeta}>{activeDrivers.length} active</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="shield-checkmark" size={28} color="#111827" />
            <Text style={styles.overviewValue}>{admins.length}</Text>
            <Text style={styles.overviewLabel}>Admins</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="person-circle" size={28} color="#111827" />
            <Text style={styles.overviewValue}>{owners.length}</Text>
            <Text style={styles.overviewLabel}>Car Owners</Text>
            <Text style={styles.overviewMeta}>{activeOwners} active</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="car" size={28} color="#111827" />
            <Text style={styles.overviewValue}>{allDeliveryBookings.length}</Text>
            <Text style={styles.overviewLabel}>All Deliveries</Text>
            <Text style={styles.overviewMeta}>{completedDeliveries.length} done</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="wallet" size={28} color="#111827" />
            <Text style={[styles.overviewValue, { fontSize: 16 }]}>{fmt(totalDriverEarnings)}</Text>
            <Text style={styles.overviewLabel}>Drivers Collected</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="cash" size={28} color="#111827" />
            <Text style={[styles.overviewValue, { fontSize: 16 }]}>{fmt(ownerTotalEarnings)}</Text>
            <Text style={styles.overviewLabel}>Owner Earnings</Text>
          </View>
        </View>
      </View>

      <View style={styles.overviewSection}>
        <Text style={styles.overviewTitle}>Top Performing Drivers</Text>
        {drivers.length === 0 ? (
          <View style={styles.emptyBox}><Text style={styles.emptyText}>No drivers yet</Text></View>
        ) : (
          drivers.map(d => ({ ...d, stats: getDriverStats(d) }))
            .sort((a, b) => b.stats.collected - a.stats.collected)
            .slice(0, 5)
            .map((driver, index) => (
              <TouchableOpacity key={driver.id} style={styles.topDriverCard} onPress={() => openDriverDetails(driver)}>
                <View style={styles.topDriverRank}><Text style={styles.topDriverRankText}>#{index + 1}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topDriverName}>{driver.full_name}</Text>
                  <Text style={styles.topDriverMeta}>{driver.stats.completed} completed · {driver.stats.active} active</Text>
                </View>
                <View style={styles.topDriverEarnings}>
                  <Text style={styles.topDriverAmount}>{fmt(driver.stats.collected)}</Text>
                  <Text style={styles.topDriverLabel}>collected</Text>
                </View>
              </TouchableOpacity>
            ))
        )}
      </View>

      <View style={styles.overviewSection}>
        <Text style={styles.overviewTitle}>Top Clients & Repeat Customers</Text>
        {(() => {
          const customerMap = {};
          bookings.forEach(b => {
            const key = b.customer_email?.toLowerCase() || b.customer_name?.toLowerCase() || "unknown";
            if (!customerMap[key]) customerMap[key] = { name: b.customer_name || "Unknown", email: b.customer_email || "", phone: b.customer_phone || "", bookings: [], totalSpent: 0, completedCount: 0 };
            customerMap[key].bookings.push(b);
            customerMap[key].totalSpent += Number(b.total_price) || 0;
            if (b.status === "completed") customerMap[key].completedCount++;
          });
          const topClients = Object.values(customerMap).filter(c => c.bookings.length > 0).sort((a, b) => b.bookings.length !== a.bookings.length ? b.bookings.length - a.bookings.length : b.totalSpent - a.totalSpent).slice(0, 10);
          return topClients.length === 0 ? (
            <View style={styles.emptyBox}><Text style={styles.emptyText}>No bookings yet</Text></View>
          ) : (
            topClients.map((client, index) => {
              const isRepeat = client.bookings.length > 1;
              const activeBookings = client.bookings.filter(b => ["pending","confirmed","ongoing","delivered","retrieved"].includes(b.status));
              return (
                <View key={index} style={styles.clientCard}>
                  <View style={styles.clientHeader}>
                    <View style={styles.clientRank}><Text style={styles.clientRankText}>#{index + 1}</Text></View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={styles.clientName}>{client.name}</Text>
                        {isRepeat && (
                          <View style={styles.repeatBadge}>
                            <Ionicons name="repeat" size={10} color="#374151" />
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
                      <Text style={styles.clientStatLabel}>{client.bookings.length === 1 ? "Booking" : "Bookings"}</Text>
                    </View>
                    <View style={styles.clientStatBox}>
                      <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                      <Text style={styles.clientStatValue}>{client.completedCount}</Text>
                      <Text style={styles.clientStatLabel}>Completed</Text>
                    </View>
                    <View style={styles.clientStatBox}>
                      <Ionicons name="cash" size={16} color="#059669" />
                      <Text style={[styles.clientStatValue, { color: "#059669" }]}>{fmt(client.totalSpent)}</Text>
                      <Text style={styles.clientStatLabel}>Total Spent</Text>
                    </View>
                  </View>
                  {activeBookings.length > 0 && (
                    <View style={styles.activeBookingBadge}>
                      <Ionicons name="time" size={12} color="#d97706" />
                      <Text style={styles.activeBookingText}>{activeBookings.length} active {activeBookings.length === 1 ? "booking" : "bookings"}</Text>
                    </View>
                  )}
                  {/* ── Recent bookings using unified BookingCard ── */}
                  {client.bookings.length > 0 && (
                    <View style={styles.recentBookings}>
                      <Text style={styles.recentBookingsTitle}>Recent Rentals:</Text>
                      {client.bookings
                        .sort((a, b) => new Date(b.created_at || b.rental_start_date) - new Date(a.created_at || a.rental_start_date))
                        .slice(0, 3)
                        .map((booking) => (
                          <BookingCard
                            key={booking.id}
                            booking={booking}
                            showTimeline={false}
                          />
                        ))}
                      {client.bookings.length > 3 && (
                        <Text style={styles.moreBookings}>
                          + {client.bookings.length - 3} more {client.bookings.length - 3 === 1 ? "rental" : "rentals"}
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

      {(() => {
        const unassigned = allDeliveryBookings.filter(b => !b.assigned_driver && ["confirmed","ongoing","delivered"].includes(b.status));
        return unassigned.length > 0 ? (
          <View style={styles.alertBox}>
            <Ionicons name="warning" size={24} color="#d97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>⚠️ {unassigned.length} Unassigned Deliveries</Text>
              <Text style={styles.alertText}>Some deliveries need driver assignment. Go to Bookings → Deliveries tab to assign.</Text>
            </View>
          </View>
        ) : null;
      })()}
    </ScrollView>
  );

  // ─── Driver Details Modal ──────────────────────────────────────────────────
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
                <Text style={styles.detailsStatLabel}>Total</Text>
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
                  .sort((a, b) =>
                    ({ confirmed: 0, ongoing: 1, delivered: 2, retrieved: 3, completed: 4 }[a.status] || 5) -
                    ({ confirmed: 0, ongoing: 1, delivered: 2, retrieved: 3, completed: 4 }[b.status] || 5)
                  )
                  .map(booking => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      showTimeline={true}
                    />
                  ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ─── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  // ─── Tab-specific add button ───────────────────────────────────────────────
  const tabAddButton = () => {
    if (activeTab === "drivers") {
      return (
        <TouchableOpacity style={[styles.tabAddBtn, { backgroundColor: "#111827" }]} onPress={() => openAdd("driver")}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.tabAddBtnTxt}>Add Driver</Text>
        </TouchableOpacity>
      );
    }
    if (activeTab === "admins") {
      return (
        <TouchableOpacity style={[styles.tabAddBtn, { backgroundColor: "#111827" }]} onPress={() => openAdd("admin")}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.tabAddBtnTxt}>Add Admin</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  // ─── Main render ───────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={styles.title}>User Management</Text>
            <Text style={styles.subtitle}>Manage team members, drivers & car owners</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate("SystemSettings")}>
            <Ionicons name="settings-outline" size={20} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBarScroll} contentContainerStyle={styles.tabBarContent}>
        {[
          { key: "overview", label: "Overview",                      icon: "analytics" },
          { key: "admins",   label: `Admins (${admins.length})`,     icon: "shield-checkmark" },
          { key: "owners",   label: `Car Owners (${owners.length})`, icon: "people" },
          { key: "drivers",  label: `Drivers (${drivers.length})`,   icon: "car" },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons name={tab.icon} size={15} color={activeTab === tab.key ? "#111827" : "#6b7280"} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {(activeTab === "drivers" || activeTab === "admins") && (
        <View style={styles.tabAddBtnRow}>
          {tabAddButton()}
        </View>
      )}

      <View style={{ flex: 1 }}>
        {activeTab === "overview" && renderOverview()}

        {activeTab === "drivers" && (
          <FlatList
            data={drivers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => renderDriverCard(item)}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            ListEmptyComponent={<View style={styles.emptyBox}><Ionicons name="car-outline" size={48} color="#d1d5db" /><Text style={styles.emptyText}>No drivers yet</Text></View>}
          />
        )}

        {activeTab === "admins" && (
          <FlatList
            data={admins}
            keyExtractor={item => item.id}
            renderItem={({ item }) => renderAdminCard(item)}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
            ListEmptyComponent={<View style={styles.emptyBox}><Ionicons name="shield-outline" size={48} color="#d1d5db" /><Text style={styles.emptyText}>No admins yet</Text></View>}
          />
        )}

        {activeTab === "owners" && renderOwnersTab()}
      </View>

      {/* Add/Edit User Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {editingUser
                ? `Edit ${addingRole === "driver" ? "Driver" : "Admin"}`
                : `Add ${addingRole === "driver" ? "Driver" : "Admin"}`}
            </Text>
            <ScrollView style={styles.form}>
              <Text style={styles.label}>Full name *</Text>
              <TextInput style={styles.input} value={form.full_name} onChangeText={t => setForm({ ...form, full_name: t })} placeholder="Full name" placeholderTextColor="#9ca3af" />
              <Text style={styles.label}>Email *</Text>
              <TextInput style={[styles.input, editingUser && styles.inputDisabled]} value={form.email} onChangeText={t => setForm({ ...form, email: t })} placeholder="email@example.com" placeholderTextColor="#9ca3af" keyboardType="email-address" editable={!editingUser} />
              <Text style={styles.label}>Contact number</Text>
              <TextInput style={styles.input} value={form.contact_number} onChangeText={t => setForm({ ...form, contact_number: t })} placeholder="+63..." placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
              {!editingUser && (
                <>
                  <Text style={styles.label}>Password *</Text>
                  <TextInput style={styles.input} value={form.password} onChangeText={t => setForm({ ...form, password: t })} placeholder="Min 6 characters" placeholderTextColor="#9ca3af" secureTextEntry />
                </>
              )}
              <Text style={styles.label}>Role</Text>
              <View style={[styles.input, { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" }]}>
                <Ionicons name={form.role === "driver" ? "car" : "shield-checkmark"} size={16} color="#111827" />
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827", textTransform: "capitalize" }}>{form.role}</Text>
              </View>
              <Text style={styles.label}>Status</Text>
              <View style={styles.roleRow}>
                {STATUSES.map(s => (
                  <TouchableOpacity key={s.value} style={[styles.roleBtn, form.status === s.value && styles.roleBtnActive]} onPress={() => setForm({ ...form, status: s.value })}>
                    <Text style={[styles.roleBtnText, form.status === s.value && styles.roleBtnTextActive]}>{s.label}</Text>
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

      {/* Add Car Owner Modal */}
      <Modal visible={addOwnerModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxHeight: "90%" }]}>
            <View style={styles.modalTitleRow}>
              <Text style={[styles.modalTitle, { padding: 0, borderBottomWidth: 0 }]}>Add New Car Owner</Text>
              <TouchableOpacity onPress={() => setAddOwnerModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={{ height: 1, backgroundColor: "#e5e7eb", marginBottom: 0 }} />
            <ScrollView style={styles.form} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.portalInfoBanner}>
                <Ionicons name="key" size={15} color="#374151" />
                <Text style={styles.portalInfoTxt}>This car owner will get a separate Car Owner Portal login (role: car_owner) — different from the admin app.</Text>
              </View>
              <Text style={styles.formSectionLabel}>OWNER PROFILE</Text>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput style={styles.input} placeholder="John Doe" value={ownerForm.name} onChangeText={t => setOwnerForm({ ...ownerForm, name: t })} placeholderTextColor="#9ca3af" />
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput style={styles.input} placeholder="+63 XXX XXX XXXX" value={ownerForm.phone} onChangeText={t => setOwnerForm({ ...ownerForm, phone: t })} keyboardType="phone-pad" placeholderTextColor="#9ca3af" />
              <Text style={styles.formSectionLabel}>CAR OWNER PORTAL LOGIN</Text>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput style={styles.input} placeholder="owner@email.com" value={ownerForm.email} onChangeText={t => setOwnerForm({ ...ownerForm, email: t })} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9ca3af" />
              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordInputRow}>
                <TextInput style={[styles.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]} placeholder="Min 6 characters" value={ownerForm.password} onChangeText={t => setOwnerForm({ ...ownerForm, password: t })} secureTextEntry={!showPassword} autoCapitalize="none" placeholderTextColor="#9ca3af" />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(p => !p)}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#9ca3af" />
                </TouchableOpacity>
              </View>
              <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password *</Text>
              <View style={styles.passwordInputRow}>
                <TextInput style={[styles.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]} placeholder="Repeat password" value={ownerForm.confirmPassword} onChangeText={t => setOwnerForm({ ...ownerForm, confirmPassword: t })} secureTextEntry={!showConfirmPassword} autoCapitalize="none" placeholderTextColor="#9ca3af" />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword(p => !p)}>
                  <Ionicons name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#9ca3af" />
                </TouchableOpacity>
              </View>
              {ownerForm.confirmPassword.length > 0 && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                  <Ionicons name={ownerForm.password === ownerForm.confirmPassword ? "checkmark-circle" : "close-circle"} size={14} color={ownerForm.password === ownerForm.confirmPassword ? "#10b981" : "#ef4444"} />
                  <Text style={{ fontSize: 12, fontWeight: "600", color: ownerForm.password === ownerForm.confirmPassword ? "#10b981" : "#ef4444" }}>
                    {ownerForm.password === ownerForm.confirmPassword ? "Passwords match" : "Passwords do not match"}
                  </Text>
                </View>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAddOwnerModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: "#111827" }]} onPress={handleAddOwnerClick}>
                <Text style={styles.saveBtnText}>Create Car Owner</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <OwnerProfileModal />
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

      <ActionModal
        visible={confirmAddOwner}
        type="confirm"
        title="Confirm Add Car Owner"
        message={`Add "${ownerForm.name}" as a car owner? They will log in at the Car Owner Portal with ${ownerForm.email}.`}
        confirmText="Create Car Owner"
        cancelText="Cancel"
        onClose={() => setConfirmAddOwner(false)}
        onConfirm={addNewOwner}
      />

      <ActionModal
        visible={confirmDeleteOwner}
        type="delete"
        title="Delete Car Owner"
        message={`Are you sure you want to delete "${selectedOwner?.name}"?`}
        confirmText="Continue"
        cancelText="Cancel"
        onClose={() => { setConfirmDeleteOwner(false); setSelectedOwner(null); }}
        onConfirm={() => { setConfirmDeleteOwner(false); setDeleteOwnerModalVisible(true); }}
      />

      <ActionModal
        visible={deleteOwnerModalVisible}
        type="delete"
        title="Final Confirmation"
        message={`This action cannot be undone. Are you absolutely sure you want to delete "${selectedOwner?.name}"?`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        onClose={() => { setDeleteOwnerModalVisible(false); setSelectedOwner(null); }}
        onConfirm={confirmDeleteOwnerFn}
      />
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#f9fafb" },
  centered:   { flex: 1, justifyContent: "center", alignItems: "center" },

  header:     { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  title:      { fontSize: 22, fontWeight: "800", color: "#111827" },
  subtitle:   { fontSize: 12, color: "#6b7280", marginTop: 2 },
  settingsBtn:{ padding: 8, backgroundColor: "#f3f4f6", borderRadius: 10 },

  tabBarScroll:   { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", flexGrow: 0 },
  tabBarContent:  { flexDirection: "row", paddingHorizontal: 4 },
  tab:            { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 12, paddingHorizontal: 14 },
  tabActive:      { borderBottomWidth: 2, borderBottomColor: "#111827" },
  tabText:        { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  tabTextActive:  { color: "#111827" },

  tabAddBtnRow:   { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  tabAddBtn:      { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, alignSelf: "flex-start" },
  tabAddBtnTxt:   { color: "#fff", fontWeight: "700", fontSize: 13 },

  list: { padding: 14, paddingBottom: 40 },

  statusPill:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusDot:      { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusPillText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },

  rolePill:       { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  rolePillText:   { fontSize: 10, fontWeight: "700" },

  avatar:     { width: 46, height: 46, borderRadius: 23, justifyContent: "center", alignItems: "center" },
  avatarText: { fontSize: 18, fontWeight: "800" },

  cardTopRow: { flexDirection: "row", alignItems: "flex-start" },
  cardName:   { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardEmail:  { fontSize: 12, color: "#6b7280", marginTop: 2 },
  cardContact:{ fontSize: 11, color: "#9ca3af", marginTop: 2 },

  cardActions:   { flexDirection: "row", marginTop: 12, gap: 8 },
  actionBtn:     { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: "#f3f4f6", borderRadius: 8, flex: 1, justifyContent: "center" },
  actionBtnDark: { backgroundColor: "#111827" },
  actionBtnTxt:  { fontSize: 12, fontWeight: "600", color: "#374151" },

  cardAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4, borderTopLeftRadius: 14, borderBottomLeftRadius: 14 },
  cardContent:{ paddingLeft: 18, paddingRight: 14, paddingVertical: 14 },

  driverCard: { backgroundColor: "#fff", borderRadius: 14, marginBottom: 12, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },

  statsRow:       { flexDirection: "row", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  statBox:        { flex: 1, alignItems: "center" },
  statIconWrap:   { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 3 },
  statVal:        { fontSize: 14, fontWeight: "800", color: "#111827" },
  statLbl:        { fontSize: 10, color: "#9ca3af", fontWeight: "500", marginTop: 1 },
  statDivider:    { width: 1, backgroundColor: "#f3f4f6", marginHorizontal: 2 },

  adminCard:      { backgroundColor: "#fff", borderRadius: 14, marginBottom: 12, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  adminBanner:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f3f4f6", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: 12 },
  adminBannerText:{ fontSize: 12, color: "#374151", flex: 1, fontWeight: "500" },

  ownersHeader:   { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 10 },

  ownerStatsGrid: { flexDirection: "row", gap: 8, padding: 12 },
  ownerStatCard:  { flex: 1, backgroundColor: "#fff", borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  ownerStatVal:   { fontSize: 17, fontWeight: "900", color: "#111827", marginTop: 4 },
  ownerStatLbl:   { fontSize: 10, color: "#6b7280", marginTop: 2, fontWeight: "500", textAlign: "center" },

  addOwnerBtn:    { flexDirection: "row", alignItems: "center", backgroundColor: "#111827", paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, gap: 6, alignSelf: "flex-start", marginHorizontal: 12, marginBottom: 8 },
  addOwnerBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },

  ownerSearchBox:  { flexDirection: "row", alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 8, paddingHorizontal: 10, marginHorizontal: 12, marginBottom: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  ownerSearchInput:{ flex: 1, paddingVertical: 9, paddingHorizontal: 8, fontSize: 14, color: "#111827" },

  filterChips:     { flexDirection: "row", gap: 6, paddingHorizontal: 12 },
  filterChip:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "#e5e7eb" },
  filterChipActive:{ backgroundColor: "#111827", borderColor: "#111827" },
  filterChipTxt:   { fontSize: 12, fontWeight: "600", color: "#6b7280" },
  filterChipTxtActive:{ color: "#fff" },

  ownerCard:        { backgroundColor: "#fff", borderRadius: 14, marginBottom: 12, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 5, elevation: 3 },
  ownerCardRentalDen:{ borderWidth: 2, borderColor: "#f59e0b", backgroundColor: "#fffbeb" },
  mainOwnerBadge:   { flexDirection: "row", alignItems: "center", backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", marginBottom: 8, gap: 4 },
  mainOwnerTxt:     { fontSize: 10, fontWeight: "700", color: "#d97706" },
  portalBadge:      { flexDirection: "row", alignItems: "center", backgroundColor: "#f3f4f6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start", marginBottom: 8, gap: 3, borderWidth: 1, borderColor: "#e5e7eb" },
  portalBadgeTxt:   { fontSize: 9, fontWeight: "700", color: "#374151" },
  ownerCardHeader:  { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  ownerAvatar:      { width: 44, height: 44, borderRadius: 22, backgroundColor: "#111827", justifyContent: "center", alignItems: "center" },
  ownerAvatarTxt:   { fontSize: 17, fontWeight: "700", color: "#fff" },
  ownerCardName:    { fontSize: 15, fontWeight: "700", color: "#111827" },
  ownerCardEmail:   { fontSize: 12, color: "#6b7280", marginTop: 2 },

  ownerEarningsRow:    { flexDirection: "row", marginBottom: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  ownerEarningBox:     { flex: 1, alignItems: "center" },
  ownerEarningDivider: { width: 1, backgroundColor: "#f3f4f6" },
  ownerEarningAmt:     { fontSize: 16, fontWeight: "800", color: "#10b981" },
  ownerEarningLbl:     { fontSize: 10, color: "#6b7280", marginTop: 2 },

  ownerCardFooter: { flexDirection: "row", gap: 14, marginBottom: 12 },
  ownerFooterItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  ownerFooterTxt:  { fontSize: 12, color: "#6b7280" },
  ownerCardActions:{ flexDirection: "row", gap: 8 },
  ownerViewBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#f3f4f6", paddingVertical: 9, borderRadius: 8, gap: 5 },
  ownerViewBtnTxt: { fontSize: 12, fontWeight: "600", color: "#111827" },
  ownerDeleteBtn:  { width: 40, height: 40, alignItems: "center", justifyContent: "center", backgroundColor: "#fef2f2", borderRadius: 8, borderWidth: 1, borderColor: "#fecaca" },

  profileOverlay:     { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  profileModal:       { flex: 1, backgroundColor: "#f9fafb" },
  profileModalHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  profileBackBtn:     { padding: 4, marginRight: 10 },
  profileModalTitle:  { fontSize: 17, fontWeight: "700", color: "#111827", flex: 1 },
  addVehicleHeaderBtn:{ flexDirection: "row", alignItems: "center", backgroundColor: "#111827", paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8, gap: 4 },
  addVehicleHeaderBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "600" },

  profileCard:        { backgroundColor: "#fff", margin: 14, borderRadius: 16, padding: 18, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 5, elevation: 3 },
  profileAvatarLarge: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  profileAvatarLargeTxt: { fontSize: 26, fontWeight: "700", color: "#fff" },
  profileOwnerName:   { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 3 },
  profileOwnerEmail:  { fontSize: 13, color: "#6b7280", marginBottom: 6 },
  profileInfoTable:   { width: "100%", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  profileInfoRow:     { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  profileInfoLbl:     { fontSize: 13, color: "#6b7280" },
  profileInfoVal:     { fontSize: 13, fontWeight: "600", color: "#111827" },

  profileEarningsRow: { flexDirection: "row", gap: 12, marginHorizontal: 14, marginBottom: 4 },
  profileEarningCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  profileEarningAmt:  { fontSize: 18, fontWeight: "800", color: "#059669", marginTop: 6, marginBottom: 3 },
  profileEarningLbl:  { fontSize: 11, color: "#6b7280" },

  profileSection:      { backgroundColor: "#fff", margin: 14, marginTop: 10, borderRadius: 14, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  profileSectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 3 },
  profileSectionSub:   { fontSize: 12, color: "#6b7280", marginBottom: 12 },

  vehicleEarningCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  vehicleEarningIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", marginRight: 12 },
  vehicleEarningName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  vehicleEarningSub:  { fontSize: 11, color: "#6b7280" },
  vehicleEarningAmt:  { fontSize: 15, fontWeight: "800", color: "#10b981" },
  vehicleEarningLbl:  { fontSize: 10, color: "#6b7280" },

  overviewScroll:  { flex: 1 },
  overviewSection: { padding: 14 },
  overviewTitle:   { fontSize: 17, fontWeight: "800", color: "#111827", marginBottom: 14 },
  overviewGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  overviewCard:    { flex: 1, minWidth: "44%", backgroundColor: "#fff", borderRadius: 12, padding: 14, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  overviewValue:   { fontSize: 22, fontWeight: "900", color: "#111827", marginTop: 7 },
  overviewLabel:   { fontSize: 11, color: "#6b7280", marginTop: 3, fontWeight: "600" },
  overviewMeta:    { fontSize: 10, color: "#9ca3af", marginTop: 2 },

  topDriverCard:    { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  topDriverRank:    { width: 30, height: 30, borderRadius: 15, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", marginRight: 10 },
  topDriverRankText:{ fontSize: 13, fontWeight: "800", color: "#fff" },
  topDriverName:    { fontSize: 14, fontWeight: "700", color: "#111827" },
  topDriverMeta:    { fontSize: 11, color: "#6b7280", marginTop: 1 },
  topDriverEarnings:{ alignItems: "flex-end", marginLeft: 10 },
  topDriverAmount:  { fontSize: 14, fontWeight: "800", color: "#059669" },
  topDriverLabel:   { fontSize: 10, color: "#9ca3af", marginTop: 1 },

  clientCard:    { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  clientHeader:  { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  clientRank:    { width: 30, height: 30, borderRadius: 15, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", marginRight: 10 },
  clientRankText:{ fontSize: 13, fontWeight: "800", color: "#fff" },
  clientName:    { fontSize: 15, fontWeight: "700", color: "#111827" },
  clientEmail:   { fontSize: 11, color: "#6b7280", marginTop: 2 },
  clientPhone:   { fontSize: 11, color: "#9ca3af", marginTop: 1 },
  repeatBadge:   { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#f3f4f6", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  repeatBadgeText:{ fontSize: 9, fontWeight: "800", color: "#374151", letterSpacing: 0.5 },

  clientStats:     { flexDirection: "row", gap: 8, marginBottom: 8 },
  clientStatBox:   { flex: 1, alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 8, padding: 8 },
  clientStatValue: { fontSize: 15, fontWeight: "800", color: "#111827", marginTop: 3 },
  clientStatLabel: { fontSize: 10, color: "#6b7280", marginTop: 1, fontWeight: "500", textAlign: "center" },

  activeBookingBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fffbeb", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start", marginBottom: 8 },
  activeBookingText:  { fontSize: 11, fontWeight: "700", color: "#d97706" },

  recentBookings:      { paddingTop: 10, borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  recentBookingsTitle: { fontSize: 11, fontWeight: "700", color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 },
  moreBookings:        { fontSize: 11, color: "#374151", fontWeight: "600", marginTop: 3, fontStyle: "italic" },

  alertBox:   { flexDirection: "row", alignItems: "flex-start", gap: 12, marginHorizontal: 14, marginBottom: 14, backgroundColor: "#fffbeb", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#fde68a" },
  alertTitle: { fontSize: 13, fontWeight: "700", color: "#92400e", marginBottom: 3 },
  alertText:  { fontSize: 12, color: "#92400e", lineHeight: 17 },

  emptyBox:   { alignItems: "center", paddingVertical: 50 },
  emptyText:  { fontSize: 13, color: "#9ca3af", marginTop: 10 },

  detailsOverlay:   { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  detailsModal:     { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%", paddingBottom: 20 },
  detailsHeader:    { flexDirection: "row", alignItems: "flex-start", padding: 18, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  detailsTitle:     { fontSize: 19, fontWeight: "800", color: "#111827" },
  detailsSubtitle:  { fontSize: 12, color: "#6b7280", marginTop: 2 },
  detailsStatsRow:  { flexDirection: "row", padding: 14, gap: 10 },
  detailsStatCard:  { flex: 1, backgroundColor: "#f9fafb", borderRadius: 12, padding: 12, alignItems: "center" },
  detailsStatValue: { fontSize: 20, fontWeight: "900", color: "#111827" },
  detailsStatLabel: { fontSize: 10, color: "#6b7280", marginTop: 3, fontWeight: "600" },
  earningsBox:      { alignItems: "center", marginHorizontal: 14, backgroundColor: "#f0fdf4", borderRadius: 12, padding: 18, borderWidth: 1, borderColor: "#86efac" },
  earningsLabel:    { fontSize: 12, color: "#166534", fontWeight: "600", marginTop: 7 },
  earningsValue:    { fontSize: 30, fontWeight: "900", color: "#059669", marginTop: 3 },
  detailsScroll:    { paddingHorizontal: 14, maxHeight: 400 },
  sectionTitle:     { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 10, marginTop: 14, textTransform: "uppercase", letterSpacing: 0.5 },

  modalOverlay:  { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 },
  modal:         { backgroundColor: "#fff", borderRadius: 16, maxHeight: "85%" },
  modalTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18 },
  modalTitle:    { fontSize: 17, fontWeight: "700", padding: 18, borderBottomWidth: 1, borderBottomColor: "#e5e7eb", color: "#111827" },
  form:          { padding: 18, maxHeight: 420 },
  label:         { fontSize: 11, fontWeight: "700", color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  input:         { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 11, fontSize: 14, marginBottom: 14, color: "#111827", backgroundColor: "#f9fafb" },
  inputDisabled: { backgroundColor: "#f3f4f6", color: "#6b7280" },
  roleRow:       { flexDirection: "row", gap: 10, marginBottom: 14 },
  roleBtn:       { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: "#f3f4f6", alignItems: "center" },
  roleBtnActive: { backgroundColor: "#111827" },
  roleBtnText:   { fontSize: 13, fontWeight: "600", color: "#374151" },
  roleBtnTextActive: { color: "#fff" },
  modalActions:  { flexDirection: "row", padding: 18, gap: 10, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  cancelBtn:     { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: "#f3f4f6", alignItems: "center" },
  cancelBtnText: { fontWeight: "600", color: "#374151", fontSize: 14 },
  saveBtn:       { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: "#111827", alignItems: "center" },
  saveBtnText:   { fontWeight: "600", color: "#fff", fontSize: 14 },

  portalInfoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#f3f4f6", padding: 10, borderRadius: 10, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 14 },
  portalInfoTxt:    { flex: 1, fontSize: 12, color: "#374151", lineHeight: 17, fontWeight: "500" },
  formSectionLabel: { fontSize: 10, fontWeight: "800", color: "#111827", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, marginTop: 4 },
  passwordInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, paddingRight: 4, backgroundColor: "#f9fafb", marginBottom: 4 },
  eyeBtn:           { padding: 9 },
});