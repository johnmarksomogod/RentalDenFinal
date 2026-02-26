"use strict";

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
  RefreshControl, Platform, Alert, Modal, Animated, FlatList, TextInput, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  vehiclesService, bookingsService, notificationsService,
  websiteContentService, galleryService, storageService, firebaseAuth,
} from '../services/firebaseService';
import ActionModal from '../components/AlertModal/ActionModal';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatCurrency = (a) =>
  `₱${parseFloat(a || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
const formatDate = (d) =>
  new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

// ─── Design tokens — single source of truth for colours ──────────────────────
const C = {
  ink:        '#111827',
  inkSoft:    '#374151',
  muted:      '#6b7280',
  subtle:     '#9ca3af',
  border:     '#e5e7eb',
  borderSoft: '#f3f4f6',
  surface:    '#f9fafb',
  white:      '#ffffff',
  // status
  pending:    '#f59e0b',
  confirmed:  '#10b981',
  ongoing:    '#3b82f6',
  delivered:  '#8b5cf6',
  retrieved:  '#06b6d4',
  completed:  '#6366f1',
  cancelled:  '#ef4444',
  declined:   '#f97316',
  // category accents
  driver:     '#7c3aed',
  booking:    '#0ea5e9',
  charge:     '#10b981',
  alert:      '#ef4444',
  unread:     '#f59e0b',
};

const STATUS_COLOR = {
  pending: C.pending, confirmed: C.confirmed, ongoing: C.ongoing,
  delivered: C.delivered, retrieved: C.retrieved, completed: C.completed,
  cancelled: C.cancelled, declined: C.declined,
};
const getStatusColor = (s) => STATUS_COLOR[s] || C.muted;

// ─── Category tab definitions ─────────────────────────────────────────────────
const NOTIF_FILTERS = [
  { key: 'all',      label: 'All',      icon: 'apps-outline',          accent: C.inkSoft },
  { key: 'booking',  label: 'Bookings', icon: 'document-text-outline', accent: C.booking },
  { key: 'delivery', label: 'Driver',   icon: 'car-outline',           accent: C.driver },
  { key: 'charges',  label: 'Charges',  icon: 'cash-outline',          accent: C.charge },
  { key: 'alert',    label: 'Alerts',   icon: 'alert-circle-outline',  accent: C.alert },
  { key: 'unread',   label: 'Unread',   icon: 'ellipse',               accent: C.unread },
];

const CHARGE_TYPES = [
  'driver_payment','driver_damage','driver_fuel',
  'driver_delay','driver_extra_km','driver_extra_hours',
];

const getNotifFilter = (type) => {
  if (CHARGE_TYPES.includes(type)) return 'charges';
  if (['driver_ongoing','driver_delivered','driver_retrieved','status_change'].includes(type)) return 'delivery';
  if (['new_booking','booking_confirmed','booking_completed','booking_cancelled',
       'booking_declined','pickup_today','return_today','upcoming_pickup','due_return'].includes(type)) return 'booking';
  if (['overdue'].includes(type)) return 'alert';
  return 'booking';
};

// ─────────────────────────────────────────────────────────────────────────────
// NotificationBell
// ─────────────────────────────────────────────────────────────────────────────
const NotificationBell = ({ notifications, onPress }) => {
  const [bellAnim] = useState(new Animated.Value(0));
  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (unread > 0) {
      Animated.sequence([
        Animated.timing(bellAnim, { toValue: 1,  duration: 200, useNativeDriver: true }),
        Animated.timing(bellAnim, { toValue: -1, duration: 200, useNativeDriver: true }),
        Animated.timing(bellAnim, { toValue: 0,  duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [unread]);

  const rotate = bellAnim.interpolate({ inputRange: [-1, 1], outputRange: ['-15deg', '15deg'] });

  return (
    <TouchableOpacity style={styles.notificationBell} onPress={onPress}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons
          name={unread > 0 ? 'notifications' : 'notifications-outline'}
          size={24}
          color={unread > 0 ? C.unread : C.ink}
        />
      </Animated.View>
      {unread > 0 && (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationBadgeText}>{unread > 99 ? '99+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NotificationItem
// ─────────────────────────────────────────────────────────────────────────────
const NotificationItem = ({ notification, onMarkRead, onRemove, setActionModalConfig, onNavigateToBooking }) => {
  const [showActions, setShowActions] = useState(false);

  const getNotificationIcon = (type) => {
    const map = {
      upcoming_pickup:    { name: 'car-sport',        color: C.confirmed },
      due_return:         { name: 'return-up-back',   color: C.pending },
      overdue:            { name: 'alert-circle',     color: C.cancelled },
      pickup_today:       { name: 'today',            color: C.ongoing },
      return_today:       { name: 'calendar',         color: C.delivered },
      new_booking:        { name: 'add-circle',       color: C.pending },
      booking_confirmed:  { name: 'checkmark-circle', color: C.confirmed },
      booking_completed:  { name: 'flag-outline',     color: C.completed },
      booking_cancelled:  { name: 'close-circle',     color: C.cancelled },
      booking_declined:   { name: 'ban',              color: C.declined },
      status_change:      { name: 'swap-horizontal',  color: C.delivered },
      driver_ongoing:     { name: 'navigate',         color: C.ongoing },
      driver_delivered:   { name: 'car',              color: C.delivered },
      driver_retrieved:   { name: 'return-down-back', color: C.retrieved },
      driver_payment:     { name: 'cash',             color: C.charge },
      driver_damage:      { name: 'warning',          color: C.cancelled },
      driver_fuel:        { name: 'water',            color: C.pending },
      driver_delay:       { name: 'time',             color: C.declined },
      driver_extra_km:    { name: 'speedometer',      color: C.delivered },
      driver_extra_hours: { name: 'hourglass',        color: C.retrieved },
    };
    return map[type] || { name: 'information-circle', color: C.muted };
  };

  const icon       = getNotificationIcon(notification.type);
  const filterType = getNotifFilter(notification.type);
  const isDelivery = filterType === 'delivery';
  const isCharge   = filterType === 'charges';
  const leftBorder = isDelivery ? C.driver : isCharge ? C.charge : !notification.read ? C.unread : 'transparent';

  return (
    <View style={styles.notificationWrapper}>
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !notification.read && styles.unreadNotification,
          showActions && styles.notificationItemActive,
          { borderLeftColor: leftBorder, borderLeftWidth: leftBorder !== 'transparent' ? 3 : 0 },
        ]}
        onPress={() => { onMarkRead(notification.id); if (notification.bookingId && onNavigateToBooking) onNavigateToBooking(notification.bookingId); }}
        onLongPress={() => setShowActions(true)}
        delayLongPress={500}
      >
        <View style={[styles.notifIconWrap, { backgroundColor: icon.color + '18' }]}>
          <Ionicons name={icon.name} size={19} color={icon.color} />
        </View>
        <View style={styles.notificationContent}>
          {(isDelivery || isCharge || notification.driver_name) && (
            <View style={styles.notifBadgeRow}>
              {isDelivery && (
                <View style={[styles.catBadge, { backgroundColor: C.driver + '14', borderColor: C.driver + '30' }]}>
                  <Ionicons name="car-outline" size={9} color={C.driver} />
                  <Text style={[styles.catBadgeTxt, { color: C.driver }]}>Driver</Text>
                </View>
              )}
              {isCharge && (
                <View style={[styles.catBadge, { backgroundColor: C.charge + '14', borderColor: C.charge + '30' }]}>
                  <Ionicons name="cash-outline" size={9} color={C.charge} />
                  <Text style={[styles.catBadgeTxt, { color: C.charge }]}>Charge</Text>
                </View>
              )}
              {notification.driver_name && (
                <View style={[styles.catBadge, { backgroundColor: '#d1fae5', borderColor: '#a7f3d0' }]}>
                  <Ionicons name="person" size={9} color="#059669" />
                  <Text style={[styles.catBadgeTxt, { color: '#059669' }]}>{notification.driver_name}</Text>
                </View>
              )}
            </View>
          )}
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          <Text style={styles.notificationMessage}>{notification.message}</Text>
          <Text style={styles.notificationTime}>{notification.timeAgo}</Text>
        </View>
        {!notification.read && <View style={styles.unreadDot} />}
        <TouchableOpacity style={styles.notificationMenuButton} onPress={() => setShowActions(!showActions)}>
          <Ionicons name="ellipsis-vertical" size={15} color={C.subtle} />
        </TouchableOpacity>
      </TouchableOpacity>

      {showActions && (
        <View style={styles.notificationActions}>
          {!notification.read && (
            <TouchableOpacity style={[styles.notifActionBtn, { backgroundColor: '#dcfce7' }]}
              onPress={() => { onMarkRead(notification.id); setShowActions(false); }}>
              <Ionicons name="checkmark-circle-outline" size={14} color={C.confirmed} />
              <Text style={[styles.notifActionTxt, { color: C.confirmed }]}>Mark read</Text>
            </TouchableOpacity>
          )}
          {notification.bookingId && (
            <TouchableOpacity style={[styles.notifActionBtn, { backgroundColor: '#eff6ff' }]}
              onPress={() => { if (onNavigateToBooking) onNavigateToBooking(notification.bookingId); setShowActions(false); }}>
              <Ionicons name="eye-outline" size={14} color={C.ongoing} />
              <Text style={[styles.notifActionTxt, { color: C.ongoing }]}>View Booking</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.notifActionBtn, { backgroundColor: '#fee2e2' }]}
            onPress={() => {
              setActionModalConfig({ title: 'Remove Notification', message: 'Remove this notification?',
                onConfirm: () => { onRemove(notification.id); setShowActions(false); } });
            }}>
            <Ionicons name="trash-outline" size={14} color={C.cancelled} />
            <Text style={[styles.notifActionTxt, { color: C.cancelled }]}>Remove</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.notifActionBtn, { backgroundColor: C.surface }]}
            onPress={() => setShowActions(false)}>
            <Ionicons name="close-outline" size={14} color={C.muted} />
            <Text style={[styles.notifActionTxt, { color: C.muted }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NotificationsModal — REDESIGNED
//
//  ┌────────────────────────────────────────┐
//  │  Header (title · unread count · btns) │
//  ├────────────────────────────────────────┤
//  │  ROW 1: Driver pills                  │  ← tapping one SCOPES everything
//  │  [All Drivers] [Juan] [Pedro] …       │
//  │  ─ active driver context bar ─        │
//  ├────────────────────────────────────────┤
//  │  ROW 2: Category tabs                 │  ← filters WITHIN scoped pool
//  │  [All] [Bookings] [Driver] [Charges]… │
//  ├────────────────────────────────────────┤
//  │  Notification list                    │
//  └────────────────────────────────────────┘
// ─────────────────────────────────────────────────────────────────────────────
const NotificationsModal = ({
  visible, notifications, onClose,
  onMarkRead, onMarkAllRead, onRemove,
  setActionModalConfig, onClearAll, onNavigateToBooking,
}) => {
  const [selectedDriver, setSelectedDriver] = useState(null); // null = All Drivers
  const [activeCategory, setActiveCategory] = useState('all');

  // Reset on open
  useEffect(() => { if (visible) { setSelectedDriver(null); setActiveCategory('all'); } }, [visible]);

  // 1. Unique driver names
  const driverNames = [...new Set(notifications.filter(n => n.driver_name).map(n => n.driver_name))].sort();

  // 2. Scope by selected driver
  const scopedPool = selectedDriver
    ? notifications.filter(n => n.driver_name === selectedDriver)
    : notifications;

  // 3. Category filter within scoped pool
  const visibleNotifs = scopedPool.filter(n => {
    if (activeCategory === 'all')    return true;
    if (activeCategory === 'unread') return !n.read;
    return getNotifFilter(n.type) === activeCategory;
  });

  const getCatCount    = (key) => key === 'all' ? scopedPool.length : key === 'unread' ? scopedPool.filter(n => !n.read).length : scopedPool.filter(n => getNotifFilter(n.type) === key).length;
  const totalUnread    = notifications.filter(n => !n.read).length;
  const driverUnread   = (name) => notifications.filter(n => n.driver_name === name && !n.read).length;
  const driverTotal    = (name) => notifications.filter(n => n.driver_name === name).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>

        {/* ── HEADER ── */}
        <View style={styles.notifHeader}>
          <View>
            <Text style={styles.notifHeaderTitle}>Notifications</Text>
            <Text style={styles.notifHeaderSub}>
              {totalUnread > 0 ? `${totalUnread} unread · ` : ''}{notifications.length} total
            </Text>
          </View>
          <View style={styles.notifHeaderActions}>
            <TouchableOpacity style={styles.notifHeaderBtn} onPress={onMarkAllRead}>
              <Ionicons name="checkmark-done-outline" size={14} color={C.inkSoft} />
              <Text style={styles.notifHeaderBtnTxt}>Read all</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.notifHeaderBtn, { backgroundColor: '#fee2e2', borderColor: '#fecaca' }]} onPress={onClearAll}>
              <Ionicons name="trash-outline" size={14} color={C.cancelled} />
              <Text style={[styles.notifHeaderBtnTxt, { color: C.cancelled }]}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.notifCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={C.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ══════════════════════════════════════════════════════════
            ROW 1 — DRIVER PILLS
            Only shown when there are drivers in notifications.
           ══════════════════════════════════════════════════════════ */}
        {driverNames.length > 0 && (
          <View style={styles.driverSection}>
            <View style={styles.driverSectionLabel}>
              <View style={styles.driverSectionLabelDot} />
              <Text style={styles.driverSectionLabelTxt}>Filter by Driver</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.driverPillRow}>
              {/* All Drivers pill */}
              {(() => {
                const active = !selectedDriver;
                return (
                  <TouchableOpacity
                    style={[styles.driverPill, active && styles.driverPillActive]}
                    onPress={() => { setSelectedDriver(null); setActiveCategory('all'); }}
                  >
                    <View style={[styles.driverPillAva, active && { backgroundColor: C.driver }]}>
                      <Ionicons name="apps" size={12} color={active ? '#fff' : C.muted} />
                    </View>
                    <Text style={[styles.driverPillName, active && styles.driverPillNameActive]}>All</Text>
                    <View style={[styles.driverPillBadge, active && styles.driverPillBadgeActive]}>
                      <Text style={[styles.driverPillBadgeTxt, active && { color: C.driver }]}>{notifications.length}</Text>
                    </View>
                    {totalUnread > 0 && !active && (
                      <View style={styles.driverUnreadDot}><Text style={styles.driverUnreadDotTxt}>{totalUnread}</Text></View>
                    )}
                  </TouchableOpacity>
                );
              })()}

              {driverNames.map(name => {
                const active  = selectedDriver === name;
                const total   = driverTotal(name);
                const unread  = driverUnread(name);
                return (
                  <TouchableOpacity
                    key={name}
                    style={[styles.driverPill, active && styles.driverPillActive]}
                    onPress={() => { setSelectedDriver(active ? null : name); setActiveCategory('all'); }}
                  >
                    <View style={[styles.driverPillAva, active && { backgroundColor: C.driver }]}>
                      <Text style={[styles.driverPillInitial, active && { color: '#fff' }]}>
                        {name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.driverPillName, active && styles.driverPillNameActive]} numberOfLines={1}>
                      {name}
                    </Text>
                    <View style={[styles.driverPillBadge, active && styles.driverPillBadgeActive]}>
                      <Text style={[styles.driverPillBadgeTxt, active && { color: C.driver }]}>{total}</Text>
                    </View>
                    {unread > 0 && (
                      <View style={styles.driverUnreadDot}><Text style={styles.driverUnreadDotTxt}>{unread}</Text></View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Active driver context strip */}
            {selectedDriver && (
              <View style={styles.driverCtxBar}>
                <View style={styles.driverCtxAva}>
                  <Text style={styles.driverCtxInitial}>{selectedDriver.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.driverCtxName}>{selectedDriver}</Text>
                  <Text style={styles.driverCtxSub}>
                    {scopedPool.length} notification{scopedPool.length !== 1 ? 's' : ''}
                    {scopedPool.filter(n => !n.read).length > 0
                      ? ` · ${scopedPool.filter(n => !n.read).length} unread`
                      : ' · all read'}
                  </Text>
                </View>
                <TouchableOpacity style={styles.driverCtxClose} onPress={() => { setSelectedDriver(null); setActiveCategory('all'); }}>
                  <Ionicons name="close" size={13} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════
            ROW 2 — CATEGORY TABS
            Counts reflect the currently scoped driver pool.
           ══════════════════════════════════════════════════════════ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catScroll}
          contentContainerStyle={styles.catRow}
        >
          {NOTIF_FILTERS.map(f => {
            const count  = getCatCount(f.key);
            const active = activeCategory === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.catTab, active && { backgroundColor: f.accent, borderColor: f.accent }]}
                onPress={() => setActiveCategory(f.key)}
              >
                <Ionicons name={f.icon} size={13} color={active ? '#fff' : C.muted} />
                <Text style={[styles.catTabTxt, active && { color: '#fff' }]}>{f.label}</Text>
                {count > 0 && (
                  <View style={[styles.catTabBadge, active && styles.catTabBadgeActive]}>
                    <Text style={[styles.catTabBadgeTxt, active && { color: f.accent }]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.notifDivider} />

        {/* ── NOTIFICATION LIST ── */}
        <FlatList
          data={visibleNotifs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onMarkRead={onMarkRead}
              onRemove={onRemove}
              setActionModalConfig={setActionModalConfig}
              onNavigateToBooking={onNavigateToBooking}
            />
          )}
          contentContainerStyle={styles.notificationsList}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
          ListEmptyComponent={
            <View style={styles.emptyNotifications}>
              <View style={styles.emptyNotifIcon}>
                <Ionicons name="notifications-off-outline" size={34} color={C.subtle} />
              </View>
              <Text style={styles.emptyNotificationsText}>No notifications</Text>
              <Text style={styles.emptyNotificationsSubtext}>
                {selectedDriver
                  ? `No ${activeCategory === 'all' ? '' : activeCategory + ' '}notifications for ${selectedDriver}`
                  : activeCategory === 'all' ? "You're all caught up!" : `No ${activeCategory} notifications`}
              </Text>
            </View>
          }
        />

      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// WebsiteContentModal
// ─────────────────────────────────────────────────────────────────────────────
const WebsiteContentModal = ({ visible, onClose, section, onSave, setActionModalConfig, setFeedbackModal }) => {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => { if (visible && section) fetchContent(); }, [visible, section]);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const data = await websiteContentService.getBySection(section);
      if (data) {
        if (!data.content || typeof data.content !== 'object') data.content = {};
        if (section === 'about_us'     && !data.content.stats)                    data.content.stats     = { happyCustomers: 0, dailyBookings: 0 };
        if (section === 'how_it_works' && !Array.isArray(data.content.steps))     data.content.steps     = [];
        if (section === 'faqs'         && !Array.isArray(data.content.questions)) data.content.questions = [{ question: '', answer: '' }];
        setContent(data);
      } else {
        setContent({ id: null, content: section === 'faqs' ? { questions: [{ question: '', answer: '' }] } : section === 'about_us' ? { stats: { happyCustomers: 0, dailyBookings: 0 } } : section === 'how_it_works' ? { steps: [] } : {} });
      }
    } catch { Alert.alert('Error', 'Failed to load content.'); onClose(); }
    finally { setLoading(false); }
  };

  const handleSave = () => {
    if (!content?.content) { setFeedbackModal({ visible: true, type: 'error', message: 'No content to save' }); return; }
    onClose();
    setTimeout(() => {
      setActionModalConfig({
        title: 'Save Changes', message: 'Save these changes?',
        onConfirm: async () => {
          setSaving(true);
          try { await websiteContentService.upsert(section, { content: content.content }); setFeedbackModal({ visible: true, type: 'success', message: 'Content updated!' }); onSave(); }
          catch { setFeedbackModal({ visible: true, type: 'error', message: 'Failed to save content' }); }
          finally { setSaving(false); }
        },
      });
    }, 300);
  };

  const updateField     = (field, value) => setContent(prev => ({ ...prev, content: { ...prev.content, [field]: value } }));
  const updateArrayItem = (arr, i, field, value) => setContent(prev => { const a = [...(prev.content[arr] || [])]; if (a[i]) a[i] = { ...a[i], [field]: value }; return { ...prev, content: { ...prev.content, [arr]: a } }; });
  const addArrayItem    = (arr, tmpl) => setContent(prev => ({ ...prev, content: { ...prev.content, [arr]: [...(prev.content[arr] || []), tmpl] } }));
  const removeArrayItem = (arr, i)    => setContent(prev => ({ ...prev, content: { ...prev.content, [arr]: (prev.content[arr] || []).filter((_, idx) => idx !== i) } }));

  if (!visible) return null;
  const sectionLabel = section === 'about_us' ? 'About Us' : section === 'how_it_works' ? 'How It Works' : 'FAQs';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Edit {sectionLabel}</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={C.ink} /></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {loading ? <View style={styles.loadingContainer}><Text>Loading...</Text></View> : content?.content ? (
            <>
              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} value={content.content.title || ''} onChangeText={t => updateField('title', t)} placeholder="Title" placeholderTextColor={C.subtle} />
              {section === 'about_us' && (
                <><Text style={styles.label}>Description</Text>
                <TextInput style={[styles.input, styles.textArea]} value={content.content.description || ''} onChangeText={t => updateField('description', t)} multiline numberOfLines={6} placeholderTextColor={C.subtle} /></>
              )}
              {section === 'faqs' && (Array.isArray(content.content.questions) ? content.content.questions : []).map((item, i) => (
                <View key={i} style={styles.arrayItemContainer}>
                  <View style={styles.arrayItemHeader}>
                    <Text style={styles.arrayItemTitle}>FAQ {i + 1}</Text>
                    <TouchableOpacity onPress={() => removeArrayItem('questions', i)}><Ionicons name="trash" size={22} color={C.cancelled} /></TouchableOpacity>
                  </View>
                  <Text style={styles.label}>Question</Text>
                  <TextInput style={styles.input} value={item.question || ''} onChangeText={t => updateArrayItem('questions', i, 'question', t)} placeholderTextColor={C.subtle} />
                  <Text style={styles.label}>Answer</Text>
                  <TextInput style={[styles.input, styles.textArea]} value={item.answer || ''} onChangeText={t => updateArrayItem('questions', i, 'answer', t)} multiline numberOfLines={4} placeholderTextColor={C.subtle} />
                </View>
              ))}
              {section === 'faqs' && (
                <TouchableOpacity style={styles.addButton} onPress={() => addArrayItem('questions', { question: '', answer: '' })}>
                  <Ionicons name="add-circle" size={28} color={C.ink} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// GalleryModal
// ─────────────────────────────────────────────────────────────────────────────
const GalleryModal = ({ visible, onClose, onRefresh, setActionModalConfig, setFeedbackModal }) => {
  const [images, setImages]                 = useState([]);
  const [loading, setLoading]               = useState(true);
  const [uploading, setUploading]           = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadData, setUploadData]         = useState({ image: null, preview: null, title: '', description: '', uploadedDate: new Date().toISOString().split('T')[0] });

  useEffect(() => { if (visible) fetchImages(); }, [visible]);

  const fetchImages = async () => {
    setLoading(true);
    try { const data = await galleryService.listImagesForUser(); setImages((data || []).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))); }
    catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'We need camera roll permissions.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled) { setUploadData({ ...uploadData, image: result.assets[0], preview: result.assets[0].uri }); setShowUploadForm(true); }
  };

  const handleUpload = async () => {
    if (!uploadData.image) return;
    setUploading(true);
    try {
      const fileExt  = uploadData.image.uri.split('.').pop() || 'jpg';
      const response = await fetch(uploadData.image.uri);
      const blob     = await response.blob();
      const imageUrl = await storageService.uploadGalleryImage(`${Date.now()}.${fileExt}`, blob);
      await galleryService.addImageToUserGallery({ image_url: imageUrl, title: uploadData.title || '', description: uploadData.description || '', uploaded_date: uploadData.uploadedDate, display_order: images.length, is_active: true });
      Alert.alert('Success', 'Image uploaded!');
      setShowUploadForm(false);
      setUploadData({ image: null, preview: null, title: '', description: '', uploadedDate: new Date().toISOString().split('T')[0] });
      fetchImages(); onRefresh();
    } catch { Alert.alert('Error', 'Failed to upload.'); } finally { setUploading(false); }
  };

  const deleteImage  = async (id) => { setActionModalConfig({ title: 'Delete Image', message: 'Delete this image?', loading: false, onConfirm: async () => { try { await galleryService.deleteImage(id); setFeedbackModal({ visible: true, type: 'success', message: 'Image deleted!' }); fetchImages(); onRefresh(); } catch { setFeedbackModal({ visible: true, type: 'error', message: 'Failed to delete' }); } } }); };
  const toggleActive = async (id, cur) => { try { await galleryService.updateImage(id, { is_active: !cur }); fetchImages(); onRefresh(); } catch { Alert.alert('Error', 'Failed to update'); } };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Gallery Management</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {!showUploadForm && <TouchableOpacity style={styles.uploadButton} onPress={pickImage} disabled={uploading}><Ionicons name="cloud-upload" size={20} color="#fff" /><Text style={styles.uploadButtonText}>Upload</Text></TouchableOpacity>}
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={C.ink} /></TouchableOpacity>
          </View>
        </View>
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {showUploadForm && uploadData.preview ? (
            <View style={styles.uploadFormContainer}>
              <Text style={styles.uploadFormTitle}>Upload Image Details</Text>
              <View style={styles.imagePreviewContainer}><Image source={{ uri: uploadData.preview }} style={styles.imagePreview} /></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Title (Optional)</Text><TextInput style={styles.formInput} value={uploadData.title} onChangeText={t => setUploadData({ ...uploadData, title: t })} placeholderTextColor={C.subtle} /></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Description (Optional)</Text><TextInput style={[styles.formInput, styles.formTextArea]} value={uploadData.description} onChangeText={t => setUploadData({ ...uploadData, description: t })} multiline numberOfLines={3} placeholderTextColor={C.subtle} /></View>
              <View style={styles.uploadFormActions}>
                <TouchableOpacity style={[styles.uploadFormButton, styles.confirmButton]} onPress={handleUpload} disabled={uploading}><Ionicons name="checkmark-circle" size={20} color="#fff" /><Text style={styles.uploadFormButtonText}>{uploading ? 'Uploading...' : 'Confirm Upload'}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.uploadFormButton, styles.cancelUploadButton]} onPress={() => { setShowUploadForm(false); setUploadData({ image: null, preview: null, title: '', description: '', uploadedDate: new Date().toISOString().split('T')[0] }); }} disabled={uploading}><Ionicons name="close-circle" size={20} color={C.cancelled} /><Text style={[styles.uploadFormButtonText, { color: C.cancelled }]}>Cancel</Text></TouchableOpacity>
              </View>
            </View>
          ) : loading ? <View style={styles.loadingContainer}><Text>Loading images...</Text></View>
          : images.length === 0 ? (
            <View style={styles.emptyGallery}><Ionicons name="images-outline" size={64} color="#d1d5db" /><Text style={styles.emptyGalleryText}>No images yet</Text></View>
          ) : (
            <View style={styles.galleryGrid}>
              {images.map(img => (
                <View key={img.id} style={styles.galleryItem}>
                  <Image source={{ uri: img.image_url }} style={styles.galleryImage} />
                  <View style={styles.galleryItemActions}>
                    <TouchableOpacity style={[styles.galleryActionBtn, img.is_active && styles.activeBtn]} onPress={() => toggleActive(img.id, img.is_active)}><Ionicons name={img.is_active ? 'eye' : 'eye-off'} size={16} color="#fff" /></TouchableOpacity>
                    <TouchableOpacity style={[styles.galleryActionBtn, styles.deleteBtn]} onPress={() => deleteImage(img.id)}><Ionicons name="trash" size={16} color="#fff" /></TouchableOpacity>
                  </View>
                  <View style={styles.galleryItemInfo}>
                    {img.title && <Text style={styles.galleryItemTitle} numberOfLines={1}>{img.title}</Text>}
                    <View style={styles.galleryItemMeta}><Ionicons name="calendar-outline" size={12} color={C.muted} /><Text style={styles.galleryItemDate}>{new Date(img.uploaded_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</Text></View>
                    <View style={styles.galleryItemStatus}><View style={[styles.statusBadge, { backgroundColor: img.is_active ? C.ink : C.borderSoft }]}><Text style={[styles.statusBadgeText, { color: img.is_active ? '#fff' : C.muted }]}>{img.is_active ? 'Visible' : 'Hidden'}</Text></View></View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ContactModal
// ─────────────────────────────────────────────────────────────────────────────
const ContactModal = ({ visible, onClose, onRefresh, setActionModalConfig, setFeedbackModal }) => {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => { if (visible) fetchContent(); }, [visible]);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const data = await websiteContentService.getBySection('contact');
      if (data?.content) { if (!Array.isArray(data.content.social_media)) data.content.social_media = []; setContent(data); }
    } catch { Alert.alert('Error', 'Failed to load contact information'); } finally { setLoading(false); }
  };

  const handleSave = () => {
    if (!content?.content) { setFeedbackModal({ visible: true, type: 'error', message: 'No content to save' }); return; }
    onClose();
    setTimeout(() => {
      setActionModalConfig({
        title: 'Save Changes', message: 'Save these changes?',
        onConfirm: async () => {
          setSaving(true);
          try { await websiteContentService.upsert('contact', { content: content.content }); setFeedbackModal({ visible: true, type: 'success', message: 'Contact info updated!' }); onRefresh(); }
          catch { setFeedbackModal({ visible: true, type: 'error', message: 'Failed to save' }); } finally { setSaving(false); }
        },
      });
    }, 300);
  };

  const updateField = (field, value) => setContent(prev => ({ ...prev, content: { ...prev.content, [field]: value } }));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Edit Contact Information</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={C.ink} /></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {loading ? <View style={styles.loadingContainer}><Text>Loading...</Text></View> : content?.content ? (
            <>
              {[['title','Main Title'],['subtitle','Subtitle'],['address','Address'],['mobile','Mobile Number'],['availability','Availability'],['email','Email']].map(([field, label]) => (
                <View key={field}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={content.content[field] || ''} onChangeText={t => updateField(field, t)} placeholderTextColor={C.subtle} /></View>
              ))}
              <TouchableOpacity style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PaymentTrackerModal
// ─────────────────────────────────────────────────────────────────────────────
const PaymentTrackerModal = ({ visible, onClose, bookings }) => {
  const allPayments = bookings
    .flatMap((b) => (b.payment_log || []).map((e) => ({
      ...e, booking_id: b.id, customer_name: b.customer_name,
      vehicle: `${b.vehicles?.make || ''} ${b.vehicles?.model || ''}`.trim(),
    })))
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

  const totalCollected = allPayments.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Payment Tracker</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={C.ink} /></TouchableOpacity>
        </View>
        <View style={styles.paymentTotalBanner}>
          <Text style={styles.paymentTotalLabel}>Total Collected via Driver</Text>
          <Text style={styles.paymentTotalValue}>{formatCurrency(totalCollected)}</Text>
        </View>
        {allPayments.length === 0 ? (
          <View style={styles.emptyNotifications}>
            <Ionicons name="cash-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyNotificationsText}>No payments recorded yet</Text>
            <Text style={styles.emptyNotificationsSubtext}>Payments appear after driver reports are filed</Text>
          </View>
        ) : (
          <FlatList
            data={allPayments}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.paymentLogItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentLogEvent}>{item.event}</Text>
                  <Text style={styles.paymentLogCustomer}>{item.customer_name} · {item.vehicle}</Text>
                  <Text style={styles.paymentLogTime}>{item.recorded_at ? new Date(item.recorded_at).toLocaleString() : ''}</Text>
                </View>
                <Text style={styles.paymentLogAmount}>{formatCurrency(item.amount)}</Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const [dashboardData, setDashboardData] = useState({
    totalVehicles: 0, availableVehicles: 0, activeBookings: 0, todayBookings: 0,
    monthlyRevenue: 0, pendingBookings: 0, confirmedBookings: 0, completedBookings: 0,
    cancelledBookings: 0, declinedBookings: 0, recentBookings: [],
  });
  const [allBookings, setAllBookings]             = useState([]);
  const [loading, setLoading]                     = useState(true);
  const [notifications, setNotifications]         = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentUserId, setCurrentUserId]         = useState(null);
  const [feedbackModal, setFeedbackModal]         = useState({ visible: false, type: 'success', message: '' });
  const [actionModalConfig, setActionModalConfig] = useState(null);
  const [showContentModal, setShowContentModal]   = useState(false);
  const [contentSection, setContentSection]       = useState(null);
  const [showGalleryModal, setShowGalleryModal]   = useState(false);
  const [contactModalVisible, setContactModalVisible]     = useState(false);
  const [paymentTrackerVisible, setPaymentTrackerVisible] = useState(false);

  useEffect(() => { const user = firebaseAuth.getCurrentUser(); setCurrentUserId(user?.uid ?? null); }, []);

  const createNotification = async (data) => {
    if (!currentUserId) return;
    try {
      await notificationsService.add({
        booking_id:  data.bookingId,
        title:       data.title,
        message:     data.message,
        type:        data.type,
        driver_name: data.driverName || null,
        read:        false,
        dismissed:   false,
      });
    } catch {}
  };

  const generateNotifications = async (bookings) => {
    if (!currentUserId) return;
    const today = new Date();
    for (const booking of bookings) {
      const startDate = new Date(booking.rental_start_date);
      const daysDiff  = Math.ceil((startDate - today) / (1000 * 3600 * 24));
      const existing  = await notificationsService.listByBookingId(booking.id);
      const types     = new Set(existing?.map(n => n.type) || []);
      const driver    = booking.assigned_driver || 'Driver';
      const vehicle   = `${booking.vehicles?.year || ''} ${booking.vehicles?.make || ''} ${booking.vehicles?.model || ''}`.trim();
      const customer  = booking.customer_name;

      if (booking.status === 'pending'   && !types.has('new_booking'))
        await createNotification({ bookingId: booking.id, type: 'new_booking',       title: '📋 New Booking Request', message: `${customer} requested ${vehicle}` });
      if (booking.status === 'confirmed' && daysDiff === 0 && !types.has('pickup_today'))
        await createNotification({ bookingId: booking.id, type: 'pickup_today',       title: '📅 Pickup Today',        message: `${customer} is picking up ${vehicle} today` });
      if (booking.status === 'completed' && !types.has('booking_completed'))
        await createNotification({ bookingId: booking.id, type: 'booking_completed', title: '✅ Booking Completed',    message: `${customer}'s booking for ${vehicle} is now complete. Total: ${formatCurrency(booking.total_price)}` });
      if (booking.status === 'cancelled' && !types.has('booking_cancelled'))
        await createNotification({ bookingId: booking.id, type: 'booking_cancelled', title: '❌ Booking Cancelled',    message: `${customer}'s booking for ${vehicle} was cancelled` });
      if (booking.status === 'declined'  && !types.has('booking_declined'))
        await createNotification({ bookingId: booking.id, type: 'booking_declined',  title: '🚫 Booking Declined',    message: `${customer}'s booking for ${vehicle} was declined` });

      if (booking.delivery_option === 'deliver') {
        if (booking.status === 'ongoing'   && !types.has('driver_ongoing'))
          await createNotification({ bookingId: booking.id, type: 'driver_ongoing',   driverName: driver, title: '🚗 Driver En Route',    message: `[${driver}] is driving ${vehicle} to ${customer}` });
        if (booking.status === 'delivered' && !types.has('driver_delivered'))
          await createNotification({ bookingId: booking.id, type: 'driver_delivered', driverName: driver, title: '📦 Vehicle Delivered',   message: `[${driver}] delivered ${vehicle} to ${customer}` });
        if (booking.status === 'retrieved' && !types.has('driver_retrieved'))
          await createNotification({ bookingId: booking.id, type: 'driver_retrieved', driverName: driver, title: '🔁 Vehicle Retrieved',   message: `[${driver}] retrieved ${vehicle} from ${customer}` });

        const payments = booking.payment_log || [];
        for (let i = 0; i < payments.length; i++) {
          if (!types.has(`driver_payment_${i}`))
            await createNotification({ bookingId: booking.id, type: 'driver_payment', driverName: driver, title: '💰 Payment Collected',
              message: `[${driver}] collected ${formatCurrency(payments[i].amount)} from ${customer}${payments[i].event ? ` — ${payments[i].event}` : ''}` });
        }
        if (booking.damage_fee      > 0 && !types.has('driver_damage'))
          await createNotification({ bookingId: booking.id, type: 'driver_damage',       driverName: driver, title: '⚠️ Damage Fee',         message: `[${driver}] reported damage charge of ${formatCurrency(booking.damage_fee)} — ${customer}'s ${vehicle}` });
        if (booking.fuel_charge     > 0 && !types.has('driver_fuel'))
          await createNotification({ bookingId: booking.id, type: 'driver_fuel',         driverName: driver, title: '⛽ Fuel Charge',         message: `[${driver}] reported fuel charge of ${formatCurrency(booking.fuel_charge)} for ${customer}` });
        if (booking.delay_charge    > 0 && !types.has('driver_delay'))
          await createNotification({ bookingId: booking.id, type: 'driver_delay',        driverName: driver, title: '⏱ Delay Charge',        message: `[${driver}] recorded delay charge of ${formatCurrency(booking.delay_charge)} for ${customer}` });
        if (booking.extra_km_charge > 0 && !types.has('driver_extra_km'))
          await createNotification({ bookingId: booking.id, type: 'driver_extra_km',     driverName: driver, title: '📍 Extra KM Charge',     message: `[${driver}] recorded extra km charge of ${formatCurrency(booking.extra_km_charge)} for ${customer}` });
        if (booking.extra_hours_charge > 0 && !types.has('driver_extra_hours'))
          await createNotification({ bookingId: booking.id, type: 'driver_extra_hours',  driverName: driver, title: '⏰ Extra Hours Charge',  message: `[${driver}] recorded extra hours charge of ${formatCurrency(booking.extra_hours_charge)} for ${customer}` });
      }
    }
    await fetchNotifications();
  };

  const fetchNotifications = async () => {
    if (!currentUserId) return;
    try {
      const data = await notificationsService.listUnread();
      const formatted = (data || []).map(n => {
        const diffMin = Math.floor((new Date() - new Date(n.created_at)) / 60000);
        const timeAgo = diffMin < 1 ? 'Just now' : diffMin < 60 ? `${diffMin}m ago` : diffMin < 1440 ? `${Math.floor(diffMin / 60)}h ago` : `${Math.floor(diffMin / 1440)}d ago`;
        return { ...n, timeAgo, bookingId: n.booking_id, driver_name: n.driver_name || null };
      });
      setNotifications(formatted);
    } catch {}
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const today      = new Date();
      const startOfMon = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMon   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const todayStr   = today.toISOString().split('T')[0];
      const [vehicles, bookings] = await Promise.all([vehiclesService.list(), bookingsService.listWithDetails()]);
      setAllBookings(bookings || []);
      const rentedIds = new Set(bookings?.filter(b => ['confirmed','pending'].includes(b.status) && new Date(b.rental_start_date) <= today && new Date(b.rental_end_date) >= today).map(b => b.vehicle_id) || []);
      setDashboardData({
        totalVehicles:     vehicles?.length || 0,
        availableVehicles: vehicles?.filter(v => !rentedIds.has(v.id)).length || 0,
        activeBookings:    bookings?.filter(b => ['confirmed','pending'].includes(b.status)).length || 0,
        todayBookings:     bookings?.filter(b => new Date(b.created_at).toISOString().split('T')[0] === todayStr).length || 0,
        monthlyRevenue:    bookings?.filter(b => b.status === 'completed' && b.total_price > 0 && b.updated_at && new Date(b.updated_at) >= startOfMon && new Date(b.updated_at) <= endOfMon).reduce((s, b) => s + parseFloat(b.total_price), 0) || 0,
        pendingBookings:   bookings?.filter(b => b.status === 'pending').length   || 0,
        confirmedBookings: bookings?.filter(b => b.status === 'confirmed').length || 0,
        completedBookings: bookings?.filter(b => b.status === 'completed').length || 0,
        cancelledBookings: bookings?.filter(b => b.status === 'cancelled').length || 0,
        declinedBookings:  bookings?.filter(b => b.status === 'declined').length  || 0,
        recentBookings:    bookings?.slice(0, 5) || [],
      });
      await generateNotifications(bookings || []);
    } catch { Alert.alert('Error', 'Failed to fetch dashboard data'); } finally { setLoading(false); }
  };

  useEffect(() => { if (currentUserId) fetchDashboardData(); }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    const uV = vehiclesService.subscribe(() => fetchDashboardData(), () => {});
    const uB = bookingsService.subscribe(() => fetchDashboardData(), () => {});
    const uN = notificationsService.subscribe(() => fetchNotifications(), () => {});
    return () => { uV(); uB(); uN(); };
  }, [currentUserId]);

  const handleLogout               = () => setActionModalConfig({ title: 'Logout', message: 'Are you sure you want to logout?', onConfirm: async () => { try { await firebaseAuth.signOut(); } catch { setFeedbackModal({ visible: true, type: 'error', message: 'Failed to logout.' }); } } });
  const handleMarkNotificationRead = async (id) => { try { setNotifications(p => p.map(n => n.id === id ? { ...n, read: true } : n)); await notificationsService.update(id, { read: true }); } catch {} };
  const handleMarkAllRead          = async ()   => { try { setNotifications(p => p.map(n => ({ ...n, read: true }))); await notificationsService.markAllRead(); } catch {} };
  const handleClearAll             = ()         => setActionModalConfig({ title: 'Clear All', message: 'Clear all notifications?', onConfirm: async () => { try { setNotifications([]); await notificationsService.markAllDismissed(); setFeedbackModal({ visible: true, type: 'success', message: 'All notifications cleared!' }); } catch { setFeedbackModal({ visible: true, type: 'error', message: 'Failed to clear.' }); } } });
  const handleRemoveNotification   = async (id) => { try { setNotifications(p => p.filter(n => n.id !== id)); await notificationsService.update(id, { dismissed: true }); } catch {} };
  const handleNavigateToBooking    = (id)       => { setShowNotifications(false); navigation?.navigate?.('Bookings', { screen: 'BookingsList', params: { openBookingId: id, openInEditMode: true } }); };

  const countByStatus = (st) => allBookings.filter(b => b.status === st).length;

  const StatCard = ({ title, value, icon, color, onPress }) => (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.statContent}>
        <Ionicons name={icon} size={28} color={color} style={styles.statIcon} />
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  const StatusRow = ({ items }) => (
    <View style={styles.statusGrid}>
      {items.map(({ label, color, count }) => (
        <View key={label} style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <View><Text style={styles.statusValue}>{count}</Text><Text style={styles.statusLabel}>{label}</Text></View>
        </View>
      ))}
    </View>
  );

  const deliveryBookings = allBookings.filter(b =>
    b.delivery_option === 'deliver' && ['confirmed','ongoing','delivered','retrieved'].includes(b.status)
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Welcome back!</Text>
        </View>
        <View style={styles.headerActions}>
          <NotificationBell notifications={notifications} onPress={() => setShowNotifications(true)} />
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color={C.ink} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDashboardData} />}
        contentContainerStyle={styles.scrollContainer}
      >
        <View style={styles.statsContainer}>
          <StatCard title="Total Vehicles"  value={dashboardData.totalVehicles}     icon="car"              color={C.ink} onPress={() => navigation?.navigate?.('Vehicles')} />
          <StatCard title="Available"        value={dashboardData.availableVehicles} icon="checkmark-circle" color={C.ink} onPress={() => navigation?.navigate?.('Vehicles')} />
          <StatCard title="Active Rentals"   value={dashboardData.activeBookings}    icon="time"             color={C.ink} onPress={() => navigation?.navigate?.('Bookings')} />
          <StatCard title="Today's Bookings" value={dashboardData.todayBookings}     icon="calendar"         color={C.ink} onPress={() => navigation?.navigate?.('Bookings')} />
        </View>

        <View style={styles.revenueCard}>
          <View style={styles.revenueHeader}><Text style={styles.sectionTitle}>Monthly Revenue</Text></View>
          <View style={styles.revenueContent}>
            <View>
              <Text style={styles.revenueValue}>{formatCurrency(dashboardData.monthlyRevenue)}</Text>
              <Text style={styles.revenueSubtext}>{new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</Text>
            </View>
            <View style={styles.revenueIconContainer}>
              <Ionicons name="trending-up" size={32} color={C.confirmed} />
            </View>
          </View>
        </View>

        <View style={styles.statusOverviewCard}>
          <Text style={styles.sectionTitle}>Booking Status Overview</Text>
          <StatusRow items={[{ label: 'Pending', color: C.pending, count: dashboardData.pendingBookings }, { label: 'Confirmed', color: C.confirmed, count: dashboardData.confirmedBookings }]} />
          <StatusRow items={[{ label: 'Ongoing', color: C.ongoing, count: countByStatus('ongoing') }, { label: 'Delivered', color: C.delivered, count: countByStatus('delivered') }]} />
          <StatusRow items={[{ label: 'Retrieved', color: C.retrieved, count: countByStatus('retrieved') }, { label: 'Completed', color: C.completed, count: dashboardData.completedBookings }]} />
          <StatusRow items={[{ label: 'Cancelled', color: C.cancelled, count: dashboardData.cancelledBookings }, { label: 'Declined', color: C.declined, count: dashboardData.declinedBookings }]} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Driver Assignments</Text>
              <Text style={styles.sectionSubtitle}>{deliveryBookings.length} active deliver{deliveryBookings.length !== 1 ? 'ies' : 'y'}</Text>
            </View>
            <View style={{ gap: 8, alignItems: 'flex-end' }}>
              <TouchableOpacity onPress={() => setPaymentTrackerVisible(true)} style={styles.paymentTrackerBtn}>
                <Ionicons name="cash-outline" size={14} color="#fff" />
                <Text style={styles.paymentTrackerBtnText}>Payment Log</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => navigation?.navigate?.('Bookings')} style={styles.viewAllBtn}>
                <Text style={styles.viewAllBtnText}>View All</Text>
                <Ionicons name="chevron-forward" size={14} color={C.inkSoft} />
              </TouchableOpacity>
            </View>
          </View>
          {deliveryBookings.length === 0 ? (
            <View style={styles.emptyState}><Ionicons name="car-outline" size={40} color="#d1d5db" /><Text style={styles.emptyStateText}>No active delivery bookings</Text></View>
          ) : deliveryBookings.slice(0, 4).map(booking => (
            <TouchableOpacity key={booking.id} style={styles.driverBookingItem}
              onPress={() => navigation?.navigate?.('Bookings', { screen: 'BookingsList', params: { openBookingId: booking.id } })} activeOpacity={0.75}>
              <View style={[styles.bookingStatusBar, { backgroundColor: getStatusColor(booking.status) }]} />
              <View style={styles.driverBookingInfo}>
                <Text style={styles.driverBookingCustomer}>{booking.customer_name}</Text>
                <Text style={styles.driverBookingVehicle}>{booking.vehicles?.year} {booking.vehicles?.make} {booking.vehicles?.model}</Text>
                <Text style={styles.driverBookingAddress} numberOfLines={1}>📍 {booking.delivery_address || booking.pickup_location || '—'}</Text>
                {booking.assigned_driver ? (
                  <View style={styles.driverChip}><Ionicons name="person" size={11} color="#065f46" /><Text style={styles.driverChipText}>{booking.assigned_driver}</Text></View>
                ) : (
                  <View style={styles.noDriverChip}><Ionicons name="person-outline" size={11} color="#92400e" /><Text style={styles.noDriverChipText}>No driver assigned</Text></View>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6, justifyContent: 'center' }}>
                <View style={[styles.statusMiniPill, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                  <Text style={[styles.statusMiniText, { color: getStatusColor(booking.status) }]}>{booking.status}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
              </View>
            </TouchableOpacity>
          ))}
          {deliveryBookings.length > 4 && (
            <TouchableOpacity style={styles.showMoreBtn} onPress={() => navigation?.navigate?.('Bookings')}>
              <Text style={styles.showMoreTxt}>+{deliveryBookings.length - 4} more bookings — View all</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            <TouchableOpacity onPress={() => navigation?.navigate?.('Bookings')}><Text style={styles.viewAllText}>View All</Text></TouchableOpacity>
          </View>
          {dashboardData.recentBookings.length > 0 ? dashboardData.recentBookings.map(booking => (
            <View key={booking.id} style={styles.bookingItem}>
              <View style={styles.bookingLeft}>
                <View style={[styles.bookingStatusBar, { backgroundColor: getStatusColor(booking.status) }]} />
                <View style={styles.bookingInfo}>
                  <View style={styles.bookingNameRow}><Ionicons name="person" size={14} color={C.muted} /><Text style={styles.bookingCustomer}>{booking.customer_name}</Text></View>
                  {booking.vehicles && <View style={styles.bookingVehicleRow}><Ionicons name="car" size={12} color={C.muted} /><Text style={styles.bookingVehicle}>{booking.vehicles.year} {booking.vehicles.make} {booking.vehicles.model}</Text></View>}
                  {booking.vehicle_variants?.plate_number && <View style={styles.bookingPlateRow}><Ionicons name="card" size={12} color={C.muted} /><Text style={styles.bookingVehicle}>{booking.vehicle_variants.plate_number}</Text></View>}
                  <View style={styles.bookingDateRow}><Ionicons name="calendar-outline" size={12} color={C.muted} /><Text style={styles.bookingDate}>{formatDate(booking.rental_start_date)} - {formatDate(booking.rental_end_date)}</Text></View>
                </View>
              </View>
              <View style={styles.bookingRight}>
                <Text style={styles.bookingAmount}>{formatCurrency(booking.total_price)}</Text>
                <Text style={[styles.bookingStatusText, { color: getStatusColor(booking.status) }]}>{booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}</Text>
              </View>
            </View>
          )) : (
            <View style={styles.emptyState}><Ionicons name="document-text-outline" size={48} color="#d1d5db" /><Text style={styles.emptyStateText}>No recent bookings</Text></View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Website Management</Text></View>
          {[
            { icon: 'information-circle-outline', title: 'About Us',     desc: 'Edit title, description & statistics', onPress: () => { setContentSection('about_us');    setShowContentModal(true); } },
            { icon: 'list-outline',               title: 'How It Works', desc: 'Manage rental process steps',          onPress: () => { setContentSection('how_it_works'); setShowContentModal(true); } },
            { icon: 'help-circle-outline',        title: 'FAQs',         desc: 'Update frequently asked questions',    onPress: () => { setContentSection('faqs');         setShowContentModal(true); } },
          ].map(item => (
            <TouchableOpacity key={item.title} style={styles.websiteCardFull} onPress={item.onPress} activeOpacity={0.75}>
              <View style={styles.websiteCardIconBox}><Ionicons name={item.icon} size={22} color={C.ink} /></View>
              <View style={{ flex: 1 }}><Text style={styles.websiteCardTitle}>{item.title}</Text><Text style={styles.websiteCardDesc}>{item.desc}</Text></View>
              <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
            </TouchableOpacity>
          ))}
          <View style={styles.websiteTileRow}>
            <TouchableOpacity style={styles.websiteTile} onPress={() => setShowGalleryModal(true)} activeOpacity={0.75}>
              <View style={[styles.websiteTileIcon, { backgroundColor: '#f0f9ff' }]}><Ionicons name="images-outline" size={26} color={C.booking} /></View>
              <Text style={styles.websiteTileTitle}>Gallery</Text>
              <Text style={styles.websiteTileDesc}>Upload & manage images</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.websiteTile} onPress={() => setContactModalVisible(true)} activeOpacity={0.75}>
              <View style={[styles.websiteTileIcon, { backgroundColor: '#fdf4ff' }]}><Ionicons name="call-outline" size={26} color={C.driver} /></View>
              <Text style={styles.websiteTileTitle}>Contact Info</Text>
              <Text style={styles.websiteTileDesc}>Edit contact & social</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <NotificationsModal
        visible={showNotifications}
        notifications={notifications}
        onClose={() => setShowNotifications(false)}
        onMarkRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllRead}
        onClearAll={handleClearAll}
        onRemove={handleRemoveNotification}
        setActionModalConfig={setActionModalConfig}
        onNavigateToBooking={handleNavigateToBooking}
      />
      <WebsiteContentModal visible={showContentModal} onClose={() => { setShowContentModal(false); setContentSection(null); }} section={contentSection} onSave={fetchDashboardData} setActionModalConfig={setActionModalConfig} setFeedbackModal={setFeedbackModal} />
      <GalleryModal visible={showGalleryModal} onClose={() => setShowGalleryModal(false)} onRefresh={fetchDashboardData} setActionModalConfig={setActionModalConfig} setFeedbackModal={setFeedbackModal} />
      <ContactModal visible={contactModalVisible} onClose={() => setContactModalVisible(false)} onRefresh={fetchDashboardData} setActionModalConfig={setActionModalConfig} setFeedbackModal={setFeedbackModal} />
      <PaymentTrackerModal visible={paymentTrackerVisible} onClose={() => setPaymentTrackerVisible(false)} bookings={allBookings} />

      {actionModalConfig && (
        <ActionModal visible={!!actionModalConfig} type="confirm" title={actionModalConfig.title} message={actionModalConfig.message} loading={actionModalConfig.loading || false} onClose={() => setActionModalConfig(null)} onConfirm={async () => { if (actionModalConfig.onConfirm) await actionModalConfig.onConfirm(); setActionModalConfig(null); }} />
      )}
      <ActionModal visible={feedbackModal.visible} type={feedbackModal.type} title={feedbackModal.type === 'success' ? 'Success' : 'Error'} message={feedbackModal.message} confirmText="OK" onClose={() => setFeedbackModal({ visible: false, type: 'success', message: '' })} onConfirm={() => setFeedbackModal({ visible: false, type: 'success', message: '' })} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#fcfcfc', paddingHorizontal: 18, paddingTop: 8 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 8 },
  headerLeft:     { flex: 1 },
  headerTitle:    { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 14, color: C.muted, marginTop: 2 },
  headerActions:  { flexDirection: 'row', alignItems: 'center', gap: 12 },

  // Bell
  notificationBell:      { position: 'relative', padding: 10, borderRadius: 8 },
  notificationBadge:     { position: 'absolute', top: 4, right: 4, backgroundColor: C.unread, borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  notificationBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  logoutButton:          { padding: 8, borderRadius: 8, backgroundColor: C.borderSoft },

  // ── Notification modal ─────────────────────────────────────────────────────
  modalContainer: { flex: 1, backgroundColor: C.white, flexDirection: 'column' },

  // Header
  notifHeader:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  notifHeaderTitle:   { fontSize: 20, fontWeight: '800', color: C.ink },
  notifHeaderSub:     { fontSize: 12, color: C.subtle, marginTop: 2 },
  notifHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  notifHeaderBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: C.surface, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  notifHeaderBtnTxt:  { fontSize: 12, fontWeight: '600', color: C.inkSoft },
  notifCloseBtn:      { width: 30, height: 30, borderRadius: 15, backgroundColor: C.borderSoft, justifyContent: 'center', alignItems: 'center', marginLeft: 2 },

  // ── ROW 1: Driver section ──────────────────────────────────────────────────
  driverSection:       { paddingTop: 12, paddingBottom: 0, backgroundColor: '#fafbff', borderBottomWidth: 1, borderBottomColor: C.border },
  driverSectionLabel:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 9 },
  driverSectionLabelDot:{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.driver },
  driverSectionLabelTxt:{ fontSize: 11, fontWeight: '700', color: C.driver, textTransform: 'uppercase', letterSpacing: 0.6 },

  driverPillRow:      { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 11 },
  driverPill:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 22, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, maxWidth: 160, position: 'relative' },
  driverPillActive:   { backgroundColor: C.driver + '10', borderColor: C.driver },
  driverPillAva:      { width: 24, height: 24, borderRadius: 12, backgroundColor: C.borderSoft, justifyContent: 'center', alignItems: 'center' },
  driverPillInitial:  { fontSize: 11, fontWeight: '800', color: C.inkSoft },
  driverPillName:     { fontSize: 12, fontWeight: '600', color: C.inkSoft, flex: 1 },
  driverPillNameActive:{ color: C.driver, fontWeight: '700' },
  driverPillBadge:    { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.borderSoft, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  driverPillBadgeActive:{ backgroundColor: C.driver + '18' },
  driverPillBadgeTxt: { fontSize: 10, fontWeight: '700', color: C.inkSoft },
  driverUnreadDot:    { position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.unread, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.white },
  driverUnreadDotTxt: { fontSize: 9, fontWeight: '800', color: '#fff' },

  // Active driver context bar
  driverCtxBar:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginBottom: 11, padding: 10, backgroundColor: C.driver, borderRadius: 11 },
  driverCtxAva:    { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  driverCtxInitial:{ fontSize: 13, fontWeight: '800', color: '#fff' },
  driverCtxName:   { fontSize: 13, fontWeight: '800', color: '#fff' },
  driverCtxSub:    { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },
  driverCtxClose:  { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  // ── ROW 2: Category tabs ───────────────────────────────────────────────────
  catScroll: { maxHeight: 62, backgroundColor: C.white },
  catRow:    { flexDirection: 'row', paddingHorizontal: 16, gap: 7, paddingTop: 8, paddingBottom: 12 },
  catTab:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
  catTabTxt: { fontSize: 12, fontWeight: '600', color: C.muted },
  catTabBadge:      { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.border, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  catTabBadgeActive:{ backgroundColor: 'rgba(255,255,255,0.9)' },
  catTabBadgeTxt:   { fontSize: 10, fontWeight: '700', color: C.inkSoft },

  notifDivider: { height: 1, backgroundColor: C.border },

  // ── Notification items ─────────────────────────────────────────────────────
  notificationsList:     { paddingHorizontal: 14, paddingVertical: 12 },
  notificationWrapper:   { marginBottom: 9 },
  notificationItem:      { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 13, paddingHorizontal: 12, backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, position: 'relative' },
  unreadNotification:    { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  notificationItemActive:{ borderColor: C.ongoing, backgroundColor: '#eff6ff' },
  notifIconWrap:         { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginRight: 11 },
  notificationContent:   { flex: 1 },
  notifBadgeRow:         { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  catBadge:              { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7, borderWidth: 1 },
  catBadgeTxt:           { fontSize: 10, fontWeight: '700' },
  notificationTitle:     { fontSize: 13.5, fontWeight: '700', color: C.ink, marginBottom: 3 },
  notificationMessage:   { fontSize: 12.5, color: C.muted, marginBottom: 5, lineHeight: 18 },
  notificationTime:      { fontSize: 11, color: C.subtle, fontWeight: '500' },
  unreadDot:             { width: 8, height: 8, borderRadius: 4, backgroundColor: C.unread, position: 'absolute', top: 14, right: 38 },
  notificationMenuButton:{ padding: 8, borderRadius: 6 },
  notificationActions:   { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', paddingHorizontal: 10, paddingVertical: 8, backgroundColor: C.surface, borderRadius: 8, marginTop: 4, gap: 7 },
  notifActionBtn:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 7, gap: 5 },
  notifActionTxt:        { fontSize: 12, fontWeight: '600' },

  emptyNotifications:        { alignItems: 'center', paddingVertical: 60 },
  emptyNotifIcon:            { width: 68, height: 68, borderRadius: 34, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: C.border },
  emptyNotificationsText:    { fontSize: 16, fontWeight: '700', color: C.inkSoft, marginBottom: 4 },
  emptyNotificationsSubtext: { fontSize: 13, color: C.subtle, textAlign: 'center', paddingHorizontal: 24 },

  // Generic modal shared (non-notification modals)
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  modalTitle:     { fontSize: 20, fontWeight: '700', color: C.ink },
  modalContent:   { flex: 1, padding: 20 },

  // Form
  label:              { fontSize: 14, fontWeight: '600', color: C.inkSoft, marginBottom: 8, marginTop: 12 },
  input:              { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: C.white, color: C.ink },
  textArea:           { minHeight: 100, textAlignVertical: 'top' },
  addButton:          { padding: 4 },
  arrayItemContainer: { backgroundColor: C.surface, borderRadius: 8, padding: 12, marginTop: 12, borderWidth: 1, borderColor: C.border },
  arrayItemHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  arrayItemTitle:     { fontSize: 14, fontWeight: '600', color: C.inkSoft },
  saveButton:         { backgroundColor: C.ink, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  saveButtonDisabled: { backgroundColor: C.subtle, opacity: 0.6 },
  saveButtonText:     { color: 'white', fontSize: 16, fontWeight: '600' },
  loadingContainer:   { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },

  // Gallery
  uploadButton:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.ink, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  uploadButtonText:      { color: 'white', fontSize: 14, fontWeight: '500' },
  emptyGallery:          { alignItems: 'center', paddingVertical: 60 },
  emptyGalleryText:      { fontSize: 16, fontWeight: '500', color: C.muted, marginTop: 12 },
  galleryGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 20 },
  galleryItem:           { width: (width - 64) / 2, backgroundColor: C.white, borderRadius: 8, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  galleryImage:          { width: '100%', height: 120, resizeMode: 'cover' },
  galleryItemActions:    { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 6 },
  galleryActionBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  activeBtn:             { backgroundColor: C.ink },
  deleteBtn:             { backgroundColor: 'rgba(239,68,68,0.8)' },
  galleryItemInfo:       { padding: 8 },
  galleryItemTitle:      { fontSize: 14, fontWeight: '600', color: C.ink, marginBottom: 4 },
  galleryItemMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  galleryItemDate:       { fontSize: 11, color: C.muted },
  galleryItemStatus:     { marginTop: 6 },
  statusBadge:           { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  statusBadgeText:       { fontSize: 10, fontWeight: '600' },
  uploadFormContainer:   { backgroundColor: C.surface, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  uploadFormTitle:       { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 16 },
  imagePreviewContainer: { width: '100%', height: 200, borderRadius: 8, overflow: 'hidden', marginBottom: 16 },
  imagePreview:          { width: '100%', height: '100%', resizeMode: 'cover' },
  formGroup:             { marginBottom: 16 },
  formLabel:             { fontSize: 14, fontWeight: '600', color: C.inkSoft, marginBottom: 8 },
  formInput:             { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: C.white, color: C.ink },
  formTextArea:          { minHeight: 80, textAlignVertical: 'top' },
  uploadFormActions:     { flexDirection: 'column', gap: 10, marginTop: 8 },
  uploadFormButton:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, gap: 8 },
  confirmButton:         { backgroundColor: C.ink },
  cancelUploadButton:    { backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  uploadFormButtonText:  { fontSize: 14, fontWeight: '600', color: 'white' },

  // Dashboard layout
  scrollView:      { flex: 1 },
  scrollContainer: { paddingBottom: Platform.OS === 'ios' ? 100 : 80 },

  // Stat cards
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  statCard:       { backgroundColor: C.white, borderRadius: 16, padding: 16, width: '49%', marginBottom: 16, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 3.84, elevation: 3, alignItems: 'center' },
  statContent:    { alignItems: 'center' },
  statIcon:       { marginBottom: 8 },
  statValue:      { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statTitle:      { color: C.inkSoft, fontSize: 12, fontWeight: '500', textAlign: 'center' },

  // Revenue
  revenueCard:         { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 3.84, elevation: 3 },
  revenueHeader:       { marginBottom: 12 },
  revenueContent:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  revenueValue:        { fontSize: 28, fontWeight: 'bold', color: C.confirmed, marginBottom: 4 },
  revenueSubtext:      { fontSize: 14, color: C.subtle, fontWeight: '500' },
  revenueIconContainer:{ backgroundColor: C.confirmed + '18', padding: 12, borderRadius: 12 },

  // Status overview
  statusOverviewCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 3.84, elevation: 3 },
  statusGrid:         { flexDirection: 'row', gap: 12, marginTop: 12 },
  statusItem:         { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: C.surface, borderRadius: 10, gap: 10, borderWidth: 1, borderColor: C.borderSoft },
  statusDot:          { width: 12, height: 12, borderRadius: 6 },
  statusValue:        { fontSize: 20, fontWeight: '800', color: C.ink },
  statusLabel:        { fontSize: 11, color: C.muted, fontWeight: '500', marginTop: 1 },

  // Sections
  section:        { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 3.84, elevation: 3 },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  sectionTitle:   { fontWeight: '800', fontSize: 17, letterSpacing: -0.3, color: C.ink },
  sectionSubtitle:{ fontSize: 12, color: C.subtle, marginTop: 2 },
  viewAllText:    { fontSize: 14, color: C.ink, fontWeight: '600' },
  viewAllBtn:     { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: C.borderSoft, borderRadius: 8 },
  viewAllBtnText: { fontSize: 12, color: C.inkSoft, fontWeight: '600' },
  showMoreBtn:    { marginTop: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: C.surface, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  showMoreTxt:    { fontSize: 13, color: C.muted, fontWeight: '500' },

  // Driver assignments
  paymentTrackerBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.ink, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  paymentTrackerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  driverBookingItem:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: C.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.border, gap: 10 },
  bookingStatusBar:      { width: 4, alignSelf: 'stretch', borderRadius: 4 },
  driverBookingInfo:     { flex: 1 },
  driverBookingCustomer: { fontSize: 14, fontWeight: '700', color: C.ink },
  driverBookingVehicle:  { fontSize: 12, color: C.inkSoft, marginTop: 2 },
  driverBookingAddress:  { fontSize: 11, color: C.muted, marginTop: 2 },
  driverChip:            { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  driverChipText:        { fontSize: 11, fontWeight: '600', color: '#065f46' },
  noDriverChip:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  noDriverChipText:      { fontSize: 11, fontWeight: '600', color: '#92400e' },
  statusMiniPill:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusMiniText:        { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  // Recent bookings
  bookingItem:      { flexDirection: 'row', alignItems: 'stretch', marginBottom: 10, backgroundColor: C.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, minHeight: 80 },
  bookingLeft:      { flexDirection: 'row', alignItems: 'stretch', flex: 1, marginRight: 12, minWidth: 0 },
  bookingInfo:      { flex: 1, justifyContent: 'center', minWidth: 0 },
  bookingNameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  bookingCustomer:  { fontWeight: 'bold', fontSize: 15, color: C.ink },
  bookingVehicleRow:{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  bookingPlateRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  bookingVehicle:   { fontSize: 13, color: C.muted },
  bookingDateRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bookingDate:      { fontSize: 11, color: C.subtle },
  bookingRight:     { alignItems: 'flex-end', justifyContent: 'center' },
  bookingAmount:    { fontWeight: 'bold', fontSize: 15, color: C.ink, marginBottom: 4 },
  bookingStatusText:{ fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

  emptyState:    { alignItems: 'center', paddingVertical: 40 },
  emptyStateText:{ color: C.muted, fontWeight: '500', fontSize: 15, marginTop: 12 },

  // Website management
  websiteCardFull:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  websiteCardIconBox: { width: 42, height: 42, borderRadius: 10, backgroundColor: C.white, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  websiteCardTitle:   { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 2 },
  websiteCardDesc:    { fontSize: 12, color: C.subtle, lineHeight: 16 },
  websiteTileRow:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  websiteTile:        { flex: 1, backgroundColor: C.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.border, alignItems: 'center' },
  websiteTileIcon:    { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  websiteTileTitle:   { fontSize: 13, fontWeight: '700', color: C.ink, marginBottom: 3, textAlign: 'center' },
  websiteTileDesc:    { fontSize: 11, color: C.subtle, textAlign: 'center', lineHeight: 15 },

  // Payment tracker
  paymentTotalBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 16, padding: 16, backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1, borderColor: '#d1fae5' },
  paymentTotalLabel:  { fontSize: 14, fontWeight: '600', color: '#166534' },
  paymentTotalValue:  { fontSize: 20, fontWeight: '800', color: '#15803d' },
  paymentLogItem:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  paymentLogEvent:    { fontSize: 14, fontWeight: '600', color: C.ink },
  paymentLogCustomer: { fontSize: 12, color: C.muted, marginTop: 2 },
  paymentLogTime:     { fontSize: 11, color: C.subtle, marginTop: 2 },
  paymentLogAmount:   { fontSize: 16, fontWeight: '800', color: '#059669' },
});