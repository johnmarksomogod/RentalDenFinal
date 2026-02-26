"use strict";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Modal, ScrollView, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  bookingsService, variantsService, carOwnersService, firebaseAuth,
} from '../services/firebaseService';
import ActionModal from '../components/AlertModal/ActionModal';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ink:        '#111827',
  inkSoft:    '#374151',
  muted:      '#6b7280',
  subtle:     '#9ca3af',
  border:     '#e5e7eb',
  borderSoft: '#f3f4f6',
  surface:    '#f9fafb',
  white:      '#ffffff',
  pending:    '#f59e0b',
  confirmed:  '#3b82f6',
  ongoing:    '#8b5cf6',
  delivered:  '#ec4899',
  retrieved:  '#06b6d4',
  completed:  '#10b981',
  cancelled:  '#ef4444',
  declined:   '#f97316',
};

const STATUS_COLOR = {
  pending: C.pending, confirmed: C.confirmed, ongoing: C.ongoing,
  delivered: C.delivered, retrieved: C.retrieved, completed: C.completed,
  cancelled: C.cancelled, declined: C.declined,
};

const fmt     = (v) => `₱${parseFloat(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => !d ? '—' : new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

const STATUS_FLOW_STEPS = ['pending', 'confirmed', 'ongoing', 'delivered', 'retrieved', 'completed'];

// ─── Booking Detail Modal ──────────────────────────────────────────────────────
const BookingDetailModal = ({ visible, booking, onClose }) => {
  if (!booking) return null;

  const statusColor = STATUS_COLOR[booking.status] || C.muted;
  const vehicle     = [booking.vehicles?.year, booking.vehicles?.make, booking.vehicles?.model].filter(Boolean).join(' ');
  const currentStep = STATUS_FLOW_STEPS.indexOf(booking.status);
  const isDelivery  = booking.delivery_option === 'deliver';

  const totalCharges = (parseFloat(booking.fuel_charge || 0) + parseFloat(booking.delay_charge || 0) + parseFloat(booking.damage_fee || 0) + parseFloat(booking.extra_km_charge || 0) + parseFloat(booking.extra_hours_charge || 0));
  const totalCollected = (booking.payment_log || []).reduce((a, e) => a + parseFloat(e.amount || 0), 0);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.surface }}>
        <View style={dm.header}>
          <TouchableOpacity onPress={onClose} style={dm.closeBtn}>
            <Ionicons name="arrow-back" size={22} color={C.ink} />
          </TouchableOpacity>
          <Text style={dm.headerTitle}>Booking Details</Text>
          <View style={[dm.statusPill, { backgroundColor: statusColor + '20' }]}>
            <Text style={[dm.statusPillTxt, { color: statusColor }]}>{booking.status}</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

          {/* Customer Card */}
          <View style={dm.section}>
            <Text style={dm.sectionTitle}>Customer</Text>
            <View style={dm.infoRow}>
              <View style={dm.avatar}>
                <Text style={dm.avatarTxt}>{(booking.customer_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={dm.name}>{booking.customer_name || '—'}</Text>
                {booking.customer_email && <Text style={dm.sub}>{booking.customer_email}</Text>}
                {booking.customer_phone && <Text style={dm.sub}>{booking.customer_phone}</Text>}
              </View>
            </View>
            {booking.license_number && (
              <View style={dm.metaRow}>
                <Ionicons name="id-card-outline" size={14} color={C.subtle} />
                <Text style={dm.metaTxt}>License: {booking.license_number}</Text>
              </View>
            )}
          </View>

          {/* Vehicle Card */}
          <View style={dm.section}>
            <Text style={dm.sectionTitle}>Vehicle</Text>
            {vehicle ? <Text style={dm.bigTxt}>{vehicle}</Text> : null}
            {booking.vehicle_variants?.plate_number && (
              <View style={dm.metaRow}>
                <Ionicons name="car-outline" size={14} color={C.subtle} />
                <Text style={dm.metaTxt}>{booking.vehicle_variants.plate_number}</Text>
              </View>
            )}
            {booking.vehicle_variants?.color && (
              <View style={dm.metaRow}>
                <Ionicons name="color-palette-outline" size={14} color={C.subtle} />
                <Text style={dm.metaTxt}>{booking.vehicle_variants.color}</Text>
              </View>
            )}
          </View>

          {/* Dates & Pricing */}
          <View style={dm.section}>
            <Text style={dm.sectionTitle}>Rental Period</Text>
            <View style={dm.metaRow}>
              <Ionicons name="calendar-outline" size={14} color={C.subtle} />
              <Text style={dm.metaTxt}>{fmtDate(booking.rental_start_date)} — {fmtDate(booking.rental_end_date)}</Text>
            </View>
            {(booking.pickup_location || booking.delivery_address) && (
              <View style={dm.metaRow}>
                <Ionicons name="location-outline" size={14} color={C.subtle} />
                <Text style={dm.metaTxt} numberOfLines={2}>{booking.delivery_address || booking.pickup_location}</Text>
              </View>
            )}
            <View style={dm.priceBox}>
              <Text style={dm.priceLabel}>Total Rental</Text>
              <Text style={dm.priceValue}>{fmt(booking.total_price)}</Text>
            </View>
          </View>

          {/* Progress Timeline */}
          {!['cancelled', 'declined'].includes(booking.status) && (
            <View style={dm.section}>
              <Text style={dm.sectionTitle}>Booking Progress</Text>
              <View style={dm.timeline}>
                {STATUS_FLOW_STEPS.map((step, idx) => {
                  const done    = currentStep >= idx;
                  const current = currentStep === idx;
                  return (
                    <View key={step} style={dm.timelineStep}>
                      <View style={[dm.tlDot, done && dm.tlDotDone, current && dm.tlDotCurrent]}>
                        <Ionicons
                          name={done ? 'checkmark' : 'ellipse'}
                          size={done ? 12 : 8}
                          color={done ? '#fff' : C.border}
                        />
                      </View>
                      {idx < STATUS_FLOW_STEPS.length - 1 && (
                        <View style={[dm.tlLine, done && currentStep > idx && dm.tlLineDone]} />
                      )}
                      <Text style={[dm.tlLabel, current && dm.tlLabelActive]} numberOfLines={1}>{step}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Driver Info (if delivery) */}
          {isDelivery && (
            <View style={dm.section}>
              <Text style={dm.sectionTitle}>Delivery / Driver</Text>
              <View style={dm.driverBadge}>
                <Ionicons name="car-outline" size={16} color={C.ink} />
                <Text style={dm.driverBadgeTxt}>
                  {booking.assigned_driver ? booking.assigned_driver : 'No driver assigned yet'}
                </Text>
              </View>
            </View>
          )}

          {/* Charges */}
          {totalCharges > 0 && (
            <View style={dm.section}>
              <Text style={dm.sectionTitle}>Additional Charges</Text>
              {booking.fuel_charge > 0 && (
                <View style={dm.chargeRow}>
                  <Text style={dm.chargeLabel}>⛽ Fuel Charge</Text>
                  <Text style={dm.chargeAmt}>{fmt(booking.fuel_charge)}</Text>
                </View>
              )}
              {booking.delay_charge > 0 && (
                <View style={dm.chargeRow}>
                  <Text style={dm.chargeLabel}>⏰ Delay Charge</Text>
                  <Text style={dm.chargeAmt}>{fmt(booking.delay_charge)}</Text>
                </View>
              )}
              {booking.damage_fee > 0 && (
                <View style={dm.chargeRow}>
                  <Text style={dm.chargeLabel}>🔧 Damage Fee</Text>
                  <Text style={dm.chargeAmt}>{fmt(booking.damage_fee)}</Text>
                </View>
              )}
              {booking.extra_km_charge > 0 && (
                <View style={dm.chargeRow}>
                  <Text style={dm.chargeLabel}>📍 Extra KM</Text>
                  <Text style={dm.chargeAmt}>{fmt(booking.extra_km_charge)}</Text>
                </View>
              )}
              {booking.extra_hours_charge > 0 && (
                <View style={dm.chargeRow}>
                  <Text style={dm.chargeLabel}>⏱ Extra Hours</Text>
                  <Text style={dm.chargeAmt}>{fmt(booking.extra_hours_charge)}</Text>
                </View>
              )}
              <View style={dm.totalRow}>
                <Text style={dm.totalLabel}>Total Charges</Text>
                <Text style={dm.totalAmt}>{fmt(totalCharges)}</Text>
              </View>
            </View>
          )}

          {/* Payment Log */}
          {booking.payment_log?.length > 0 && (
            <View style={dm.section}>
              <Text style={dm.sectionTitle}>Payment Log</Text>
              {booking.payment_log.map((e, i) => (
                <View key={i} style={dm.payRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={dm.payEvent}>{e.event}</Text>
                    <Text style={dm.payTime}>{e.recorded_at ? new Date(e.recorded_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                  </View>
                  <Text style={dm.payAmt}>{fmt(e.amount)}</Text>
                </View>
              ))}
              <View style={dm.totalRow}>
                <Text style={dm.totalLabel}>Total Collected</Text>
                <Text style={[dm.totalAmt, { color: C.completed }]}>{fmt(totalCollected)}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const dm = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  closeBtn:     { padding: 4 },
  headerTitle:  { flex: 1, fontSize: 18, fontWeight: '800', color: C.ink },
  statusPill:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  statusPillTxt:{ fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  section:      { backgroundColor: C.white, borderRadius: 14, margin: 14, marginBottom: 0, padding: 14, borderWidth: 1, borderColor: C.border },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.subtle, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  infoRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  avatar:       { width: 44, height: 44, borderRadius: 22, backgroundColor: C.ink, justifyContent: 'center', alignItems: 'center' },
  avatarTxt:    { fontSize: 16, fontWeight: '700', color: '#fff' },
  name:         { fontSize: 16, fontWeight: '700', color: C.ink },
  sub:          { fontSize: 13, color: C.muted, marginTop: 2 },
  metaRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 6 },
  metaTxt:      { fontSize: 13, color: C.muted, flex: 1 },
  bigTxt:       { fontSize: 17, fontWeight: '700', color: C.ink, marginBottom: 6 },
  priceBox:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.borderSoft, borderRadius: 10, padding: 12, marginTop: 10 },
  priceLabel:   { fontSize: 13, fontWeight: '600', color: C.inkSoft },
  priceValue:   { fontSize: 20, fontWeight: '800', color: C.ink },
  timeline:     { flexDirection: 'row', alignItems: 'flex-start' },
  timelineStep: { flex: 1, alignItems: 'center', position: 'relative' },
  tlDot:        { width: 24, height: 24, borderRadius: 12, backgroundColor: C.borderSoft, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  tlDotDone:    { backgroundColor: C.ink },
  tlDotCurrent: { backgroundColor: C.ink, shadowColor: C.ink, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 5 },
  tlLine:       { position: 'absolute', left: '50%', right: '-50%', top: 11, height: 2, backgroundColor: C.border, zIndex: 0 },
  tlLineDone:   { backgroundColor: C.ink },
  tlLabel:      { fontSize: 8, color: C.subtle, marginTop: 4, textAlign: 'center', fontWeight: '500' },
  tlLabelActive:{ color: C.ink, fontWeight: '700', fontSize: 9 },
  driverBadge:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.borderSoft, borderRadius: 10, padding: 12 },
  driverBadgeTxt: { fontSize: 14, fontWeight: '600', color: C.ink },
  chargeRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  chargeLabel:  { fontSize: 13, color: C.inkSoft },
  chargeAmt:    { fontSize: 13, fontWeight: '700', color: C.ink },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, marginTop: 4, borderTopWidth: 1, borderTopColor: C.border },
  totalLabel:   { fontSize: 14, fontWeight: '700', color: C.ink },
  totalAmt:     { fontSize: 16, fontWeight: '800', color: C.ink },
  payRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  payEvent:     { fontSize: 13, fontWeight: '600', color: C.ink },
  payTime:      { fontSize: 11, color: C.subtle, marginTop: 1 },
  payAmt:       { fontSize: 13, fontWeight: '700', color: C.completed },
});

// ─── Booking Card ──────────────────────────────────────────────────────────────
const BookingCard = ({ booking, onPress }) => {
  const color   = STATUS_COLOR[booking.status] || C.muted;
  const vehicle = [booking.vehicles?.year, booking.vehicles?.make, booking.vehicles?.model].filter(Boolean).join(' ');
  const initials = (booking.customer_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <TouchableOpacity style={[bc.card, { borderLeftColor: color }]} onPress={() => onPress(booking)} activeOpacity={0.85}>
      <View style={bc.head}>
        <View style={bc.avatar}>
          <Text style={bc.avatarTxt}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={bc.name}>{booking.customer_name || '—'}</Text>
          {vehicle ? <Text style={bc.vehicle}>{vehicle}</Text> : null}
          {booking.vehicle_variants?.plate_number && (
            <Text style={bc.plate}>{booking.vehicle_variants.plate_number}</Text>
          )}
        </View>
        <View style={[bc.statusPill, { backgroundColor: color + '20' }]}>
          <Text style={[bc.statusTxt, { color }]}>{booking.status}</Text>
        </View>
      </View>

      <View style={bc.meta}>
        <View style={bc.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={C.subtle} />
          <Text style={bc.metaTxt}>{fmtDate(booking.rental_start_date)} — {fmtDate(booking.rental_end_date)}</Text>
        </View>
        <View style={bc.metaRow}>
          <Ionicons name="cash-outline" size={13} color={C.subtle} />
          <Text style={bc.metaTxt}>{fmt(booking.total_price)}</Text>
        </View>
        {booking.delivery_option === 'deliver' && (
          <View style={bc.metaRow}>
            <Ionicons name="car-sport-outline" size={13} color={C.subtle} />
            <Text style={bc.metaTxt}>Delivery{booking.assigned_driver ? ` · ${booking.assigned_driver}` : ' · No driver yet'}</Text>
          </View>
        )}
      </View>

      <View style={bc.footer}>
        <Text style={bc.footerTxt}>Tap to view details</Text>
        <Ionicons name="chevron-forward" size={14} color={C.subtle} />
      </View>
    </TouchableOpacity>
  );
};

const bc = StyleSheet.create({
  card:      { backgroundColor: C.white, borderRadius: 14, padding: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  head:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  avatar:    { width: 38, height: 38, borderRadius: 19, backgroundColor: C.ink, justifyContent: 'center', alignItems: 'center' },
  avatarTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  name:      { fontSize: 15, fontWeight: '700', color: C.ink },
  vehicle:   { fontSize: 12, color: C.muted, marginTop: 2 },
  plate:     { fontSize: 11, color: C.subtle, fontFamily: 'monospace', marginTop: 1 },
  statusPill:{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusTxt: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  meta:      { gap: 4, marginBottom: 8 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaTxt:   { fontSize: 12, color: C.muted },
  footer:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: C.borderSoft },
  footerTxt: { fontSize: 12, color: C.subtle },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function OwnerPortalBookings({ navigation }) {
  const [owner, setOwner]               = useState(null);
  const [allBookings, setAllBookings]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [activeStatus, setActiveStatus] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailVisible, setDetailVisible]     = useState(false);

  // Pagination
  const [currentPage, setCurrentPage]   = useState(1);
  const PAGE_SIZE                       = 10;

  useEffect(() => { init(); }, []);

  const init = async () => {
    setLoading(true);
    try {
      const u = firebaseAuth.getCurrentUser();
      if (!u) return;
      const owners = await carOwnersService.list();
      const me = (owners || []).find(o => o.email === u.email);
      setOwner(me || null);
      if (me) await loadBookings(me.id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadBookings = async (ownerId) => {
    try {
      const allVariants  = await variantsService.list();
      const myVariants   = (allVariants || []).filter(v => v.owner_id === ownerId);
      const myVariantIds = new Set(myVariants.map(v => v.id));
      const myVehicleIds = new Set(myVariants.map(v => v.vehicle_id));

      const allB = await bookingsService.listWithDetails();
      const mine = (allB || []).filter(b =>
        myVariantIds.has(b.vehicle_variant_id) || myVehicleIds.has(b.vehicle_id)
      );
      mine.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setAllBookings(mine);
    } catch (e) { console.error('loadBookings error:', e); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await init();
    setRefreshing(false);
  };

  const TABS = useMemo(() => [
    { key: 'all',       label: 'All',       count: allBookings.length },
    { key: 'pending',   label: 'Pending',   count: allBookings.filter(b => b.status === 'pending').length },
    { key: 'confirmed', label: 'Active',    count: allBookings.filter(b => ['confirmed','ongoing','delivered','retrieved'].includes(b.status)).length },
    { key: 'completed', label: 'Completed', count: allBookings.filter(b => b.status === 'completed').length },
    { key: 'cancelled', label: 'Cancelled', count: allBookings.filter(b => ['cancelled','declined'].includes(b.status)).length },
  ], [allBookings]);

  const filtered = useMemo(() => {
    if (activeStatus === 'all')       return allBookings;
    if (activeStatus === 'confirmed') return allBookings.filter(b => ['confirmed','ongoing','delivered','retrieved'].includes(b.status));
    if (activeStatus === 'cancelled') return allBookings.filter(b => ['cancelled','declined'].includes(b.status));
    return allBookings.filter(b => b.status === activeStatus);
  }, [allBookings, activeStatus]);

  const paginated  = useMemo(() => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [filtered, currentPage]);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleTabChange = (key) => { setActiveStatus(key); setCurrentPage(1); };
  const openDetail = (b) => { setSelectedBooking(b); setDetailVisible(true); };

  // ── Status stats row ──────────────────────────────────────────────────────
  const StatsRow = () => {
    const items = [
      { label: 'Pending',   color: C.pending,   count: allBookings.filter(b => b.status === 'pending').length },
      { label: 'Active',    color: C.confirmed,  count: allBookings.filter(b => ['confirmed','ongoing','delivered','retrieved'].includes(b.status)).length },
      { label: 'Done',      color: C.completed, count: allBookings.filter(b => b.status === 'completed').length },
      { label: 'Cancelled', color: C.cancelled, count: allBookings.filter(b => ['cancelled','declined'].includes(b.status)).length },
    ];
    return (
      <View style={s.statsRow}>
        {items.map(item => (
          <View key={item.label} style={s.statsItem}>
            <Text style={[s.statsCount, { color: item.color }]}>{item.count}</Text>
            <Text style={s.statsLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderFooter = () => {
    if (totalPages <= 1) return null;
    return (
      <View style={s.pagination}>
        <Text style={s.pageInfo}>{filtered.length} bookings · Page {currentPage}/{totalPages}</Text>
        <View style={s.pageControls}>
          <TouchableOpacity style={[s.pageBtn, currentPage === 1 && s.pageBtnOff]} onPress={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <Ionicons name="chevron-back" size={18} color={currentPage === 1 ? C.subtle : C.ink} />
          </TouchableOpacity>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const p = currentPage <= 2 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
            if (p < 1 || p > totalPages) return null;
            return (
              <TouchableOpacity key={p} style={[s.pageNum, currentPage === p && s.pageNumActive]} onPress={() => setCurrentPage(p)}>
                <Text style={[s.pageNumTxt, currentPage === p && s.pageNumTxtActive]}>{p}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[s.pageBtn, currentPage === totalPages && s.pageBtnOff]} onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            <Ionicons name="chevron-forward" size={18} color={currentPage === totalPages ? C.subtle : C.ink} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.white }}>
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>My Bookings</Text>
            <Text style={s.headerSub}>{allBookings.length} booking{allBookings.length !== 1 ? 's' : ''} for your vehicles</Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={onRefresh}>
            <Ionicons name="refresh-outline" size={20} color={C.ink} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Stats Row */}
      <StatsRow />

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeStatus === tab.key && s.tabActive]}
            onPress={() => handleTabChange(tab.key)}
          >
            <Text style={[s.tabTxt, activeStatus === tab.key && s.tabTxtActive]}>{tab.label}</Text>
            <View style={[s.tabBadge, activeStatus === tab.key && s.tabBadgeActive]}>
              <Text style={[s.tabBadgeTxt, activeStatus === tab.key && s.tabBadgeTxtActive]}>{tab.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={paginated}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <BookingCard booking={item} onPress={openDetail} />}
        contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading || refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={52} color="#d1d5db" />
            <Text style={s.emptyTitle}>No {activeStatus === 'all' ? '' : activeStatus} bookings</Text>
            <Text style={s.emptyTxt}>{activeStatus === 'all' ? 'No bookings have been made for your vehicles yet' : `No ${activeStatus} bookings found`}</Text>
          </View>
        }
        ListFooterComponent={renderFooter}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      <BookingDetailModal
        visible={detailVisible}
        booking={selectedBooking}
        onClose={() => { setDetailVisible(false); setSelectedBooking(null); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.surface },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 24, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  headerSub:   { fontSize: 12, color: C.muted, marginTop: 2 },
  refreshBtn:  { padding: 8, borderRadius: 8, backgroundColor: C.borderSoft },

  statsRow:    { flexDirection: 'row', backgroundColor: C.white, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  statsItem:   { flex: 1, alignItems: 'center' },
  statsCount:  { fontSize: 22, fontWeight: '800' },
  statsLabel:  { fontSize: 10, color: C.muted, fontWeight: '600', marginTop: 2 },

  tabBar:      { backgroundColor: C.white, maxHeight: 56, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.borderSoft, borderWidth: 1, borderColor: C.border },
  tabActive:   { backgroundColor: C.ink, borderColor: C.ink },
  tabTxt:      { fontSize: 13, fontWeight: '600', color: C.muted },
  tabTxtActive:{ color: '#fff' },
  tabBadge:    { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.border, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeTxt:    { fontSize: 10, fontWeight: '700', color: C.muted },
  tabBadgeTxtActive: { color: '#fff' },

  empty:       { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: C.inkSoft, marginTop: 16, marginBottom: 8, textTransform: 'capitalize' },
  emptyTxt:    { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },

  pagination:   { backgroundColor: C.white, borderRadius: 12, margin: 14, padding: 14, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.border },
  pageInfo:     { fontSize: 12, color: C.muted, fontWeight: '500' },
  pageControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageBtn:      { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  pageBtnOff:   { borderColor: C.borderSoft, backgroundColor: C.surface },
  pageNum:      { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  pageNumActive:{ backgroundColor: C.ink, borderColor: C.ink },
  pageNumTxt:   { fontSize: 13, fontWeight: '600', color: C.inkSoft },
  pageNumTxtActive: { color: '#fff' },
});