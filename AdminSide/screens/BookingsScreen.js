import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, Alert,
  TouchableOpacity, Modal, TextInput, ScrollView, Dimensions,
  SafeAreaView, Animated, RefreshControl, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import {
  bookingsService, variantsService, firebaseAuth,
  getRoleSync, appUsersService,
} from '../services/firebaseService';
import ActionModal from '../components/AlertModal/ActionModal';
import EditBookingModal from '../components/BookingScreen/EditBookingModal';
import AddBookingModal from '../components/BookingScreen/AddBookingModal';
import EmailService from '../services/emailService';

const { width } = Dimensions.get('window');

// ─── Status config — matches DriverDashboard exactly ──────────────────────────
const STATUS_COLOR = {
  pending:   '#f59e0b',
  confirmed: '#3b82f6',
  ongoing:   '#8b5cf6',
  delivered: '#ec4899',
  retrieved: '#06b6d4',
  completed: '#10b981',
  cancelled: '#ef4444',
  declined:  '#f97316',
};

const fmt     = (v) => `₱${parseFloat(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const fmtDate = (d) => !d ? '—' : new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

// ─── Status flow ───────────────────────────────────────────────────────────────
const STATUS_FLOW = {
  pending:   ['confirmed', 'declined', 'cancelled'],
  confirmed: ['ongoing', 'cancelled'],
  ongoing:   ['delivered', 'cancelled'],
  delivered: ['retrieved'],
  retrieved: ['completed'],
  completed: [],
  cancelled: [],
  declined:  [],
};

const ALL_STATUSES = ['pending', 'confirmed', 'ongoing', 'delivered', 'retrieved', 'completed', 'cancelled', 'declined'];

// Statuses that mean inventory is currently reserved/in-use
const INVENTORY_RESERVED_STATUSES = ['confirmed', 'ongoing', 'delivered', 'retrieved'];

// ─── Driver Status Timeline ────────────────────────────────────────────────────
const DriverStatusTimeline = ({ booking }) => {
  const steps = [
    { key: 'confirmed', label: 'Confirmed', icon: 'checkmark-circle' },
    { key: 'ongoing',   label: 'Ongoing',   icon: 'car'              },
    { key: 'delivered', label: 'Delivered', icon: 'location'         },
    { key: 'retrieved', label: 'Retrieved', icon: 'return-up-back'   },
    { key: 'completed', label: 'Completed', icon: 'flag'             },
  ];
  const statusOrder  = ['confirmed', 'ongoing', 'delivered', 'retrieved', 'completed'];
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
                <Ionicons name={step.icon} size={11} color={isDone ? '#fff' : '#9ca3af'} />
              </View>
              <Text style={[tlS.label, isDone && tlS.labelDone, isCurrent && tlS.labelCurrent]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
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
            <View style={[tlS.pill, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="flame-outline" size={11} color="#d97706" />
              <Text style={[tlS.pillTxt, { color: '#d97706' }]}>Fuel {fmt(booking.fuel_charge)}</Text>
            </View>
          )}
          {booking.delay_charge > 0 && (
            <View style={[tlS.pill, { backgroundColor: '#fce7f3' }]}>
              <Ionicons name="time-outline" size={11} color="#db2777" />
              <Text style={[tlS.pillTxt, { color: '#db2777' }]}>Delay {fmt(booking.delay_charge)}</Text>
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
                <Text style={tlS.payTime}>{new Date(e.recorded_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={tlS.payAmt}>{fmt(e.amount)}</Text>
            </View>
          ))}
          <View style={tlS.payTotal}>
            <Text style={tlS.payTotalL}>Total Collected</Text>
            <Text style={tlS.payTotalV}>{fmt(booking.payment_log.reduce((s, e) => s + parseFloat(e.amount || 0), 0))}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const tlS = StyleSheet.create({
  container:  { backgroundColor: '#f8fafc', borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  title:      { fontSize: 11, fontWeight: '700', color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  row:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  stepCol:    { flex: 1, alignItems: 'center', position: 'relative' },
  line:       { position: 'absolute', left: '-50%', right: '50%', top: 11, height: 2, backgroundColor: '#e5e7eb', zIndex: 0 },
  lineDone:   { backgroundColor: '#111827' },
  dot:        { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', zIndex: 1, marginBottom: 3 },
  dotDone:    { backgroundColor: '#111827' },
  dotCurrent: { backgroundColor: '#111827', shadowColor: '#111827', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 5, elevation: 4 },
  label:      { fontSize: 8, color: '#9ca3af', textAlign: 'center', fontWeight: '500' },
  labelDone:  { color: '#374151' },
  labelCurrent:  { color: '#111827', fontWeight: '700' },
  driverBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', marginTop: 6 },
  driverText:    { fontSize: 12, color: '#111827', fontWeight: '600' },
  pills:         { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
  pill:          { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  pillTxt:       { fontSize: 11, fontWeight: '600' },
  paySection:    { marginTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8 },
  payTitle:      { fontSize: 10, fontWeight: '700', color: '#374151', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  payRow:        { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  payEvent:      { fontSize: 12, color: '#1f2937', fontWeight: '500' },
  payTime:       { fontSize: 10, color: '#9ca3af', marginTop: 1 },
  payAmt:        { fontSize: 12, color: '#059669', fontWeight: '700' },
  payTotal:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  payTotalL:     { fontSize: 12, fontWeight: '700', color: '#111827' },
  payTotalV:     { fontSize: 14, fontWeight: '800', color: '#059669' },
});

// ─── Assign Driver Modal ───────────────────────────────────────────────────────
const AssignDriverModal = ({ visible, booking, onClose, onAssign, drivers }) => {
  const [saving, setSaving]                     = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState(null);

  useEffect(() => {
    if (!booking || !drivers?.length) { setSelectedDriverId(null); return; }
    if (booking.assigned_driver_id) {
      const m = drivers.find(d => d.id === booking.assigned_driver_id);
      if (m) { setSelectedDriverId(m.id); return; }
    }
    if (booking.assigned_driver) {
      const target = booking.assigned_driver.toLowerCase().trim();
      const m = drivers.find(d =>
        (d.full_name || '').toLowerCase().trim() === target ||
        (d.email || '').toLowerCase().trim() === target
      );
      if (m) { setSelectedDriverId(m.id); return; }
    }
    setSelectedDriverId(null);
  }, [booking, drivers]);

  const handleAssign = async () => {
    const driver = drivers.find(d => d.id === selectedDriverId);
    if (!driver) { Alert.alert('Required', 'Please select a driver.'); return; }
    setSaving(true);
    await onAssign(booking.id, driver);
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={adS.overlay}>
        <View style={adS.container}>
          <View style={adS.header}>
            <View style={adS.icon}><Ionicons name="person-add" size={20} color="#111827" /></View>
            <View style={{ flex: 1 }}>
              <Text style={adS.title}>Assign Driver</Text>
              {booking && <Text style={adS.sub}>{booking.customer_name} · {booking.vehicles?.make} {booking.vehicles?.model}</Text>}
            </View>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color="#6b7280" /></TouchableOpacity>
          </View>
          <View style={adS.body}>
            <Text style={adS.label}>Select Driver</Text>
            {!drivers?.length ? (
              <View style={adS.noDriver}>
                <Ionicons name="alert-circle-outline" size={16} color="#92400e" />
                <Text style={adS.noDriverTxt}>No active drivers found.</Text>
              </View>
            ) : (
              <ScrollView style={adS.list} nestedScrollEnabled>
                {drivers.map(d => {
                  const sel  = d.id === selectedDriverId;
                  const name = d.full_name || d.email;
                  return (
                    <TouchableOpacity key={d.id} style={[adS.driverRow, sel && adS.driverRowSel]} onPress={() => setSelectedDriverId(d.id)}>
                      <View style={adS.avatar}><Text style={adS.avatarTxt}>{(name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={adS.driverName}>{name}</Text>
                        {d.email && <Text style={adS.driverEmail}>{d.email}</Text>}
                      </View>
                      <View style={[adS.radio, sel && adS.radioSel]}>{sel && <View style={adS.radioDot} />}</View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
          <View style={adS.footer}>
            <TouchableOpacity style={adS.cancelBtn} onPress={onClose}><Text style={adS.cancelTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={adS.assignBtn} onPress={handleAssign} disabled={saving || !drivers?.length}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : (
                <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={adS.assignTxt}>{booking?.assigned_driver ? 'Reassign' : 'Assign'}</Text></>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const adS = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  container:   { backgroundColor: '#fff', borderRadius: 16, width: '100%', maxWidth: 400, elevation: 12 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  icon:        { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  title:       { fontSize: 17, fontWeight: '700', color: '#111827' },
  sub:         { fontSize: 13, color: '#6b7280', marginTop: 2 },
  body:        { padding: 20 },
  label:       { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  list:        { maxHeight: 260, marginBottom: 8 },
  driverRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10 },
  driverRowSel:{ backgroundColor: '#f3f4f6' },
  avatar:      { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  avatarTxt:   { fontSize: 13, fontWeight: '700', color: '#111827' },
  driverName:  { fontSize: 14, fontWeight: '600', color: '#111827' },
  driverEmail: { fontSize: 12, color: '#6b7280', marginTop: 1 },
  radio:       { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#d1d5db', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  radioSel:    { borderColor: '#111827' },
  radioDot:    { width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#111827' },
  noDriver:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, backgroundColor: '#fffbeb', borderRadius: 8, borderWidth: 1, borderColor: '#fed7aa', marginBottom: 8 },
  noDriverTxt: { flex: 1, fontSize: 12, color: '#92400e' },
  footer:      { flexDirection: 'row', gap: 12, padding: 20, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  cancelBtn:   { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  cancelTxt:   { fontSize: 15, fontWeight: '600', color: '#374151' },
  assignBtn:   { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  assignTxt:   { fontSize: 15, fontWeight: '700', color: '#fff' },
});

// ─── Status Change Modal ───────────────────────────────────────────────────────
const StatusModal = ({ visible, booking, onClose, onUpdate, loading }) => {
  const [declineReason, setDeclineReason] = useState('');
  const current     = booking?.status || 'pending';
  const nextOptions = STATUS_FLOW[current] || [];

  useEffect(() => { if (visible) setDeclineReason(''); }, [visible]);

  const handleSelect = (newStatus) => {
    if (newStatus === 'declined' && !declineReason.trim()) {
      Alert.alert('Required', 'Please enter a decline reason.'); return;
    }
    onUpdate(booking.id, newStatus, declineReason);
  };

  const statusLabel = {
    confirmed: '✅ Confirm Booking',
    ongoing:   '🚗 Mark Ongoing',
    delivered: '📦 Mark Delivered',
    retrieved: '🔁 Mark Retrieved',
    completed: '🏁 Mark Completed',
    cancelled: '🚫 Cancel Booking',
    declined:  '❌ Decline Booking',
  };

  const statusDesc = {
    confirmed: 'Accept this booking and assign a driver.',
    ongoing:   'Driver is en route to deliver the vehicle.',
    delivered: 'Vehicle has been delivered to customer.',
    retrieved: 'Vehicle has been retrieved from customer.',
    completed: 'Booking is fully settled and done.',
    cancelled: 'Cancel this booking.',
    declined:  'Decline this booking request.',
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={stS.overlay}>
        <View style={stS.sheet}>
          <View style={stS.handle} />
          <View style={stS.header}>
            <View>
              <Text style={stS.title}>Change Status</Text>
              <Text style={stS.sub}>{booking?.customer_name} · Current: <Text style={{ color: STATUS_COLOR[current] || '#6b7280', fontWeight: '700' }}>{current}</Text></Text>
            </View>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#374151" /></TouchableOpacity>
          </View>

          <ScrollView style={stS.body} showsVerticalScrollIndicator={false}>
            {nextOptions.length === 0 ? (
              <View style={stS.noOptions}>
                <Ionicons name="checkmark-circle" size={32} color="#6b7280" />
                <Text style={stS.noOptionsTxt}>No further status changes available.</Text>
              </View>
            ) : (
              nextOptions.map(status => (
                <View key={status}>
                  <TouchableOpacity
                    style={[stS.option, { borderColor: STATUS_COLOR[status] + '44', backgroundColor: STATUS_COLOR[status] + '0d' }]}
                    onPress={() => handleSelect(status)}
                    disabled={loading}
                  >
                    <View style={[stS.optionDot, { backgroundColor: STATUS_COLOR[status] }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[stS.optionLabel, { color: STATUS_COLOR[status] }]}>{statusLabel[status] || status}</Text>
                      <Text style={stS.optionDesc}>{statusDesc[status] || ''}</Text>
                    </View>
                    {loading ? <ActivityIndicator size="small" color={STATUS_COLOR[status]} /> : <Ionicons name="chevron-forward" size={18} color={STATUS_COLOR[status]} />}
                  </TouchableOpacity>

                  {status === 'declined' && (
                    <View style={stS.declineInput}>
                      <Text style={stS.declineLabel}>Decline Reason</Text>
                      <TextInput
                        style={stS.declineBox}
                        value={declineReason}
                        onChangeText={setDeclineReason}
                        placeholder="Enter reason for declining..."
                        placeholderTextColor="#9ca3af"
                        multiline
                      />
                    </View>
                  )}
                </View>
              ))
            )}

            <View style={stS.divider} />
            <Text style={stS.overrideLabel}>Admin Override</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={stS.overrideRow}>
              {ALL_STATUSES.filter(s => s !== current).map(status => (
                <TouchableOpacity
                  key={status}
                  style={[stS.chip, { backgroundColor: STATUS_COLOR[status] + '22', borderColor: STATUS_COLOR[status] + '66' }]}
                  onPress={() => onUpdate(booking.id, status, '')}
                  disabled={loading}
                >
                  <Text style={[stS.chipTxt, { color: STATUS_COLOR[status] }]}>{status}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const stS = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingBottom: 30 },
  handle:       { width: 40, height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  title:        { fontSize: 18, fontWeight: '800', color: '#111827' },
  sub:          { fontSize: 13, color: '#6b7280', marginTop: 2 },
  body:         { padding: 16 },
  option:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 14, borderWidth: 1.5, marginBottom: 10 },
  optionDot:    { width: 10, height: 10, borderRadius: 5 },
  optionLabel:  { fontSize: 15, fontWeight: '700' },
  optionDesc:   { fontSize: 12, color: '#6b7280', marginTop: 2 },
  noOptions:    { alignItems: 'center', paddingVertical: 30, gap: 10 },
  noOptionsTxt: { fontSize: 15, color: '#6b7280', textAlign: 'center' },
  declineInput: { marginBottom: 10, marginTop: -4, paddingHorizontal: 4 },
  declineLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6, textTransform: 'uppercase' },
  declineBox:   { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827', height: 80, textAlignVertical: 'top' },
  divider:      { height: 1, backgroundColor: '#f3f4f6', marginVertical: 12 },
  overrideLabel:{ fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  overrideRow:  { flexDirection: 'row', gap: 8, paddingBottom: 4 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipTxt:      { fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
});

// ─── Booking Card ──────────────────────────────────────────────────────────────
const BookingCard = ({ booking, activeTab, onStatusPress, onAssignPress, onCardPress }) => {
  const status      = booking.status || 'pending';
  const color       = STATUS_COLOR[status] || '#6b7280';
  const isDelivery  = booking.delivery_option === 'deliver' || ['ongoing','delivered','retrieved','completed'].includes(status);
  const driverStats = ['confirmed','ongoing','delivered','retrieved','completed'];
  const showTimeline = activeTab === 'delivery' && isDelivery && driverStats.includes(status);
  const plate        = booking.vehicle_variants?.plate_number;
  const vehicleLine  = [booking.vehicles?.year, booking.vehicles?.make, booking.vehicles?.model].filter(Boolean).join(' ');
  const totalPaid    = (booking.payment_log || []).reduce((a, e) => a + (Number(e.amount) || 0), 0);

  return (
    <TouchableOpacity style={[cardS.card, { borderLeftColor: color }]} onPress={() => onCardPress(booking)} activeOpacity={0.85}>

      <View style={cardS.head}>
        <View style={cardS.avatar}>
          <Text style={cardS.avatarTxt}>{(booking.customer_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={cardS.name}>{booking.customer_name || '—'}</Text>
          {vehicleLine ? <Text style={cardS.vehicle}>{vehicleLine}</Text> : null}
        </View>
        <TouchableOpacity
          style={[cardS.statusPill, { backgroundColor: color + '22' }]}
          onPress={(e) => { e.stopPropagation(); onStatusPress(booking); }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[cardS.statusTxt, { color }]}>{status}</Text>
          <Ionicons name="chevron-down" size={11} color={color} />
        </TouchableOpacity>
      </View>

      <View style={cardS.pillRow}>
        {plate && (
          <View style={cardS.pill}>
            <Ionicons name="car-outline" size={11} color="#374151" />
            <Text style={cardS.pillTxt}>{plate}</Text>
          </View>
        )}
        {booking.license_number && (
          <View style={cardS.pill}>
            <Ionicons name="id-card-outline" size={11} color="#6b7280" />
            <Text style={cardS.pillTxt}>Lic: {booking.license_number}</Text>
          </View>
        )}
        {booking.vehicle_variants?.color && (
          <View style={cardS.pill}>
            <Ionicons name="color-palette-outline" size={11} color="#6b7280" />
            <Text style={cardS.pillTxt}>{booking.vehicle_variants.color}</Text>
          </View>
        )}
      </View>

      <View style={cardS.row}>
        <Ionicons name="calendar-outline" size={13} color="#9ca3af" />
        <Text style={cardS.rowTxt}>{fmtDate(booking.rental_start_date)} → {fmtDate(booking.rental_end_date)}</Text>
      </View>

      {(booking.delivery_address || booking.pickup_location) && (
        <View style={cardS.row}>
          <Ionicons name="location-outline" size={13} color="#db2777" />
          <Text style={[cardS.rowTxt, { color: '#db2777' }]} numberOfLines={1}>{booking.delivery_address || booking.pickup_location}</Text>
        </View>
      )}

      <View style={cardS.row}>
        <Ionicons name="cash-outline" size={13} color="#9ca3af" />
        <Text style={cardS.rowTxt}>{fmt(booking.total_price)}</Text>
      </View>

      <View style={cardS.driverRow}>
        <Ionicons name="person-circle-outline" size={14} color="#374151" />
        {booking.assigned_driver
          ? <Text style={cardS.driverTxt}>Driver: <Text style={{ fontWeight: '700', color: '#111827' }}>{booking.assigned_driver}</Text></Text>
          : <Text style={cardS.noDriver}>No driver assigned</Text>
        }
      </View>

      {(booking.fuel_charge > 0 || booking.delay_charge > 0 || booking.damage_fee > 0) && (
        <View style={cardS.chargePills}>
          {booking.fuel_charge  > 0 && <View style={cardS.cpill}><Text style={cardS.cpillTxt}>⛽ {fmt(booking.fuel_charge)}</Text></View>}
          {booking.delay_charge > 0 && <View style={[cardS.cpill, { backgroundColor: '#fce7f3' }]}><Text style={[cardS.cpillTxt, { color: '#db2777' }]}>⏰ {fmt(booking.delay_charge)}</Text></View>}
          {booking.damage_fee   > 0 && <View style={[cardS.cpill, { backgroundColor: '#fee2e2' }]}><Text style={[cardS.cpillTxt, { color: '#b91c1c' }]}>🔧 {fmt(booking.damage_fee)}</Text></View>}
        </View>
      )}

      {showTimeline && <DriverStatusTimeline booking={booking} />}

      {totalPaid > 0 && (
        <View style={cardS.totalPaid}>
          <Text style={cardS.totalPaidL}>Total Collected</Text>
          <Text style={cardS.totalPaidV}>{fmt(totalPaid)}</Text>
        </View>
      )}

      <View style={cardS.actions}>
        <TouchableOpacity
          style={cardS.actionBtn}
          onPress={(e) => { e.stopPropagation(); onStatusPress(booking); }}
        >
          <Ionicons name="swap-vertical-outline" size={14} color="#374151" />
          <Text style={cardS.actionTxt}>Status</Text>
        </TouchableOpacity>

        {isDelivery && status !== 'completed' && status !== 'cancelled' && status !== 'declined' && (
          <TouchableOpacity
            style={[cardS.actionBtn, booking.assigned_driver && cardS.actionBtnAlt]}
            onPress={(e) => { e.stopPropagation(); onAssignPress(booking); }}
          >
            <Ionicons name={booking.assigned_driver ? 'swap-horizontal' : 'person-add'} size={14} color="#374151" />
            <Text style={cardS.actionTxt}>{booking.assigned_driver ? 'Reassign' : 'Assign Driver'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[cardS.actionBtn, cardS.actionBtnDark]} onPress={() => onCardPress(booking)}>
          <Ionicons name="create-outline" size={14} color="#fff" />
          <Text style={[cardS.actionTxt, { color: '#fff' }]}>Edit</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const cardS = StyleSheet.create({
  card:        { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3, marginHorizontal: 16 },
  head:        { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  avatarTxt:   { fontSize: 14, fontWeight: '700', color: '#374151' },
  name:        { fontSize: 16, fontWeight: '700', color: '#111827' },
  vehicle:     { fontSize: 13, color: '#374151', marginTop: 2 },
  statusPill:  { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusTxt:   { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  pillRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  pill:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3f4f6', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pillTxt:     { fontSize: 11, color: '#374151', fontWeight: '600' },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  rowTxt:      { fontSize: 13, color: '#6b7280', flex: 1 },
  driverRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  driverTxt:   { fontSize: 13, color: '#374151' },
  noDriver:    { fontSize: 12, color: '#f59e0b', fontWeight: '600' },
  chargePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  cpill:       { backgroundColor: '#fffbeb', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  cpillTxt:    { fontSize: 12, fontWeight: '600', color: '#92400e' },
  totalPaid:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#86efac' },
  totalPaidL:  { fontSize: 13, fontWeight: '600', color: '#166534' },
  totalPaidV:  { fontSize: 15, fontWeight: '800', color: '#15803d' },
  actions:     { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 9, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  actionBtnAlt:{ backgroundColor: '#f9fafb' },
  actionBtnDark:{ backgroundColor: '#111827', borderColor: '#111827' },
  actionTxt:   { fontSize: 12, fontWeight: '600', color: '#374151' },
});

// ─── Main BookingsScreen ───────────────────────────────────────────────────────
export default function BookingsScreen({ route, navigation }) {
  const [bookings, setBookings]                 = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [selectedBooking, setSelectedBooking]   = useState(null);

  // Modals
  const [editModalVisible, setEditModalVisible]   = useState(false);
  const [addModalVisible, setAddModalVisible]     = useState(false);
  const [statusModal, setStatusModal]             = useState({ visible: false, booking: null });
  const [assignModal, setAssignModal]             = useState({ visible: false, booking: null });
  const [feedbackModal, setFeedbackModal]         = useState({ visible: false, type: 'success', message: '' });
  const [actionModalConfig, setActionModalConfig] = useState(null);
  const [statusLoading, setStatusLoading]         = useState(false);

  // Filters & pagination
  const [activeTab, setActiveTab]                 = useState('all');
  const [listStatusFilter, setListStatusFilter]   = useState('All');
  const [listDateFilter, setListDateFilter]       = useState('All');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('All');
  const [currentPage, setCurrentPage]             = useState(1);
  const ITEMS_PER_PAGE                            = 8;

  // Dropdowns
  const [statusDropdownVisible, setStatusDropdownVisible]           = useState(false);
  const [dateDropdownVisible, setDateDropdownVisible]               = useState(false);
  const [vehicleTypeDropdownVisible, setVehicleTypeDropdownVisible] = useState(false);

  const [availableVehicles, setAvailableVehicles] = useState([]);
  const [vehicleTypes, setVehicleTypes]           = useState([]);
  const [drivers, setDrivers]                     = useState([]);
  const [lastRefreshed, setLastRefreshed]         = useState(null);

  const modalAnimation    = useState(new Animated.Value(0))[0];
  const addModalAnimation = useState(new Animated.Value(0))[0];

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchBookings();
    fetchAvailableVehicles();
    fetchDrivers();
    const iv = setInterval(() => fetchBookings(true), 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (route?.params?.openBookingId && bookings.length > 0) {
      const t = bookings.find(b => b.id === route.params.openBookingId);
      if (t && !editModalVisible) setTimeout(() => openEditModal(t), 200);
    }
  }, [bookings, route?.params]);

  useEffect(() => { applyFilters(); }, [bookings, activeTab, listStatusFilter, listDateFilter, vehicleTypeFilter]);
  useEffect(() => { if (currentPage > totalPages && totalPages > 0) setCurrentPage(1); }, [filteredBookings]);

  const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE);

  // ── Fetchers ──────────────────────────────────────────────────────────────
  const fetchBookings = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await bookingsService.listWithDetails();
      setBookings(data || []);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error(e);
      if (!silent) Alert.alert('Error', 'Could not load bookings.');
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAvailableVehicles = async () => {
    try {
      const data = await variantsService.listAvailableWithVehicles();
      setAvailableVehicles(data || []);
      setVehicleTypes([...new Set((data || []).map(v => v.vehicles?.type).filter(Boolean))]);
    } catch (e) { console.error(e); }
  };

  const fetchDrivers = async () => {
    try {
      const list = await appUsersService.listByOwner();
      setDrivers((list || []).filter(u => u.role === 'driver' && u.status === 'active'));
    } catch (e) { console.error(e); }
  };

  // ── Filter ────────────────────────────────────────────────────────────────
  const isDeliveryBooking = (b) =>
    b.delivery_option === 'deliver' ||
    ['ongoing','delivered','retrieved','completed'].includes(b.status);

  const applyFilters = () => {
    let list = [...bookings];
    const now = new Date();

    if (activeTab === 'delivery') list = list.filter(isDeliveryBooking);
    if (listStatusFilter !== 'All') list = list.filter(b => b.status === listStatusFilter);
    if (vehicleTypeFilter !== 'All') list = list.filter(b => b.vehicles?.type === vehicleTypeFilter);

    switch (listDateFilter) {
      case 'Today':      list = list.filter(b => new Date(b.created_at).toDateString() === now.toDateString()); break;
      case 'This Week':  { const s = new Date(now); s.setDate(now.getDate() - now.getDay()); list = list.filter(b => new Date(b.created_at) >= s); break; }
      case 'This Month': list = list.filter(b => new Date(b.created_at) >= new Date(now.getFullYear(), now.getMonth(), 1)); break;
      case 'This Year':  list = list.filter(b => new Date(b.created_at) >= new Date(now.getFullYear(), 0, 1)); break;
      case 'Recent':     list = list.filter(b => new Date(b.created_at) >= new Date(now - 7 * 86400000)); break;
    }

    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setFilteredBookings(list);
    setCurrentPage(1);
  };

  // ── Inventory adjustment helper ───────────────────────────────────────────
  // Rules:
  //   non-active (pending/declined/cancelled) → confirmed : deduct 1 (first reservation)
  //   active (confirmed/ongoing/delivered/retrieved) → terminal (completed/cancelled/declined/pending) : restore 1
  //   active → active : 0 (unit already reserved, no double-deduct)
  const computeInventoryAdjustment = (oldStatus, newStatus) => {
    const terminals  = ['completed', 'cancelled', 'declined', 'pending'];
    const wasActive  = INVENTORY_RESERVED_STATUSES.includes(oldStatus);
    const willActive = INVENTORY_RESERVED_STATUSES.includes(newStatus);

    if (!wasActive && newStatus === 'confirmed') return -1; // newly confirming
    if (wasActive && terminals.includes(newStatus))  return +1; // releasing reservation
    return 0; // active→active or terminal→terminal: no change
  };

  // ── Status update — Firebase write is ALWAYS first ────────────────────────
  const handleStatusUpdate = async (bookingId, newStatus, declineReason = '') => {
    setStatusLoading(true);
    try {
      const existing = bookings.find(b => b.id === bookingId);
      if (!existing) throw new Error('Booking not found');

      const oldStatus = existing.status;
      if (oldStatus === newStatus) {
        setStatusModal({ visible: false, booking: null });
        setStatusLoading(false);
        return;
      }

      const variantId          = existing.vehicle_variant_id;
      const quantityAdjustment = computeInventoryAdjustment(oldStatus, newStatus);

      // ── Step 1: Build payload and write to Firebase IMMEDIATELY ───────────
      // This always runs — no inventory check can block it.
      const updatePayload = {
        status:     newStatus,
        updated_at: new Date().toISOString(),
        ...(declineReason ? { decline_reason: declineReason } : {}),
        // Preserve driver assignment so DriverDashboard isMine() keeps matching
        ...(existing.assigned_driver       ? { assigned_driver:       existing.assigned_driver }       : {}),
        ...(existing.assigned_driver_id    ? { assigned_driver_id:    existing.assigned_driver_id }    : {}),
        ...(existing.assigned_driver_email ? { assigned_driver_email: existing.assigned_driver_email } : {}),
      };

      await bookingsService.update(bookingId, updatePayload);

      // Optimistic local update immediately after Firebase write succeeds
      setBookings(prev => prev.map(b =>
        b.id === bookingId
          ? { ...b, ...updatePayload }
          : b
      ));

      // ── Step 2: Adjust inventory (best-effort, non-blocking) ──────────────
      if (quantityAdjustment !== 0 && variantId) {
        try {
          await variantsService.adjustQuantity(variantId, quantityAdjustment);
        } catch (invErr) {
          // Inventory failed but status already saved — log and warn, do NOT revert
          console.warn('Inventory adjustment failed (status already updated):', invErr);
        }
      }

      // ── Step 3: Refresh vehicles if a slot was freed ──────────────────────
      if (['completed', 'cancelled', 'declined'].includes(newStatus)) fetchAvailableVehicles();

      // ── Step 4: Email notification (non-fatal) ────────────────────────────
      if (existing.customer_email) {
        try {
          await EmailService.sendStatusUpdateEmail({
            ...existing,
            newStatus,
            bookingId,
            vehicleMake:    existing.vehicles?.make  || 'N/A',
            vehicleModel:   existing.vehicles?.model || 'N/A',
            vehicleYear:    existing.vehicles?.year  || 'N/A',
            updated_date:   new Date().toISOString(),
            decline_reason: newStatus === 'declined' ? declineReason : null,
          }, newStatus);
        } catch { /* non-fatal */ }
      }

      setStatusModal({ visible: false, booking: null });
      setFeedbackModal({
        visible: true,
        type: 'success',
        message: `Status updated to "${newStatus}"${existing.customer_email ? ' & customer notified' : ''}.`,
      });
    } catch (err) {
      console.error('Status update error:', err);
      setFeedbackModal({ visible: true, type: 'error', message: err?.message || 'Status update failed. Please try again.' });
    } finally {
      setStatusLoading(false);
    }
  };

  // ── Assign Driver ─────────────────────────────────────────────────────────
  const handleAssignDriver = async (bookingId, driver) => {
    try {
      const displayName = driver.full_name || driver.email;
      await bookingsService.update(bookingId, {
        assigned_driver:       displayName,
        assigned_driver_id:    driver.id,
        assigned_driver_email: driver.email || '',
      });
      setBookings(prev => prev.map(b =>
        b.id === bookingId
          ? { ...b, assigned_driver: displayName, assigned_driver_id: driver.id, assigned_driver_email: driver.email || '' }
          : b
      ));
      setFeedbackModal({ visible: true, type: 'success', message: `Driver "${displayName}" assigned!` });
    } catch {
      setFeedbackModal({ visible: true, type: 'error', message: 'Failed to assign driver.' });
    }
  };

  // ── Delete / Edit ─────────────────────────────────────────────────────────
  const deleteBooking = async (bookingId) => {
    try {
      const b = await bookingsService.getById(bookingId);
      if (b?.status === 'confirmed' && b.vehicle_variant_id)
        await variantsService.adjustQuantity(b.vehicle_variant_id, +1);
      await bookingsService.delete(bookingId);
      await fetchBookings();
      await fetchAvailableVehicles();
      closeEditModal();
      setFeedbackModal({ visible: true, type: 'success', message: 'Booking deleted.' });
    } catch { setFeedbackModal({ visible: true, type: 'error', message: 'Delete failed.' }); }
  };

  const updateBooking = async (updatedBooking) => {
    try {
      const existing = await bookingsService.getById(updatedBooking.id);
      if (!existing) { setFeedbackModal({ visible: true, type: 'error', message: 'Booking not found.' }); return; }

      if (updatedBooking.status === 'declined' && !updatedBooking.decline_reason?.trim()) {
        setFeedbackModal({ visible: true, type: 'error', message: 'Please provide a decline reason.' }); return;
      }

      const oldStatus = existing.status;
      const newStatus = updatedBooking.status;
      const variantId = updatedBooking.vehicle_variant_id || existing.vehicle_variant_id;
      const q         = computeInventoryAdjustment(oldStatus, newStatus);

      // ── Step 1: Write ALL fields to Firebase FIRST — no inventory pre-checks ──
      await bookingsService.update(updatedBooking.id, {
        customer_name:      updatedBooking.customer_name,
        customer_email:     updatedBooking.customer_email,
        customer_phone:     updatedBooking.customer_phone,
        rental_start_date:  updatedBooking.rental_start_date,
        rental_end_date:    updatedBooking.rental_end_date,
        total_price:        updatedBooking.total_price,
        pickup_location:    updatedBooking.pickup_location,
        license_number:     updatedBooking.license_number,
        vehicle_id:         updatedBooking.vehicle_id,
        vehicle_variant_id: updatedBooking.vehicle_variant_id,
        status:             newStatus,
        gov_id_url:         updatedBooking.gov_id_url,
        decline_reason:     updatedBooking.decline_reason || null,
        assigned_driver:    updatedBooking.assigned_driver || null,
        updated_at:         new Date().toISOString(),
      });

      // ── Step 2: Adjust inventory best-effort ──────────────────────────────
      if (q !== 0 && variantId) {
        try { await variantsService.adjustQuantity(variantId, q); }
        catch (invErr) {
          console.warn('Inventory adjustment failed (booking already saved):', invErr);
        }
      }

      await fetchBookings();
      await fetchAvailableVehicles();
      closeEditModal();

      // ── Step 3: Email (non-fatal) ─────────────────────────────────────────
      if (oldStatus !== newStatus && updatedBooking.customer_email) {
        try {
          await EmailService.sendStatusUpdateEmail({
            ...updatedBooking, newStatus, bookingId: updatedBooking.id,
            vehicleMake:    updatedBooking.vehicles?.make  || existing.vehicles?.make  || 'N/A',
            vehicleModel:   updatedBooking.vehicles?.model || existing.vehicles?.model || 'N/A',
            vehicleYear:    updatedBooking.vehicles?.year  || existing.vehicles?.year  || 'N/A',
            variantColor:   updatedBooking.vehicle_variants?.color || existing.vehicle_variants?.color || null,
            updated_date:   new Date().toISOString(),
            decline_reason: newStatus === 'declined' ? updatedBooking.decline_reason : null,
          }, newStatus);
          setFeedbackModal({ visible: true, type: 'success', message: 'Booking updated & customer notified!' });
        } catch (emailErr) {
          console.error('Email error:', emailErr);
          setFeedbackModal({ visible: true, type: 'success', message: 'Booking updated (email notification failed).' });
        }
      } else {
        setFeedbackModal({ visible: true, type: 'success', message: 'Booking updated!' });
      }
    } catch (err) {
      console.error('Update booking error:', err);
      setFeedbackModal({ visible: true, type: 'error', message: err?.message || 'Update failed. Please try again.' });
    }
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openEditModal = useCallback((booking) => {
    setSelectedBooking(booking);
    setEditModalVisible(true);
    Animated.timing(modalAnimation, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    if (route?.params?.openBookingId && navigation?.setParams)
      navigation.setParams({ openBookingId: undefined, openInEditMode: undefined });
  }, [modalAnimation]);

  const closeEditModal = useCallback(() => {
    Animated.timing(modalAnimation, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => { setEditModalVisible(false); setSelectedBooking(null); });
  }, [modalAnimation]);

  const openAddModal = useCallback(() => {
    setAddModalVisible(true);
    Animated.timing(addModalAnimation, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [addModalAnimation]);

  const closeAddModal = useCallback(() => {
    Animated.timing(addModalAnimation, { toValue: 0, duration: 200, useNativeDriver: true })
      .start(() => setAddModalVisible(false));
  }, [addModalAnimation]);

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // ── Dropdown helpers ──────────────────────────────────────────────────────
  const EnhancedDropdown = ({ visible, onClose, children, title }) => {
    const anim = useState(new Animated.Value(0))[0];
    useEffect(() => {
      Animated.spring(anim, { toValue: visible ? 1 : 0, tension: 100, friction: 8, useNativeDriver: true }).start();
    }, [visible]);
    if (!visible) return null;
    return (
      <Modal visible={visible} transparent animationType="none">
        <TouchableOpacity style={sc.ddOverlay} activeOpacity={1} onPress={onClose}>
          <Animated.View style={[sc.ddContainer, { transform: [{ scale: anim.interpolate({ inputRange: [0,1], outputRange: [0.9,1] }) }], opacity: anim }]}>
            {title && <View style={sc.ddTitle}><Text style={sc.ddTitleTxt}>{title}</Text></View>}
            <ScrollView style={sc.ddScroll}>{children}</ScrollView>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    );
  };

  const DItem = ({ selected, onPress, label }) => (
    <TouchableOpacity style={[sc.dItem, selected && sc.dItemSel]} onPress={onPress}>
      <Text style={[sc.dItemTxt, selected && sc.dItemTxtSel]}>{label}</Text>
      {selected && <Ionicons name="checkmark" size={18} color="#111827" />}
    </TouchableOpacity>
  );

  const CalendarModal = ({ visible, onClose, onDateSelect, selectedDate, title, minDate, maxDate }) => {
    const anim = useState(new Animated.Value(0))[0];
    useEffect(() => { Animated.spring(anim, { toValue: visible ? 1 : 0, tension: 100, friction: 8, useNativeDriver: true }).start(); }, [visible]);
    if (!visible) return null;
    return (
      <Modal visible={visible} transparent animationType="none">
        <TouchableOpacity style={sc.calOverlay} activeOpacity={1} onPress={onClose}>
          <Animated.View style={[sc.calContainer, { transform: [{ scale: anim.interpolate({ inputRange:[0,1], outputRange:[0.9,1] }) }], opacity: anim }]}>
            <View style={sc.calHeader}>
              <Text style={sc.calTitle}>{title || 'Select Date'}</Text>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#6b7280" /></TouchableOpacity>
            </View>
            <Calendar
              minDate={minDate || new Date().toISOString().split('T')[0]}
              maxDate={maxDate}
              onDayPress={day => onDateSelect(day.dateString)}
              markedDates={{ [selectedDate]: { selected: true, selectedColor: '#111827', selectedTextColor: '#fff' } }}
              theme={{ backgroundColor: '#fff', calendarBackground: '#fff', selectedDayBackgroundColor: '#111827', selectedDayTextColor: '#fff', todayTextColor: '#ef4444', dayTextColor: '#111827', textDisabledColor: '#d1d5db', arrowColor: '#111827', monthTextColor: '#111827' }}
            />
            {selectedDate && <View style={sc.calFooter}><Text style={sc.calFooterTxt}>Selected: {formatDate(selectedDate)}</Text></View>}
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ── Delivery stats ────────────────────────────────────────────────────────
  const deliveryBookings = bookings.filter(isDeliveryBooking);
  const paginated        = filteredBookings.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // ── Header ────────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View>
      <View style={sc.header}>
        <View>
          <Text style={sc.headerTitle}>Bookings</Text>
          {lastRefreshed && <Text style={sc.lastRefresh}>Updated {lastRefreshed.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</Text>}
        </View>
        <View style={sc.headerActions}>
          <TouchableOpacity style={sc.refreshBtn} onPress={() => fetchBookings()}>
            <Ionicons name="refresh" size={18} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity style={sc.addBtn} onPress={openAddModal}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={sc.addBtnTxt}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={sc.tabBar}>
        {[
          { key: 'all',      label: 'All',        count: bookings.length },
          { key: 'delivery', label: 'Deliveries',  count: deliveryBookings.length },
        ].map(t => (
          <TouchableOpacity key={t.key} style={[sc.tab, activeTab === t.key && sc.tabActive]} onPress={() => { setActiveTab(t.key); setCurrentPage(1); }}>
            <Text style={[sc.tabTxt, activeTab === t.key && sc.tabTxtActive]}>{t.label}</Text>
            <View style={[sc.tabBadge, activeTab === t.key && sc.tabBadgeActive]}>
              <Text style={[sc.tabBadgeTxt, activeTab === t.key && sc.tabBadgeTxtActive]}>{t.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Delivery summary strip */}
      {activeTab === 'delivery' && (
        <View style={sc.strip}>
          {[
            { label: 'Unassigned', count: deliveryBookings.filter(b => !b.assigned_driver && !['completed','cancelled'].includes(b.status)).length, color: '#f59e0b', icon: 'alert-circle' },
            { label: 'Active',     count: deliveryBookings.filter(b => ['confirmed','ongoing','delivered','retrieved'].includes(b.status)).length, color: '#111827', icon: 'car' },
            { label: 'Done',       count: deliveryBookings.filter(b => b.status === 'completed').length, color: '#10b981', icon: 'checkmark-circle' },
          ].map(s => (
            <View key={s.label} style={sc.stripItem}>
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[sc.stripCount, { color: s.color }]}>{s.count}</Text>
              <Text style={sc.stripLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Filters */}
      <View style={sc.filterCard}>
        <Text style={sc.filterTitle}>{activeTab === 'delivery' ? 'Delivery Assignments' : 'All Bookings'}</Text>
        <View style={sc.filterRow}>
          <TouchableOpacity style={sc.ddBtn} onPress={() => setStatusDropdownVisible(true)}>
            <Text style={sc.ddBtnTxt} numberOfLines={1}>{listStatusFilter === 'All' ? 'All Statuses' : listStatusFilter}</Text>
            <Ionicons name="chevron-down" size={15} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity style={sc.ddBtn} onPress={() => setDateDropdownVisible(true)}>
            <Text style={sc.ddBtnTxt} numberOfLines={1}>{listDateFilter === 'All' ? 'All Dates' : listDateFilter}</Text>
            <Ionicons name="chevron-down" size={15} color="#6b7280" />
          </TouchableOpacity>
          <TouchableOpacity style={sc.ddBtn} onPress={() => setVehicleTypeDropdownVisible(true)}>
            <Text style={sc.ddBtnTxt} numberOfLines={1}>{vehicleTypeFilter === 'All' ? 'Type' : vehicleTypeFilter}</Text>
            <Ionicons name="chevron-down" size={15} color="#6b7280" />
          </TouchableOpacity>
        </View>
        <Text style={sc.resultCount}>{filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}</Text>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={sc.empty}>
      {loading
        ? <ActivityIndicator size="large" color="#111827" />
        : <>
            <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
            <Text style={sc.emptyTitle}>No bookings found</Text>
            <Text style={sc.emptySub}>Try adjusting your filters</Text>
          </>
      }
    </View>
  );

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    return (
      <View style={sc.pagination}>
        <Text style={sc.pageInfo}>Page {currentPage} of {totalPages}</Text>
        <View style={sc.pageControls}>
          <TouchableOpacity style={[sc.pageBtn, currentPage === 1 && sc.pageBtnOff]} onPress={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <Ionicons name="chevron-back" size={20} color={currentPage === 1 ? '#d1d5db' : '#374151'} />
          </TouchableOpacity>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p = currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
            if (totalPages <= 5) p = i + 1;
            return (
              <TouchableOpacity key={p} style={[sc.pageNum, currentPage === p && sc.pageNumActive]} onPress={() => setCurrentPage(p)}>
                <Text style={[sc.pageNumTxt, currentPage === p && sc.pageNumTxtActive]}>{p}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[sc.pageBtn, currentPage === totalPages && sc.pageBtnOff]} onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            <Ionicons name="chevron-forward" size={20} color={currentPage === totalPages ? '#d1d5db' : '#374151'} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={sc.container}>
      {/* Dropdowns */}
      <EnhancedDropdown visible={statusDropdownVisible} onClose={() => setStatusDropdownVisible(false)} title="Filter by Status">
        {['All','pending','confirmed','ongoing','delivered','retrieved','completed','cancelled','declined'].map(s => (
          <DItem key={s} selected={listStatusFilter === s} label={s === 'All' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)} onPress={() => { setListStatusFilter(s); setStatusDropdownVisible(false); setCurrentPage(1); }} />
        ))}
      </EnhancedDropdown>
      <EnhancedDropdown visible={dateDropdownVisible} onClose={() => setDateDropdownVisible(false)} title="Filter by Date">
        {['All','Today','This Week','This Month','This Year','Recent'].map(d => (
          <DItem key={d} selected={listDateFilter === d} label={d === 'All' ? 'All Dates' : d} onPress={() => { setListDateFilter(d); setDateDropdownVisible(false); setCurrentPage(1); }} />
        ))}
      </EnhancedDropdown>
      <EnhancedDropdown visible={vehicleTypeDropdownVisible} onClose={() => setVehicleTypeDropdownVisible(false)} title="Filter by Type">
        {['All', ...vehicleTypes].map(t => (
          <DItem key={t} selected={vehicleTypeFilter === t} label={t === 'All' ? 'All Types' : t} onPress={() => { setVehicleTypeFilter(t); setVehicleTypeDropdownVisible(false); setCurrentPage(1); }} />
        ))}
      </EnhancedDropdown>

      {/* Status modal */}
      <StatusModal
        visible={statusModal.visible}
        booking={statusModal.booking}
        onClose={() => setStatusModal({ visible: false, booking: null })}
        onUpdate={handleStatusUpdate}
        loading={statusLoading}
      />

      {/* Assign driver modal */}
      <AssignDriverModal
        visible={assignModal.visible}
        booking={assignModal.booking}
        onClose={() => setAssignModal({ visible: false, booking: null })}
        onAssign={handleAssignDriver}
        drivers={drivers}
      />

      {/* Feedback */}
      <ActionModal
        visible={feedbackModal.visible}
        type={feedbackModal.type}
        title={feedbackModal.type === 'success' ? 'Success' : 'Error'}
        message={feedbackModal.message}
        confirmText="OK"
        onClose={() => setFeedbackModal({ visible: false, type: 'success', message: '' })}
        onConfirm={() => setFeedbackModal({ visible: false, type: 'success', message: '' })}
      />

      {actionModalConfig && (
        <ActionModal visible type="confirm" title={actionModalConfig.title} message={actionModalConfig.message}
          onClose={() => setActionModalConfig(null)} onConfirm={() => { actionModalConfig.onConfirm(); setActionModalConfig(null); }} />
      )}

      <EditBookingModal
        visible={editModalVisible}
        booking={selectedBooking}
        availableVehicles={availableVehicles}
        closeEditModal={closeEditModal}
        updateBooking={updateBooking}
        deleteBooking={deleteBooking}
        modalAnimation={modalAnimation}
        styles={sc}
        formatDate={formatDate}
        CalendarModalComponent={CalendarModal}
        onAssignDriver={(b) => setAssignModal({ visible: true, booking: b })}
        extraContent={selectedBooking && isDeliveryBooking(selectedBooking) ? (
          <DriverStatusTimeline booking={selectedBooking} />
        ) : null}
      />

      <AddBookingModal
        visible={addModalVisible}
        availableVehicles={availableVehicles}
        closeModal={closeAddModal}
        onBookingAdded={async () => { await fetchBookings(); await fetchAvailableVehicles(); setFeedbackModal({ visible: true, type: 'success', message: 'Booking added!' }); }}
        modalAnimation={addModalAnimation}
        styles={sc}
        formatDate={formatDate}
        CalendarModalComponent={CalendarModal}
      />

      <FlatList
        data={paginated}
        keyExtractor={item => item.id.toString()}
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={renderEmpty()}
        ListFooterComponent={<View style={{ paddingBottom: 30 }}>{renderPagination()}</View>}
        onRefresh={() => { setRefreshing(true); fetchBookings(); fetchAvailableVehicles(); }}
        refreshing={refreshing}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <BookingCard
            booking={item}
            activeTab={activeTab}
            onStatusPress={(b) => setStatusModal({ visible: true, booking: b })}
            onAssignPress={(b) => setAssignModal({ visible: true, booking: b })}
            onCardPress={openEditModal}
          />
        )}
      />
    </SafeAreaView>
  );
}

// ─── Screen styles ─────────────────────────────────────────────────────────────
const sc = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#f9fafb' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, backgroundColor: '#f9fafb' },
  headerTitle:  { fontSize: 26, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  lastRefresh:  { fontSize: 11, color: '#9ca3af', marginTop: 3 },
  headerActions:{ flexDirection: 'row', gap: 10, alignItems: 'center' },
  refreshBtn:   { width: 38, height: 38, borderRadius: 10, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  addBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, gap: 6 },
  addBtnTxt:    { color: '#fff', fontSize: 14, fontWeight: '600' },
  tabBar:       { flexDirection: 'row', marginHorizontal: 16, marginBottom: 4, gap: 8 },
  tab:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f3f4f6' },
  tabActive:    { backgroundColor: '#111827' },
  tabTxt:       { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTxtActive: { color: '#fff' },
  tabBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: '#e5e7eb' },
  tabBadgeActive:{ backgroundColor: 'rgba(255,255,255,0.2)' },
  tabBadgeTxt:  { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  tabBadgeTxtActive: { color: '#fff' },
  strip:        { flexDirection: 'row', marginHorizontal: 16, marginTop: 6, marginBottom: 4, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, justifyContent: 'space-around', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  stripItem:    { alignItems: 'center', gap: 3 },
  stripCount:   { fontSize: 18, fontWeight: '800' },
  stripLabel:   { fontSize: 11, color: '#6b7280', fontWeight: '500' },
  filterCard:   { backgroundColor: '#fff', marginHorizontal: 16, marginVertical: 10, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 3 },
  filterTitle:  { fontSize: 15, fontWeight: '700', color: '#1f2937', marginBottom: 10 },
  filterRow:    { flexDirection: 'row', gap: 8 },
  ddBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9fafb', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  ddBtnTxt:     { flex: 1, fontSize: 12, color: '#1f2937' },
  resultCount:  { fontSize: 11, color: '#9ca3af', marginTop: 8 },
  empty:        { alignItems: 'center', paddingVertical: 60 },
  emptyTitle:   { fontSize: 17, fontWeight: '600', color: '#374151', marginTop: 12 },
  emptySub:     { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  pagination:   { backgroundColor: '#fff', borderRadius: 12, margin: 16, padding: 14, alignItems: 'center', gap: 10 },
  pageInfo:     { fontSize: 13, color: '#374151', fontWeight: '500' },
  pageControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageBtn:      { padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  pageBtnOff:   { borderColor: '#f3f4f6', backgroundColor: '#f9fafb' },
  pageNum:      { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  pageNumActive:{ backgroundColor: '#111827', borderColor: '#111827' },
  pageNumTxt:   { fontSize: 14, fontWeight: '600', color: '#374151' },
  pageNumTxtActive: { color: '#fff' },
  // Dropdown
  ddOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  ddContainer:  { backgroundColor: '#fff', borderRadius: 16, minWidth: 250, maxWidth: width - 40, maxHeight: '70%', elevation: 12 },
  ddTitle:      { padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  ddTitleTxt:   { fontSize: 17, fontWeight: '700', color: '#1f2937', textAlign: 'center' },
  ddScroll:     { maxHeight: 300 },
  dItem:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  dItemSel:     { backgroundColor: '#f3f4f6' },
  dItemTxt:     { fontSize: 15, color: '#1f2937', fontWeight: '500', flex: 1 },
  dItemTxtSel:  { color: '#111827', fontWeight: '700' },
  // Calendar
  calOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  calContainer: { backgroundColor: '#fff', borderRadius: 16, padding: 16, width: '100%', maxWidth: 360, elevation: 8 },
  calHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  calTitle:     { fontSize: 17, fontWeight: '600', color: '#111827' },
  calFooter:    { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  calFooterTxt: { fontSize: 14, fontWeight: '500', color: '#374151' },
  // EditBookingModal passthrough styles
  modalContainer:    { flex: 1, backgroundColor: '#f3f4f6' },
  modalHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalHeaderButton: { padding: 8, borderRadius: 8 },
  modalTitle:        { fontSize: 19, fontWeight: '700', color: '#1f2937' },
  modalContent:      { padding: 16 },
  section:           { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  sectionHeader:     { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  sectionTitle:      { fontSize: 15, fontWeight: '700', color: '#1f2937' },
  inputGroup:        { marginBottom: 14 },
  inputLabel:        { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input:             { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: '#1f2937' },
  statusContainer:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusOption:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  statusOptionSelected: { backgroundColor: '#111827', borderColor: '#111827' },
  statusOptionText:  { fontSize: 13, color: '#6b7280', fontWeight: '500' },
  statusOptionTextSelected: { color: '#fff', fontWeight: '700' },
  deleteButton:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2', paddingVertical: 13, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: '#fecaca', gap: 8 },
  deleteButtonText:  { fontSize: 15, fontWeight: '600', color: '#ef4444' },
  saveButtonContainer:{ backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 8 },
  saveButton:        { fontSize: 15, fontWeight: '700', color: '#fff' },
  vehicleInput:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vehicleInputText:  { fontSize: 15, color: '#1f2937' },
  dateInput:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateInputText:     { fontSize: 15, color: '#1f2937' },
  placeholderText:   { color: '#9ca3af' },
  inputRow:          { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, gap: 12 },
  inputHalf:         { flex: 1, marginBottom: 0 },
  vehiclePickerContainer: { backgroundColor: '#fff', borderRadius: 12, width: '90%', maxHeight: '70%', maxWidth: 400 },
  pickerHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  pickerTitle:       { fontSize: 17, fontWeight: '600', color: '#111827' },
  vehiclePickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  vehiclePickerItemSelected: { backgroundColor: '#f3f4f6' },
  vehiclePickerItemContent:  { flex: 1 },
  vehiclePickerText: { fontSize: 15, color: '#1f2937', fontWeight: '500' },
  vehiclePickerType: { fontSize: 12, color: '#374151', marginTop: 3, fontWeight: '500' },
  emptyVehicleText:  { textAlign: 'center', color: '#9ca3af', padding: 20, fontSize: 15 },
  modalOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
});