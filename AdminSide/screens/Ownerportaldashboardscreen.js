"use strict";

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Animated, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  bookingsService, notificationsService, carOwnersService,
  variantsService, firebaseAuth,
} from '../services/firebaseService';
import ActionModal from '../components/AlertModal/ActionModal';

// ─── Design tokens ──────────────────────────────────────────────────────────────
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
  confirmed:  '#10b981',
  ongoing:    '#3b82f6',
  delivered:  '#8b5cf6',
  retrieved:  '#06b6d4',
  completed:  '#6366f1',
  cancelled:  '#ef4444',
  declined:   '#f97316',
  unread:     '#f59e0b',
};

const STATUS_COLOR = {
  pending: C.pending, confirmed: C.confirmed, ongoing: C.ongoing,
  delivered: C.delivered, retrieved: C.retrieved, completed: C.completed,
  cancelled: C.cancelled, declined: C.declined,
};

const fmt = (v) =>
  `₱${parseFloat(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

const fmtDate = (d) =>
  !d ? '—' : new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

// ─── Notification Bell (animated, same as original dashboard) ──────────────────
const NotificationBell = ({ count, onPress }) => {
  const [anim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (count > 0) {
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,  duration: 180, useNativeDriver: true }),
        Animated.timing(anim, { toValue: -1, duration: 180, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0,  duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [count]);

  const rotate = anim.interpolate({ inputRange: [-1, 1], outputRange: ['-15deg', '15deg'] });

  return (
    <TouchableOpacity style={s.bellBtn} onPress={onPress}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons
          name={count > 0 ? 'notifications' : 'notifications-outline'}
          size={24}
          color={count > 0 ? C.unread : C.ink}
        />
      </Animated.View>
      {count > 0 && (
        <View style={s.bellBadge}>
          <Text style={s.bellBadgeTxt}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Notification type metadata ─────────────────────────────────────────────────
const NOTIF_META = {
  new_booking:       { icon: 'add-circle',      color: C.pending   },
  booking_confirmed: { icon: 'checkmark-circle', color: C.confirmed },
  booking_completed: { icon: 'flag',             color: C.completed },
  booking_cancelled: { icon: 'close-circle',     color: C.cancelled },
  booking_declined:  { icon: 'ban',              color: C.declined  },
  pickup_today:      { icon: 'today',            color: C.ongoing   },
  return_today:      { icon: 'calendar',         color: C.delivered },
  vehicle_approved:  { icon: 'checkmark-circle', color: C.confirmed },
  vehicle_rejected:  { icon: 'close-circle',     color: C.cancelled },
  driver_payment:    { icon: 'cash',             color: C.confirmed },
  driver_damage:     { icon: 'warning',          color: C.cancelled },
  driver_fuel:       { icon: 'water',            color: C.pending   },
  driver_delay:      { icon: 'time',             color: C.declined  },
  overdue:           { icon: 'alert-circle',     color: C.cancelled },
};
const getMeta = (type) => NOTIF_META[type] || { icon: 'information-circle', color: C.muted };

// ─── Notifications Panel Modal ──────────────────────────────────────────────────
// Opens as a slide-up modal when bell is tapped — exactly like the original dashboard
const NotificationsModal = ({ visible, notifications, onClose, onMarkRead, onMarkAllRead, onRemove, setActionModalConfig }) => {
  const [filter, setFilter] = useState('all');

  useEffect(() => { if (visible) setFilter('all'); }, [visible]);

  const unread = notifications.filter(n => !n.read).length;

  const TABS = [
    { key: 'all',     label: 'All'     },
    { key: 'unread',  label: 'Unread'  },
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'booking', label: 'Booking' },
  ];

  const getCategory = (type = '') => {
    if (type.startsWith('vehicle')) return 'vehicle';
    if (type.startsWith('driver') || type.startsWith('overdue')) return 'charge';
    return 'booking';
  };

  const visible_notifs = notifications.filter(n => {
    if (filter === 'all')     return true;
    if (filter === 'unread')  return !n.read;
    if (filter === 'vehicle') return getCategory(n.type) === 'vehicle';
    if (filter === 'booking') return getCategory(n.type) === 'booking';
    return true;
  });

  const renderItem = ({ item }) => {
    const meta     = getMeta(item.type);
    const isVehicle = getCategory(item.type) === 'vehicle';

    return (
      <TouchableOpacity
        style={[nm.item, !item.read && nm.itemUnread, isVehicle && nm.itemVehicle]}
        onPress={() => onMarkRead(item.id)}
        onLongPress={() => setActionModalConfig({
          title:   'Remove Notification',
          message: 'Remove this notification?',
          onConfirm: () => onRemove(item.id),
        })}
        activeOpacity={0.85}
      >
        <View style={[nm.iconWrap, { backgroundColor: meta.color + '18' }]}>
          <Ionicons name={meta.icon} size={20} color={meta.color} />
        </View>
        <View style={nm.content}>
          {isVehicle && (
            <View style={nm.vehicleBadge}>
              <Ionicons name="car-outline" size={10} color="#7c3aed" />
              <Text style={nm.vehicleBadgeTxt}>Vehicle Update</Text>
            </View>
          )}
          <Text style={nm.title}>{item.title}</Text>
          <Text style={nm.message} numberOfLines={2}>{item.message}</Text>
          <Text style={nm.time}>{item.timeAgo}</Text>
        </View>
        {!item.read && <View style={nm.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={nm.container}>

        {/* Header */}
        <View style={nm.header}>
          <View>
            <Text style={nm.headerTitle}>Notifications</Text>
            <Text style={nm.headerSub}>
              {unread > 0 ? `${unread} unread · ` : ''}{notifications.length} total
            </Text>
          </View>
          <View style={nm.headerRight}>
            {unread > 0 && (
              <TouchableOpacity style={nm.readAllBtn} onPress={onMarkAllRead}>
                <Ionicons name="checkmark-done-outline" size={14} color={C.inkSoft} />
                <Text style={nm.readAllTxt}>Read all</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={nm.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={C.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={nm.tabScroll}
          contentContainerStyle={nm.tabRow}
        >
          {TABS.map(t => {
            const cnt = t.key === 'all'
              ? notifications.length
              : t.key === 'unread'
              ? unread
              : notifications.filter(n => getCategory(n.type) === t.key).length;
            const active = filter === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[nm.tab, active && nm.tabActive]}
                onPress={() => setFilter(t.key)}
              >
                <Text style={[nm.tabTxt, active && nm.tabTxtActive]}>{t.label}</Text>
                {cnt > 0 && (
                  <View style={[nm.tabBadge, active && nm.tabBadgeActive]}>
                    <Text style={[nm.tabBadgeTxt, active && nm.tabBadgeTxtActive]}>{cnt}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={nm.divider} />

        {/* List */}
        <FlatList
          data={visible_notifs}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={nm.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={nm.empty}>
              <Ionicons name="notifications-off-outline" size={44} color="#d1d5db" />
              <Text style={nm.emptyTxt}>
                {filter === 'all' ? "You're all caught up!" : `No ${filter} notifications`}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

const nm = StyleSheet.create({
  container:    { flex: 1, backgroundColor: C.white },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:  { fontSize: 20, fontWeight: '800', color: C.ink },
  headerSub:    { fontSize: 12, color: C.subtle, marginTop: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readAllBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  readAllTxt:   { fontSize: 12, fontWeight: '600', color: C.inkSoft },
  closeBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: C.borderSoft, justifyContent: 'center', alignItems: 'center' },
  tabScroll:    { maxHeight: 56, backgroundColor: C.white },
  tabRow:       { paddingHorizontal: 16, gap: 8, paddingVertical: 10, flexDirection: 'row' },
  tab:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.borderSoft, borderWidth: 1, borderColor: C.border },
  tabActive:    { backgroundColor: C.ink, borderColor: C.ink },
  tabTxt:       { fontSize: 13, fontWeight: '600', color: C.muted },
  tabTxtActive: { color: '#fff' },
  tabBadge:     { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.border, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  tabBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabBadgeTxt:    { fontSize: 10, fontWeight: '700', color: C.muted },
  tabBadgeTxtActive: { color: '#fff' },
  divider:      { height: 1, backgroundColor: C.border },
  list:         { padding: 14 },
  item:         { flexDirection: 'row', alignItems: 'flex-start', padding: 12, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 8, position: 'relative' },
  itemUnread:   { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  itemVehicle:  { borderLeftWidth: 3, borderLeftColor: '#8b5cf6' },
  iconWrap:     { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  content:      { flex: 1 },
  vehicleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f3e8ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 4 },
  vehicleBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#7c3aed' },
  title:        { fontSize: 13.5, fontWeight: '700', color: C.ink, marginBottom: 3 },
  message:      { fontSize: 12.5, color: C.muted, lineHeight: 18, marginBottom: 4 },
  time:         { fontSize: 11, color: C.subtle, fontWeight: '500' },
  unreadDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: C.unread, position: 'absolute', top: 12, right: 12 },
  empty:        { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTxt:     { fontSize: 15, color: C.muted, fontWeight: '500' },
});

// ─── Main Screen ────────────────────────────────────────────────────────────────
export default function OwnerPortalDashboard({ navigation }) {
  const [owner, setOwner]             = useState(null);
  const [stats, setStats]             = useState({ totalVehicles: 0, activeBookings: 0, totalEarnings: 0, pendingBookings: 0, completedBookings: 0 });
  const [recentBookings, setRecent]   = useState([]);
  const [allBookings, setAllBookings] = useState([]);
  const [notifications, setNotifs]    = useState([]);
  const [showNotifs, setShowNotifs]   = useState(false);  // ← controls the in-screen modal
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [feedbackModal, setFeedback]  = useState({ visible: false, type: 'success', message: '' });

  useEffect(() => { init(); }, []);

  const init = async () => {
    setLoading(true);
    try {
      const u = firebaseAuth.getCurrentUser();
      if (!u) return;
      const owners = await carOwnersService.list();
      const me     = (owners || []).find(o => o.email === u.email);
      setOwner(me || null);
      if (me) {
        await loadDashboard(me.id);
        await loadNotifications(me.id);
      }
    } catch (e) { console.error('init:', e); }
    finally { setLoading(false); }
  };

  const loadDashboard = async (ownerId) => {
    try {
      const allVariants  = await variantsService.list();
      const myVariants   = (allVariants || []).filter(v => v.owner_id === ownerId);
      const myVariantIds = myVariants.map(v => v.id);
      const myVehicleIds = [...new Set(myVariants.map(v => v.vehicle_id))];

      const allB       = await bookingsService.listWithDetails();
      const myBookings = (allB || []).filter(b =>
        myVariantIds.includes(b.vehicle_variant_id) || myVehicleIds.includes(b.vehicle_id)
      );
      setAllBookings(myBookings);

      const totalEarnings = myBookings
        .filter(b => b.status === 'completed')
        .reduce((sum, b) => sum + parseFloat(b.total_price || 0), 0);

      setStats({
        totalVehicles:     myVariants.length,
        activeBookings:    myBookings.filter(b => ['confirmed','ongoing','delivered','retrieved'].includes(b.status)).length,
        totalEarnings,
        pendingBookings:   myBookings.filter(b => b.status === 'pending').length,
        completedBookings: myBookings.filter(b => b.status === 'completed').length,
      });

      setRecent([...myBookings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5));
    } catch (e) { console.error('loadDashboard:', e); }
  };

  // Load notifications scoped to this owner (by owner_id or generic)
  const loadNotifications = async (ownerId) => {
    try {
      const data = await notificationsService.listUnread();
      const formatted = (data || [])
        .filter(n => !n.owner_id || n.owner_id === ownerId)   // only owner-relevant
        .map(n => {
          const diffMin = Math.floor((new Date() - new Date(n.created_at || Date.now())) / 60000);
          const timeAgo = diffMin < 1 ? 'Just now' : diffMin < 60 ? `${diffMin}m ago` : diffMin < 1440 ? `${Math.floor(diffMin / 60)}h ago` : `${Math.floor(diffMin / 1440)}d ago`;
          return { ...n, timeAgo };
        });
      formatted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setNotifs(formatted);
    } catch (e) { console.error('loadNotifications:', e); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await init();
    setRefreshing(false);
  };

  // ── Notification actions ──────────────────────────────────────────────────────
  const handleMarkRead = async (id) => {
    try {
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      await notificationsService.update(id, { read: true });
    } catch (e) { console.error(e); }
  };

  const handleMarkAllRead = async () => {
    try {
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
      await notificationsService.markAllRead?.();
    } catch (e) { console.error(e); }
  };

  const handleRemove = async (id) => {
    try {
      setNotifs(prev => prev.filter(n => n.id !== id));
      await notificationsService.update(id, { dismissed: true });
    } catch (e) { console.error(e); }
  };

  const handleLogout = () => setActionModal({
    title: 'Sign Out',
    message: 'Are you sure you want to sign out?',
    onConfirm: async () => {
      try { await firebaseAuth.signOut(); }
      catch { setFeedback({ visible: true, type: 'error', message: 'Failed to sign out.' }); }
    },
  });

  const unreadCount      = notifications.filter(n => !n.read).length;
  const countByStatus    = (st) => allBookings.filter(b => b.status === st).length;

  // ── Stat Card ─────────────────────────────────────────────────────────────────
  const StatCard = ({ icon, label, value, onPress }) => (
    <TouchableOpacity style={s.statCard} onPress={onPress} activeOpacity={0.8}>
      <View style={s.statIcon}>
        <Ionicons name={icon} size={22} color={C.ink} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>

      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={s.headerWrap}>
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Dashboard</Text>
            <Text style={s.headerSub}>
              {owner?.name ? `Welcome, ${owner.name.split(' ')[0]}!` : 'Owner Portal'}
            </Text>
          </View>
          <View style={s.headerActions}>
            {/* Bell taps open the in-screen modal — same pattern as original DashboardScreen */}
            <NotificationBell count={unreadCount} onPress={() => setShowNotifs(true)} />
            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={22} color={C.ink} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading || refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── Owner Card ── */}
        {owner && (
          <View style={s.ownerCard}>
            <View style={s.ownerAva}>
              <Text style={s.ownerAvaText}>{(owner.name || 'O').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.ownerName}>{owner.name}</Text>
              <Text style={s.ownerEmail}>{owner.email}</Text>
              <View style={s.ownerBadge}>
                <View style={[s.statusDot, { backgroundColor: owner.status === 'active' ? C.confirmed : C.muted }]} />
                <Text style={s.ownerBadgeTxt}>{owner.status || 'active'}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Stat Cards 2×2 ── */}
        <View style={s.statsGrid}>
          <StatCard icon="car"            label="My Vehicles"  value={stats.totalVehicles}    onPress={() => navigation.navigate('OwnerVehicles')} />
          <StatCard icon="time"           label="Active"       value={stats.activeBookings}   onPress={() => navigation.navigate('OwnerBookings')} />
          <StatCard icon="document-text"  label="Pending"      value={stats.pendingBookings}  onPress={() => navigation.navigate('OwnerBookings')} />
          <StatCard icon="checkmark-done" label="Completed"    value={stats.completedBookings} onPress={() => navigation.navigate('OwnerBookings')} />
        </View>

        {/* ── Earnings ── */}
        <View style={s.earningsCard}>
          <View>
            <Text style={s.earningsLabel}>Total Earnings</Text>
            <Text style={s.earningsValue}>{fmt(stats.totalEarnings)}</Text>
            <Text style={s.earningsSub}>From completed rentals</Text>
          </View>
          <View style={s.earningsIcon}>
            <Ionicons name="trending-up" size={32} color={C.confirmed} />
          </View>
        </View>

        {/* ── Booking Status Overview ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Booking Overview</Text>
          <View style={s.statusGrid}>
            {[
              { label: 'Pending',   color: C.pending,   count: countByStatus('pending')   },
              { label: 'Confirmed', color: C.confirmed, count: countByStatus('confirmed') },
              { label: 'Ongoing',   color: C.ongoing,   count: countByStatus('ongoing')   },
              { label: 'Delivered', color: C.delivered, count: countByStatus('delivered') },
              { label: 'Retrieved', color: C.retrieved, count: countByStatus('retrieved') },
              { label: 'Completed', color: C.completed, count: countByStatus('completed') },
              { label: 'Cancelled', color: C.cancelled, count: countByStatus('cancelled') },
              { label: 'Declined',  color: C.declined,  count: countByStatus('declined')  },
            ].map(item => (
              <View key={item.label} style={s.statusItem}>
                <View style={[s.statusDot, { backgroundColor: item.color }]} />
                <Text style={s.statusCount}>{item.count}</Text>
                <Text style={s.statusLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Recent Bookings ── */}
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>Recent Bookings</Text>
            <TouchableOpacity onPress={() => navigation.navigate('OwnerBookings')}>
              <Text style={s.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentBookings.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="document-text-outline" size={40} color="#d1d5db" />
              <Text style={s.emptyTxt}>No bookings for your vehicles yet</Text>
            </View>
          ) : (
            recentBookings.map(b => {
              const color   = STATUS_COLOR[b.status] || C.muted;
              const vehicle = [b.vehicles?.year, b.vehicles?.make, b.vehicles?.model].filter(Boolean).join(' ');
              return (
                <View key={b.id} style={[s.bookingCard, { borderLeftColor: color }]}>
                  <View style={s.bookingHead}>
                    <View style={s.bookingAva}>
                      <Text style={s.bookingAvaTxt}>
                        {(b.customer_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.bookingName}>{b.customer_name || '—'}</Text>
                      {vehicle ? <Text style={s.bookingVehicle}>{vehicle}</Text> : null}
                    </View>
                    <View style={[s.statusPill, { backgroundColor: color + '22' }]}>
                      <Text style={[s.statusPillTxt, { color }]}>{b.status}</Text>
                    </View>
                  </View>
                  <View style={s.bookingMeta}>
                    <View style={s.bookingMetaRow}>
                      <Ionicons name="calendar-outline" size={12} color={C.subtle} />
                      <Text style={s.bookingMetaTxt}>{fmtDate(b.rental_start_date)} → {fmtDate(b.rental_end_date)}</Text>
                    </View>
                    <View style={s.bookingMetaRow}>
                      <Ionicons name="cash-outline" size={12} color={C.subtle} />
                      <Text style={s.bookingMetaTxt}>{fmt(b.total_price)}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── Quick Actions ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Quick Actions</Text>
          <View style={s.quickActions}>
            <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('OwnerVehicles')}>
              <View style={s.quickIcon}><Ionicons name="car-outline" size={24} color={C.ink} /></View>
              <Text style={s.quickLabel}>My Vehicles</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('OwnerBookings')}>
              <View style={s.quickIcon}><Ionicons name="document-text-outline" size={24} color={C.ink} /></View>
              <Text style={s.quickLabel}>Bookings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.quickBtn} onPress={() => setShowNotifs(true)}>
              <View style={[s.quickIcon, unreadCount > 0 && { borderColor: C.unread, borderWidth: 2 }]}>
                <Ionicons name="notifications-outline" size={24} color={unreadCount > 0 ? C.unread : C.ink} />
                {unreadCount > 0 && (
                  <View style={s.quickBadge}><Text style={s.quickBadgeTxt}>{unreadCount}</Text></View>
                )}
              </View>
              <Text style={s.quickLabel}>Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.quickBtn} onPress={() => navigation.navigate('OwnerSettings')}>
              <View style={s.quickIcon}><Ionicons name="settings-outline" size={24} color={C.ink} /></View>
              <Text style={s.quickLabel}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ── In-Screen Notifications Modal — bell opens this, same as original DashboardScreen ── */}
      <NotificationsModal
        visible={showNotifs}
        notifications={notifications}
        onClose={() => setShowNotifs(false)}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onRemove={handleRemove}
        setActionModalConfig={setActionModal}
      />

      {actionModal && (
        <ActionModal
          visible
          type="confirm"
          title={actionModal.title}
          message={actionModal.message}
          onClose={() => setActionModal(null)}
          onConfirm={async () => { await actionModal.onConfirm?.(); setActionModal(null); }}
        />
      )}
      <ActionModal
        visible={feedbackModal.visible}
        type={feedbackModal.type}
        title={feedbackModal.type === 'success' ? 'Success' : 'Error'}
        message={feedbackModal.message}
        confirmText="OK"
        onClose={() => setFeedback({ visible: false, type: 'success', message: '' })}
        onConfirm={() => setFeedback({ visible: false, type: 'success', message: '' })}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: C.surface },
  headerWrap:    { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle:   { fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  headerSub:     { fontSize: 13, color: C.muted, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bellBtn:       { position: 'relative', padding: 8, borderRadius: 8, backgroundColor: C.borderSoft },
  bellBadge:     { position: 'absolute', top: 2, right: 2, backgroundColor: C.unread, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
  bellBadgeTxt:  { color: '#fff', fontSize: 9, fontWeight: '800' },
  logoutBtn:     { padding: 8, borderRadius: 8, backgroundColor: C.borderSoft },

  ownerCard:     { flexDirection: 'row', alignItems: 'center', gap: 14, margin: 16, padding: 16, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  ownerAva:      { width: 52, height: 52, borderRadius: 26, backgroundColor: C.ink, justifyContent: 'center', alignItems: 'center' },
  ownerAvaText:  { fontSize: 20, fontWeight: '800', color: '#fff' },
  ownerName:     { fontSize: 16, fontWeight: '800', color: C.ink },
  ownerEmail:    { fontSize: 12, color: C.muted, marginTop: 2 },
  ownerBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  ownerBadgeTxt: { fontSize: 11, fontWeight: '600', color: C.inkSoft, textTransform: 'capitalize' },
  statusDot:     { width: 8, height: 8, borderRadius: 4 },

  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10, marginBottom: 4 },
  statCard:      { backgroundColor: C.white, borderRadius: 14, padding: 14, width: '47%', flex: 1, alignItems: 'center', borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, marginHorizontal: 4 },
  statIcon:      { width: 44, height: 44, borderRadius: 12, backgroundColor: C.borderSoft, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  statValue:     { fontSize: 26, fontWeight: '800', color: C.ink, marginBottom: 3 },
  statLabel:     { fontSize: 12, color: C.muted, fontWeight: '500', textAlign: 'center' },

  earningsCard:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 16, padding: 18, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  earningsLabel: { fontSize: 13, color: C.muted, fontWeight: '500', marginBottom: 4 },
  earningsValue: { fontSize: 26, fontWeight: '800', color: C.ink },
  earningsSub:   { fontSize: 12, color: C.subtle, marginTop: 3 },
  earningsIcon:  { width: 56, height: 56, borderRadius: 16, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center' },

  section:       { backgroundColor: C.white, borderRadius: 16, margin: 16, marginTop: 4, padding: 16, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle:  { fontSize: 17, fontWeight: '800', color: C.ink, letterSpacing: -0.3, marginBottom: 12 },
  sectionRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAll:       { fontSize: 13, fontWeight: '600', color: C.inkSoft },

  statusGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusItem:    { flex: 1, minWidth: '22%', alignItems: 'center', backgroundColor: C.surface, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: C.borderSoft },
  statusCount:   { fontSize: 18, fontWeight: '800', color: C.ink },
  statusLabel:   { fontSize: 10, color: C.muted, fontWeight: '500', marginTop: 2, textAlign: 'center' },

  bookingCard:   { backgroundColor: C.surface, borderRadius: 12, padding: 12, marginBottom: 10, borderLeftWidth: 4, borderWidth: 1, borderColor: C.border },
  bookingHead:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  bookingAva:    { width: 36, height: 36, borderRadius: 18, backgroundColor: C.ink, justifyContent: 'center', alignItems: 'center' },
  bookingAvaTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },
  bookingName:   { fontSize: 14, fontWeight: '700', color: C.ink },
  bookingVehicle:{ fontSize: 12, color: C.muted, marginTop: 2 },
  statusPill:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusPillTxt: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  bookingMeta:   { gap: 4 },
  bookingMetaRow:{ flexDirection: 'row', alignItems: 'center', gap: 6 },
  bookingMetaTxt:{ fontSize: 12, color: C.muted },

  empty:         { alignItems: 'center', paddingVertical: 30 },
  emptyTxt:      { fontSize: 14, color: C.subtle, marginTop: 10, fontWeight: '500', textAlign: 'center' },

  quickActions:  { flexDirection: 'row', justifyContent: 'space-around' },
  quickBtn:      { alignItems: 'center', gap: 8 },
  quickIcon:     { width: 60, height: 60, borderRadius: 18, backgroundColor: C.borderSoft, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border, position: 'relative' },
  quickLabel:    { fontSize: 12, fontWeight: '600', color: C.inkSoft },
  quickBadge:    { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.unread, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.white },
  quickBadgeTxt: { fontSize: 9, fontWeight: '800', color: '#fff' },
});