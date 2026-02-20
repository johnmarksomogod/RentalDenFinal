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

// ─── Status colours — matching BookingScreen exactly ─────────────────────────
const STATUS_COLOR = {
  pending:   '#f59e0b',
  confirmed: '#10b981',
  ongoing:   '#3b82f6',
  delivered: '#8b5cf6',
  retrieved: '#06b6d4',
  completed: '#6366f1',
  cancelled: '#ef4444',
  declined:  '#f97316',
};
const getStatusColor = (s) => STATUS_COLOR[s] || '#6b7280';

// ─── Notification filter tabs ─────────────────────────────────────────────────
const NOTIF_FILTERS = [
  { key: 'all',      label: 'All',      icon: 'apps-outline' },
  { key: 'booking',  label: 'Bookings', icon: 'document-text-outline' },
  { key: 'delivery', label: 'Driver',   icon: 'car-outline' },
  { key: 'charges',  label: 'Charges',  icon: 'cash-outline' },
  { key: 'alert',    label: 'Alerts',   icon: 'alert-circle-outline' },
  { key: 'unread',   label: 'Unread',   icon: 'ellipse-outline' },
];

// charge-type notification keys
const CHARGE_TYPES = [
  'driver_payment', 'driver_damage', 'driver_fuel',
  'driver_delay', 'driver_extra_km', 'driver_extra_hours',
];

const isChargeType = (type) => CHARGE_TYPES.includes(type);

const getNotifFilter = (type) => {
  // Charge types get their own category
  if (CHARGE_TYPES.includes(type)) return 'charges';
  // Driver status updates (not charges)
  if (['driver_ongoing', 'driver_delivered', 'driver_retrieved', 'status_change'].includes(type))
    return 'delivery';
  // Booking lifecycle
  if (['new_booking', 'booking_confirmed', 'booking_completed',
       'booking_cancelled', 'booking_declined',
       'pickup_today', 'return_today', 'upcoming_pickup', 'due_return'].includes(type))
    return 'booking';
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
        <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={24} color={unread > 0 ? '#f59e0b' : '#222'} />
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
      // Booking lifecycle
      upcoming_pickup:    { name: 'car-sport',          color: '#10b981' },
      due_return:         { name: 'return-up-back',     color: '#f59e0b' },
      overdue:            { name: 'alert-circle',       color: '#ef4444' },
      pickup_today:       { name: 'today',              color: '#3b82f6' },
      return_today:       { name: 'calendar',           color: '#8b5cf6' },
      new_booking:        { name: 'add-circle',         color: '#f59e0b' },
      booking_confirmed:  { name: 'checkmark-circle',   color: '#10b981' },
      booking_completed:  { name: 'flag-outline',       color: '#6366f1' },
      booking_cancelled:  { name: 'close-circle',       color: '#ef4444' },
      booking_declined:   { name: 'ban',                color: '#f97316' },
      status_change:      { name: 'swap-horizontal',    color: '#8b5cf6' },
      // Driver delivery updates
      driver_ongoing:     { name: 'navigate',           color: '#3b82f6' },
      driver_delivered:   { name: 'car',                color: '#8b5cf6' },
      driver_retrieved:   { name: 'return-down-back',   color: '#06b6d4' },
      // Driver charges
      driver_payment:     { name: 'cash',               color: '#10b981' },
      driver_damage:      { name: 'warning',            color: '#ef4444' },
      driver_fuel:        { name: 'water',              color: '#f59e0b' },
      driver_delay:       { name: 'time',               color: '#f97316' },
      driver_extra_km:    { name: 'speedometer',        color: '#8b5cf6' },
      driver_extra_hours: { name: 'hourglass',          color: '#06b6d4' },
    };
    return map[type] || { name: 'information-circle', color: '#6b7280' };
  };

  const icon = getNotificationIcon(notification.type);
  const isDelivery = getNotifFilter(notification.type) === 'delivery';

  return (
    <View style={styles.notificationWrapper}>
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !notification.read && styles.unreadNotification,
          showActions && styles.notificationItemActive,
          isDelivery && styles.deliveryNotification,
        ]}
        onPress={() => { onMarkRead(notification.id); if (notification.bookingId && onNavigateToBooking) onNavigateToBooking(notification.bookingId); }}
        onLongPress={() => setShowActions(true)}
        delayLongPress={500}
      >
        <View style={[styles.notificationIconContainer, { backgroundColor: icon.color + '20' }]}>
          <Ionicons name={icon.name} size={20} color={icon.color} />
        </View>
        <View style={styles.notificationContent}>
          {isDelivery && (
            <View style={styles.deliveryBadgeRow}>
              <View style={styles.deliveryBadge}>
                <Ionicons name="car-outline" size={10} color="#8b5cf6" />
                <Text style={styles.deliveryBadgeTxt}>Driver Update</Text>
              </View>
              {notification.driver_name ? (
                <View style={styles.driverNameBadge}>
                  <Ionicons name="person" size={10} color="#065f46" />
                  <Text style={styles.driverNameBadgeTxt}>{notification.driver_name}</Text>
                </View>
              ) : null}
            </View>
          )}
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          <Text style={styles.notificationMessage}>{notification.message}</Text>
          <Text style={styles.notificationTime}>{notification.timeAgo}</Text>
        </View>
        {!notification.read && <View style={styles.unreadDot} />}
        <TouchableOpacity style={styles.notificationMenuButton} onPress={() => setShowActions(!showActions)}>
          <Ionicons name="ellipsis-vertical" size={16} color="#9ca3af" />
        </TouchableOpacity>
      </TouchableOpacity>

      {showActions && (
        <View style={styles.notificationActions}>
          {!notification.read && (
            <TouchableOpacity style={[styles.notificationActionButton, styles.markReadButton]} onPress={() => { onMarkRead(notification.id); setShowActions(false); }}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />
              <Text style={[styles.notificationActionText, { color: '#10b981' }]}>Mark read</Text>
            </TouchableOpacity>
          )}
          {notification.bookingId && (
            <TouchableOpacity style={[styles.notificationActionButton, styles.viewBookingButton]} onPress={() => { if (onNavigateToBooking) onNavigateToBooking(notification.bookingId); setShowActions(false); }}>
              <Ionicons name="eye-outline" size={16} color="#3b82f6" />
              <Text style={[styles.notificationActionText, { color: '#3b82f6' }]}>View Booking</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.notificationActionButton, styles.removeButton]} onPress={() => { setActionModalConfig({ title: 'Remove Notification', message: 'Remove this notification?', onConfirm: () => { onRemove(notification.id); setShowActions(false); } }); }}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
            <Text style={[styles.notificationActionText, { color: '#ef4444' }]}>Remove</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.notificationActionButton, styles.cancelButton]} onPress={() => setShowActions(false)}>
            <Ionicons name="close-outline" size={16} color="#6b7280" />
            <Text style={[styles.notificationActionText, { color: '#6b7280' }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NotificationsModal — category tabs + tappable driver name pills
// ─────────────────────────────────────────────────────────────────────────────
const NotificationsModal = ({ visible, notifications, onClose, onMarkRead, onMarkAllRead, onRemove, setActionModalConfig, onClearAll, onNavigateToBooking }) => {
  // activeFilter: 'all' | 'booking' | 'delivery' | 'charges' | 'alert' | 'unread'
  //              | 'driver:<name>'  ← tapping a driver pill sets this
  const [activeFilter, setActiveFilter] = useState('all');

  // ── Collect all unique driver names that appear in notifications ────────────
  const driverNames = [...new Set(
    notifications
      .filter(n => n.driver_name)
      .map(n => n.driver_name)
  )].sort();

  // ── Resolve which notifications to show for the active filter ──────────────
  const filtered = notifications.filter(n => {
    if (activeFilter === 'all')                        return true;
    if (activeFilter === 'unread')                     return !n.read;
    if (activeFilter.startsWith('driver:')) {
      // Show ALL notifications (any type) that belong to this driver
      const dName = activeFilter.slice(7);
      return n.driver_name === dName;
    }
    return getNotifFilter(n.type) === activeFilter;
  });

  // ── For Delivery category — group the list by driver name ──────────────────
  const isDriverCategory = activeFilter === 'delivery';
  const deliveryGrouped  = isDriverCategory
    ? filtered.reduce((acc, n) => {
        const key = n.driver_name || 'Unassigned';
        if (!acc[key]) acc[key] = [];
        acc[key].push(n);
        return acc;
      }, {})
    : null;

  // ── Banner counts ──────────────────────────────────────────────────────────
  const unreadDelivery = notifications.filter(n => !n.read && getNotifFilter(n.type) === 'delivery').length;
  const unreadCharges  = notifications.filter(n => !n.read && getNotifFilter(n.type) === 'charges').length;
  const newDriverAlert = unreadDelivery + unreadCharges;

  // ── Active driver name (when a pill is selected) ───────────────────────────
  const activeDriverName = activeFilter.startsWith('driver:') ? activeFilter.slice(7) : null;

  const renderList = (data) => (
    <FlatList
      data={data}
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
      ListEmptyComponent={
        <View style={styles.emptyNotifications}>
          <Ionicons name="notifications-off-outline" size={48} color="#d1d5db" />
          <Text style={styles.emptyNotificationsText}>No notifications</Text>
          <Text style={styles.emptyNotificationsSubtext}>
            {activeDriverName
              ? `No notifications for ${activeDriverName}`
              : activeFilter === 'all'
              ? "You're all caught up!"
              : `No ${activeFilter} notifications`}
          </Text>
        </View>
      }
    />
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>

        {/* ── Header ── */}
        <View style={styles.modalHeader}>
          <View>
            <Text style={styles.modalTitle}>Notifications</Text>
            <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {notifications.filter(n => !n.read).length} unread · {notifications.length} total
            </Text>
          </View>
          <View style={styles.modalHeaderActions}>
            <TouchableOpacity style={styles.markAllReadButton} onPress={onMarkAllRead}>
              <Text style={styles.markAllReadText}>Mark all read</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearAllButton} onPress={onClearAll}>
              <Text style={styles.clearAllText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#222" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Driver / charges alert banner ── */}
        {newDriverAlert > 0 && (
          <View style={styles.driverAlertBanner}>
            <Ionicons name="car" size={15} color="#8b5cf6" />
            <Text style={styles.driverAlertText}>
              {newDriverAlert} new driver notification{newDriverAlert > 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={() => setActiveFilter('delivery')}>
              <Text style={styles.driverAlertLink}>Driver</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setActiveFilter('charges')} style={{ marginLeft: 8 }}>
              <Text style={[styles.driverAlertLink, { color: '#10b981' }]}>Charges</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Category filter tabs (row 1) ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {NOTIF_FILTERS.map(f => {
            const count = f.key === 'all'
              ? notifications.length
              : f.key === 'unread'
              ? notifications.filter(n => !n.read).length
              : notifications.filter(n => getNotifFilter(n.type) === f.key).length;
            const active = activeFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterTab, active && styles.filterTabActive]}
                onPress={() => setActiveFilter(f.key)}
              >
                <Ionicons name={f.icon} size={13} color={active ? '#fff' : '#6b7280'} />
                <Text style={[styles.filterTabTxt, active && styles.filterTabTxtActive]}>{f.label}</Text>
                {count > 0 && (
                  <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                    <Text style={[styles.filterBadgeTxt, active && styles.filterBadgeTxtActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Driver name pills (row 2) — only when there are drivers ── */}
        {driverNames.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.driverPillScroll}
            contentContainerStyle={styles.driverPillRow}
          >
            {driverNames.map(name => {
              const key       = `driver:${name}`;
              const active    = activeFilter === key;
              const total     = notifications.filter(n => n.driver_name === name).length;
              const unread    = notifications.filter(n => n.driver_name === name && !n.read).length;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.driverPill, active && styles.driverPillActive]}
                  onPress={() => setActiveFilter(active ? 'all' : key)}
                >
                  <View style={[styles.driverPillAvatar, active && styles.driverPillAvatarActive]}>
                    <Text style={[styles.driverPillInitial, active && { color: '#fff' }]}>
                      {name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.driverPillName, active && styles.driverPillNameActive]} numberOfLines={1}>
                    {name}
                  </Text>
                  <View style={[styles.driverPillCount, active && styles.driverPillCountActive]}>
                    <Text style={[styles.driverPillCountTxt, active && { color: '#fff' }]}>{total}</Text>
                  </View>
                  {unread > 0 && (
                    <View style={styles.driverPillUnread}>
                      <Text style={styles.driverPillUnreadTxt}>{unread}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* ── Active driver name header (when a driver pill is selected) ── */}
        {activeDriverName && (
          <View style={styles.driverActiveHeader}>
            <View style={styles.driverActiveAvatar}>
              <Ionicons name="person" size={16} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.driverActiveName}>{activeDriverName}</Text>
              <Text style={styles.driverActiveCount}>
                {filtered.length} notification{filtered.length !== 1 ? 's' : ''}
                {filtered.filter(n => !n.read).length > 0
                  ? ` · ${filtered.filter(n => !n.read).length} unread`
                  : ' · all read'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.driverActiveClear}
              onPress={() => setActiveFilter('all')}
            >
              <Ionicons name="close" size={16} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Notification list ── */}
        {deliveryGrouped ? (
          /* Delivery category → group by driver name */
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationsList}>
            {Object.keys(deliveryGrouped).length === 0 ? (
              <View style={styles.emptyNotifications}>
                <Ionicons name="car-outline" size={48} color="#d1d5db" />
                <Text style={styles.emptyNotificationsText}>No driver updates</Text>
              </View>
            ) : Object.entries(deliveryGrouped).map(([dName, items]) => (
              <View key={dName} style={{ marginBottom: 16 }}>
                <TouchableOpacity
                  style={styles.driverGroupHeader}
                  onPress={() => setActiveFilter(`driver:${dName}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.driverGroupIcon}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>
                      {dName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.driverGroupName}>{dName}</Text>
                  <View style={styles.driverGroupBadge}>
                    <Text style={styles.driverGroupBadgeTxt}>{items.length} notification{items.length > 1 ? 's' : ''}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#9ca3af" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
                {items.map(item => (
                  <NotificationItem
                    key={item.id}
                    notification={item}
                    onMarkRead={onMarkRead}
                    onRemove={onRemove}
                    setActionModalConfig={setActionModalConfig}
                    onNavigateToBooking={onNavigateToBooking}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        ) : (
          /* All other filters → flat list */
          renderList(filtered)
        )}

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
  const [saving, setSaving] = useState(false);

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

  const updateField = (field, value) => setContent(prev => ({ ...prev, content: { ...prev.content, [field]: value } }));
  const updateArrayItem = (arr, i, field, value) => setContent(prev => { const a = [...(prev.content[arr] || [])]; if (a[i]) a[i] = { ...a[i], [field]: value }; return { ...prev, content: { ...prev.content, [arr]: a } }; });
  const addArrayItem = (arr, tmpl) => setContent(prev => ({ ...prev, content: { ...prev.content, [arr]: [...(prev.content[arr] || []), tmpl] } }));
  const removeArrayItem = (arr, i) => setContent(prev => ({ ...prev, content: { ...prev.content, [arr]: (prev.content[arr] || []).filter((_, idx) => idx !== i) } }));

  if (!visible) return null;
  const sectionLabel = section === 'about_us' ? 'About Us' : section === 'how_it_works' ? 'How It Works' : 'FAQs';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Edit {sectionLabel}</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#222" /></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {loading ? <View style={styles.loadingContainer}><Text>Loading...</Text></View> : content?.content ? (
            <>
              <Text style={styles.label}>Title</Text>
              <TextInput style={styles.input} value={content.content.title || ''} onChangeText={t => updateField('title', t)} placeholder="Title" placeholderTextColor="#9ca3af" />
              {section === 'about_us' && (
                <><Text style={styles.label}>Description</Text>
                <TextInput style={[styles.input, styles.textArea]} value={content.content.description || ''} onChangeText={t => updateField('description', t)} multiline numberOfLines={6} placeholderTextColor="#9ca3af" /></>
              )}
              {section === 'faqs' && (Array.isArray(content.content.questions) ? content.content.questions : []).map((item, i) => (
                <View key={i} style={styles.arrayItemContainer}>
                  <View style={styles.arrayItemHeader}>
                    <Text style={styles.arrayItemTitle}>FAQ {i + 1}</Text>
                    <TouchableOpacity onPress={() => removeArrayItem('questions', i)}><Ionicons name="trash" size={22} color="#ef4444" /></TouchableOpacity>
                  </View>
                  <Text style={styles.label}>Question</Text>
                  <TextInput style={styles.input} value={item.question || ''} onChangeText={t => updateArrayItem('questions', i, 'question', t)} placeholderTextColor="#9ca3af" />
                  <Text style={styles.label}>Answer</Text>
                  <TextInput style={[styles.input, styles.textArea]} value={item.answer || ''} onChangeText={t => updateArrayItem('questions', i, 'answer', t)} multiline numberOfLines={4} placeholderTextColor="#9ca3af" />
                </View>
              ))}
              {section === 'faqs' && (
                <TouchableOpacity style={styles.addButton} onPress={() => addArrayItem('questions', { question: '', answer: '' })}>
                  <Ionicons name="add-circle" size={28} color="#222" />
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
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#222" /></TouchableOpacity>
          </View>
        </View>
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {showUploadForm && uploadData.preview ? (
            <View style={styles.uploadFormContainer}>
              <Text style={styles.uploadFormTitle}>Upload Image Details</Text>
              <View style={styles.imagePreviewContainer}><Image source={{ uri: uploadData.preview }} style={styles.imagePreview} /></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Title (Optional)</Text><TextInput style={styles.formInput} value={uploadData.title} onChangeText={t => setUploadData({ ...uploadData, title: t })} placeholderTextColor="#9ca3af" /></View>
              <View style={styles.formGroup}><Text style={styles.formLabel}>Description (Optional)</Text><TextInput style={[styles.formInput, styles.formTextArea]} value={uploadData.description} onChangeText={t => setUploadData({ ...uploadData, description: t })} multiline numberOfLines={3} placeholderTextColor="#9ca3af" /></View>
              <View style={styles.uploadFormActions}>
                <TouchableOpacity style={[styles.uploadFormButton, styles.confirmButton]} onPress={handleUpload} disabled={uploading}><Ionicons name="checkmark-circle" size={20} color="#fff" /><Text style={styles.uploadFormButtonText}>{uploading ? 'Uploading...' : 'Confirm Upload'}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.uploadFormButton, styles.cancelUploadButton]} onPress={() => { setShowUploadForm(false); setUploadData({ image: null, preview: null, title: '', description: '', uploadedDate: new Date().toISOString().split('T')[0] }); }} disabled={uploading}><Ionicons name="close-circle" size={20} color="#ef4444" /><Text style={[styles.uploadFormButtonText, { color: '#ef4444' }]}>Cancel</Text></TouchableOpacity>
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
                    <View style={styles.galleryItemMeta}><Ionicons name="calendar-outline" size={12} color="#6b7280" /><Text style={styles.galleryItemDate}>{new Date(img.uploaded_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</Text></View>
                    <View style={styles.galleryItemStatus}><View style={[styles.statusBadge, { backgroundColor: img.is_active ? '#222' : '#f3f4f6' }]}><Text style={[styles.statusBadgeText, { color: img.is_active ? '#fff' : '#6b7280' }]}>{img.is_active ? 'Visible' : 'Hidden'}</Text></View></View>
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
  const [saving, setSaving] = useState(false);

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
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#222" /></TouchableOpacity>
        </View>
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {loading ? <View style={styles.loadingContainer}><Text>Loading...</Text></View> : content?.content ? (
            <>
              {[['title', 'Main Title'], ['subtitle', 'Subtitle'], ['address', 'Address'], ['mobile', 'Mobile Number'], ['availability', 'Availability'], ['email', 'Email']].map(([field, label]) => (
                <View key={field}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={content.content[field] || ''} onChangeText={t => updateField(field, t)} placeholderTextColor="#9ca3af" /></View>
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
      ...e, booking_id: b.id,
      customer_name: b.customer_name,
      vehicle: `${b.vehicles?.make || ''} ${b.vehicles?.model || ''}`.trim(),
    })))
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));

  const totalCollected = allPayments.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Payment Tracker</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#222" /></TouchableOpacity>
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
        driver_name: data.driverName || null,   // store driver name so filter shows who's in charge
        read:        false,
        dismissed:   false,
      });
    } catch {}
  };

  // ── Generate notifications — booking lifecycle + all driver charges ─────────
  const generateNotifications = async (bookings) => {
    if (!currentUserId) return;
    const today = new Date();
    for (const booking of bookings) {
      const startDate  = new Date(booking.rental_start_date);
      const daysDiff   = Math.ceil((startDate - today) / (1000 * 3600 * 24));
      const existing   = await notificationsService.listByBookingId(booking.id);
      const types      = new Set(existing?.map(n => n.type) || []);
      const driver     = booking.assigned_driver || 'Driver';
      const vehicle    = `${booking.vehicles?.year || ''} ${booking.vehicles?.make || ''} ${booking.vehicles?.model || ''}`.trim();
      const customer   = booking.customer_name;

      // ── Booking lifecycle ─────────────────────────────────────────────────
      if (booking.status === 'pending' && !types.has('new_booking'))
        await createNotification({ bookingId: booking.id, type: 'new_booking',
          title: '📋 New Booking Request',
          message: `${customer} requested ${vehicle}` });

      if (booking.status === 'confirmed' && daysDiff === 0 && !types.has('pickup_today'))
        await createNotification({ bookingId: booking.id, type: 'pickup_today',
          title: '📅 Pickup Today',
          message: `${customer} is picking up ${vehicle} today` });

      // ✅ Booking completed — was missing, now fires correctly
      if (booking.status === 'completed' && !types.has('booking_completed'))
        await createNotification({ bookingId: booking.id, type: 'booking_completed',
          title: '✅ Booking Completed',
          message: `${customer}'s booking for ${vehicle} is now complete. Total: ${formatCurrency(booking.total_price)}` });

      if (booking.status === 'cancelled' && !types.has('booking_cancelled'))
        await createNotification({ bookingId: booking.id, type: 'booking_cancelled',
          title: '❌ Booking Cancelled',
          message: `${customer}'s booking for ${vehicle} was cancelled` });

      if (booking.status === 'declined' && !types.has('booking_declined'))
        await createNotification({ bookingId: booking.id, type: 'booking_declined',
          title: '🚫 Booking Declined',
          message: `${customer}'s booking for ${vehicle} was declined` });

      // ── Driver delivery updates (delivery bookings only) ──────────────────
      if (booking.delivery_option === 'deliver') {
        if (booking.status === 'ongoing' && !types.has('driver_ongoing'))
          await createNotification({ bookingId: booking.id, type: 'driver_ongoing',
            driverName: driver,
            title: '🚗 Driver En Route',
            message: `[${driver}] is driving ${vehicle} to ${customer}` });

        if (booking.status === 'delivered' && !types.has('driver_delivered'))
          await createNotification({ bookingId: booking.id, type: 'driver_delivered',
            driverName: driver,
            title: '📦 Vehicle Delivered',
            message: `[${driver}] delivered ${vehicle} to ${customer}` });

        if (booking.status === 'retrieved' && !types.has('driver_retrieved'))
          await createNotification({ bookingId: booking.id, type: 'driver_retrieved',
            driverName: driver,
            title: '🔁 Vehicle Retrieved',
            message: `[${driver}] retrieved ${vehicle} from ${customer}` });

        // ── All driver charges ────────────────────────────────────────────
        // Payment collected
        const payments = booking.payment_log || [];
        for (let i = 0; i < payments.length; i++) {
          const payType = `driver_payment_${i}`;
          if (!types.has(payType))
            await createNotification({ bookingId: booking.id, type: 'driver_payment',
              driverName: driver,
              title: '💰 Payment Collected',
              message: `[${driver}] collected ${formatCurrency(payments[i].amount)} from ${customer}${payments[i].event ? ` — ${payments[i].event}` : ''}` });
        }

        // Damage fee
        if (booking.damage_fee > 0 && !types.has('driver_damage'))
          await createNotification({ bookingId: booking.id, type: 'driver_damage',
            driverName: driver,
            title: '⚠️ Damage Fee',
            message: `[${driver}] reported damage charge of ${formatCurrency(booking.damage_fee)} — ${customer}'s ${vehicle}` });

        // Fuel charge
        if (booking.fuel_charge > 0 && !types.has('driver_fuel'))
          await createNotification({ bookingId: booking.id, type: 'driver_fuel',
            driverName: driver,
            title: '⛽ Fuel Charge',
            message: `[${driver}] reported fuel charge of ${formatCurrency(booking.fuel_charge)} for ${customer}` });

        // Delay charge
        if (booking.delay_charge > 0 && !types.has('driver_delay'))
          await createNotification({ bookingId: booking.id, type: 'driver_delay',
            driverName: driver,
            title: '⏱ Delay Charge',
            message: `[${driver}] recorded delay charge of ${formatCurrency(booking.delay_charge)} for ${customer}` });

        // Extra km charge
        if (booking.extra_km_charge > 0 && !types.has('driver_extra_km'))
          await createNotification({ bookingId: booking.id, type: 'driver_extra_km',
            driverName: driver,
            title: '📍 Extra KM Charge',
            message: `[${driver}] recorded extra km charge of ${formatCurrency(booking.extra_km_charge)} for ${customer}` });

        // Extra hours charge
        if (booking.extra_hours_charge > 0 && !types.has('driver_extra_hours'))
          await createNotification({ bookingId: booking.id, type: 'driver_extra_hours',
            driverName: driver,
            title: '⏰ Extra Hours Charge',
            message: `[${driver}] recorded extra hours charge of ${formatCurrency(booking.extra_hours_charge)} for ${customer}` });
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
  const handleNavigateToBooking    = (id) => { setShowNotifications(false); navigation?.navigate?.('Bookings', { screen: 'BookingsList', params: { openBookingId: id, openInEditMode: true } }); };

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

  // Status grid row — two chips side by side
  const StatusRow = ({ items }) => (
    <View style={styles.statusGrid}>
      {items.map(({ label, color, count }) => (
        <View key={label} style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <View>
            <Text style={styles.statusValue}>{count}</Text>
            <Text style={styles.statusLabel}>{label}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  const deliveryBookings = allBookings.filter(b =>
    b.delivery_option === 'deliver' &&
    ['confirmed', 'ongoing', 'delivered', 'retrieved'].includes(b.status)
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSubtitle}>Welcome back!</Text>
        </View>
        <View style={styles.headerActions}>
          <NotificationBell notifications={notifications} onPress={() => setShowNotifications(true)} />
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color="#222" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDashboardData} />}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* Stat Cards — keep black icons as requested */}
        <View style={styles.statsContainer}>
          <StatCard title="Total Vehicles"   value={dashboardData.totalVehicles}     icon="car"              color="#222" onPress={() => navigation?.navigate?.('Vehicles')} />
          <StatCard title="Available"         value={dashboardData.availableVehicles} icon="checkmark-circle" color="#222" onPress={() => navigation?.navigate?.('Vehicles')} />
          <StatCard title="Active Rentals"    value={dashboardData.activeBookings}    icon="time"             color="#222" onPress={() => navigation?.navigate?.('Bookings')} />
          <StatCard title="Today's Bookings"  value={dashboardData.todayBookings}     icon="calendar"         color="#222" onPress={() => navigation?.navigate?.('Bookings')} />
        </View>

        {/* Revenue */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueHeader}><Text style={styles.sectionTitle}>Monthly Revenue</Text></View>
          <View style={styles.revenueContent}>
            <View>
              <Text style={styles.revenueValue}>{formatCurrency(dashboardData.monthlyRevenue)}</Text>
              <Text style={styles.revenueSubtext}>{new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</Text>
            </View>
            <View style={styles.revenueIconContainer}>
              <Ionicons name="trending-up" size={32} color="#4CAF50" />
            </View>
          </View>
        </View>

        {/* ── Booking Status Overview — colours matching BookingScreen ── */}
        <View style={styles.statusOverviewCard}>
          <Text style={styles.sectionTitle}>Booking Status Overview</Text>
          <StatusRow items={[
            { label: 'Pending',   color: STATUS_COLOR.pending,   count: dashboardData.pendingBookings },
            { label: 'Confirmed', color: STATUS_COLOR.confirmed, count: dashboardData.confirmedBookings },
          ]} />
          <StatusRow items={[
            { label: 'Ongoing',   color: STATUS_COLOR.ongoing,   count: countByStatus('ongoing') },
            { label: 'Delivered', color: STATUS_COLOR.delivered, count: countByStatus('delivered') },
          ]} />
          <StatusRow items={[
            { label: 'Retrieved', color: STATUS_COLOR.retrieved, count: countByStatus('retrieved') },
            { label: 'Completed', color: STATUS_COLOR.completed, count: dashboardData.completedBookings },
          ]} />
          <StatusRow items={[
            { label: 'Cancelled', color: STATUS_COLOR.cancelled, count: dashboardData.cancelledBookings },
            { label: 'Declined',  color: STATUS_COLOR.declined,  count: dashboardData.declinedBookings },
          ]} />
        </View>

        {/* ── Driver Assignments — no assign button, just view all ── */}
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
                <Ionicons name="chevron-forward" size={14} color="#374151" />
              </TouchableOpacity>
            </View>
          </View>

          {deliveryBookings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={40} color="#d1d5db" />
              <Text style={styles.emptyStateText}>No active delivery bookings</Text>
            </View>
          ) : (
            deliveryBookings.slice(0, 4).map(booking => (
              <TouchableOpacity
                key={booking.id}
                style={styles.driverBookingItem}
                onPress={() => navigation?.navigate?.('Bookings', { screen: 'BookingsList', params: { openBookingId: booking.id } })}
                activeOpacity={0.75}
              >
                <View style={[styles.bookingStatusBar, { backgroundColor: getStatusColor(booking.status) }]} />
                <View style={styles.driverBookingInfo}>
                  <Text style={styles.driverBookingCustomer}>{booking.customer_name}</Text>
                  <Text style={styles.driverBookingVehicle}>{booking.vehicles?.year} {booking.vehicles?.make} {booking.vehicles?.model}</Text>
                  <Text style={styles.driverBookingAddress} numberOfLines={1}>📍 {booking.delivery_address || booking.pickup_location || '—'}</Text>
                  {booking.assigned_driver ? (
                    <View style={styles.driverChip}>
                      <Ionicons name="person" size={11} color="#065f46" />
                      <Text style={styles.driverChipText}>{booking.assigned_driver}</Text>
                    </View>
                  ) : (
                    <View style={styles.noDriverChip}>
                      <Ionicons name="person-outline" size={11} color="#92400e" />
                      <Text style={styles.noDriverChipText}>No driver assigned</Text>
                    </View>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6, justifyContent: 'center' }}>
                  <View style={[styles.statusMiniPill, { backgroundColor: getStatusColor(booking.status) + '20' }]}>
                    <Text style={[styles.statusMiniText, { color: getStatusColor(booking.status) }]}>{booking.status}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
                </View>
              </TouchableOpacity>
            ))
          )}

          {deliveryBookings.length > 4 && (
            <TouchableOpacity style={styles.showMoreBtn} onPress={() => navigation?.navigate?.('Bookings')}>
              <Text style={styles.showMoreTxt}>+{deliveryBookings.length - 4} more bookings — View all</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recent Bookings */}
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
                  <View style={styles.bookingNameRow}><Ionicons name="person" size={14} color="#6b7280" /><Text style={styles.bookingCustomer}>{booking.customer_name}</Text></View>
                  {booking.vehicles && <View style={styles.bookingVehicleRow}><Ionicons name="car" size={12} color="#6b7280" /><Text style={styles.bookingVehicle}>{booking.vehicles.year} {booking.vehicles.make} {booking.vehicles.model}</Text></View>}
                  {booking.vehicle_variants?.plate_number && <View style={styles.bookingPlateRow}><Ionicons name="card" size={12} color="#6b7280" /><Text style={styles.bookingVehicle}>{booking.vehicle_variants.plate_number}</Text></View>}
                  <View style={styles.bookingDateRow}><Ionicons name="calendar-outline" size={12} color="#6b7280" /><Text style={styles.bookingDate}>{formatDate(booking.rental_start_date)} - {formatDate(booking.rental_end_date)}</Text></View>
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

        {/* ── Website Management — improved grid layout ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Website Management</Text>
          </View>

          {/* Top 2 — full-width cards with description */}
          {[
            { icon: 'information-circle-outline', title: 'About Us', desc: 'Edit title, description & statistics', onPress: () => { setContentSection('about_us'); setShowContentModal(true); } },
            { icon: 'list-outline', title: 'How It Works', desc: 'Manage rental process steps', onPress: () => { setContentSection('how_it_works'); setShowContentModal(true); } },
            { icon: 'help-circle-outline', title: 'FAQs', desc: 'Update frequently asked questions', onPress: () => { setContentSection('faqs'); setShowContentModal(true); } },
          ].map(item => (
            <TouchableOpacity key={item.title} style={styles.websiteCardFull} onPress={item.onPress} activeOpacity={0.75}>
              <View style={styles.websiteCardIconBox}>
                <Ionicons name={item.icon} size={22} color="#222" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.websiteCardTitle}>{item.title}</Text>
                <Text style={styles.websiteCardDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
            </TouchableOpacity>
          ))}

          {/* Bottom 2 — side-by-side tiles */}
          <View style={styles.websiteTileRow}>
            <TouchableOpacity style={styles.websiteTile} onPress={() => setShowGalleryModal(true)} activeOpacity={0.75}>
              <View style={[styles.websiteTileIcon, { backgroundColor: '#f0f9ff' }]}>
                <Ionicons name="images-outline" size={26} color="#0ea5e9" />
              </View>
              <Text style={styles.websiteTileTitle}>Gallery</Text>
              <Text style={styles.websiteTileDesc}>Upload & manage images</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.websiteTile} onPress={() => setContactModalVisible(true)} activeOpacity={0.75}>
              <View style={[styles.websiteTileIcon, { backgroundColor: '#fdf4ff' }]}>
                <Ionicons name="call-outline" size={26} color="#a855f7" />
              </View>
              <Text style={styles.websiteTileTitle}>Contact Info</Text>
              <Text style={styles.websiteTileDesc}>Edit contact & social</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
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
  headerSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  headerActions:  { flexDirection: 'row', alignItems: 'center', gap: 12 },

  // Bell
  notificationBell:      { position: 'relative', padding: 10, borderRadius: 8 },
  notificationBadge:     { position: 'absolute', top: 4, right: 4, backgroundColor: '#f59e0b', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  notificationBadgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
  logoutButton:          { padding: 8, borderRadius: 8, backgroundColor: '#f3f4f6' },

  // Modal shared
  modalContainer:    { flex: 1, backgroundColor: 'white' },
  modalHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  modalTitle:        { fontSize: 20, fontWeight: '700', color: '#111827' },
  modalHeaderActions:{ flexDirection: 'row', alignItems: 'center', gap: 12 },
  markAllReadButton: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#f3f4f6', borderRadius: 6 },
  markAllReadText:   { fontSize: 13, color: '#4b5563', fontWeight: '500' },
  clearAllButton:    { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fee2e2', borderRadius: 6 },
  clearAllText:      { fontSize: 13, color: '#ef4444', fontWeight: '500' },
  closeButton:       { padding: 4 },
  modalContent:      { flex: 1, padding: 20 },

  // Driver alert banner
  driverAlertBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#faf5ff', borderRadius: 10, borderWidth: 1, borderColor: '#e9d5ff' },
  driverAlertText:   { flex: 1, fontSize: 13, color: '#6b21a8', fontWeight: '500' },
  driverAlertLink:   { fontSize: 13, fontWeight: '700', color: '#8b5cf6' },

  // Driver name pill row (row 2 under category tabs)
  driverPillScroll:       { maxHeight: 48, marginTop: 6 },
  driverPillRow:          { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  driverPill:             { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', maxWidth: 160 },
  driverPillActive:       { backgroundColor: '#374151', borderColor: '#374151' },
  driverPillAvatar:       { width: 22, height: 22, borderRadius: 11, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' },
  driverPillAvatarActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  driverPillInitial:      { fontSize: 11, fontWeight: '800', color: '#374151' },
  driverPillName:         { fontSize: 12, fontWeight: '600', color: '#374151', flex: 1 },
  driverPillNameActive:   { color: '#fff' },
  driverPillCount:        { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5 },
  driverPillCountActive:  { backgroundColor: 'rgba(255,255,255,0.2)' },
  driverPillCountTxt:     { fontSize: 10, fontWeight: '700', color: '#374151' },
  driverPillUnread:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', position: 'absolute', top: -2, right: -2 },
  driverPillUnreadTxt:    { display: 'none' },

  // Active driver header bar (shown when a driver pill is selected)
  driverActiveHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 8, marginBottom: 4, padding: 12, backgroundColor: '#374151', borderRadius: 12 },
  driverActiveAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  driverActiveName:   { fontSize: 14, fontWeight: '800', color: '#fff' },
  driverActiveCount:  { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  driverActiveClear:  { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },

  // Filter tabs
  filterScroll:      { maxHeight: 46, marginTop: 10 },
  filterRow:         { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  filterTab:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  filterTabActive:   { backgroundColor: '#222', borderColor: '#222' },
  filterTabTxt:      { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  filterTabTxtActive:{ color: '#fff' },
  filterBadge:       { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeTxt:    { fontSize: 10, fontWeight: '700', color: '#374151' },
  filterBadgeTxtActive:{ color: '#fff' },

  // Notifications list
  notificationsList:         { paddingHorizontal: 16, paddingVertical: 12 },
  notificationWrapper:       { marginBottom: 10 },
  notificationItem:          { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 14, paddingHorizontal: 14, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', position: 'relative' },
  unreadNotification:        { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  notificationItemActive:    { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
  deliveryNotification:      { borderLeftWidth: 3, borderLeftColor: '#8b5cf6' },
  notificationIconContainer: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  notificationContent:       { flex: 1 },
  deliveryBadgeRow:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  deliveryBadge:             { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#faf5ff', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  deliveryBadgeTxt:          { fontSize: 10, fontWeight: '700', color: '#8b5cf6' },
  driverNameBadge:           { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#d1fae5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  driverNameBadgeTxt:        { fontSize: 10, fontWeight: '700', color: '#065f46' },
  // Driver group header — shown in Delivery filter, groups by who's in charge
  driverGroupHeader:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 4, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  driverGroupIcon:           { width: 26, height: 26, borderRadius: 13, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  driverGroupName:           { fontSize: 14, fontWeight: '800', color: '#111827', flex: 1 },
  driverGroupBadge:          { backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  driverGroupBadgeTxt:       { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  notificationTitle:         { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 3 },
  notificationMessage:       { fontSize: 13, color: '#6b7280', marginBottom: 6, lineHeight: 18 },
  notificationTime:          { fontSize: 11, color: '#9ca3af', fontWeight: '500' },
  unreadDot:                 { width: 8, height: 8, borderRadius: 4, backgroundColor: '#f59e0b', position: 'absolute', top: 14, right: 14 },
  notificationMenuButton:    { padding: 8, borderRadius: 6 },
  notificationActions:       { flexDirection: 'row', justifyContent: 'flex-end', flexWrap: 'wrap', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f8fafc', borderRadius: 8, marginTop: 4, gap: 8 },
  notificationActionButton:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, gap: 5 },
  markReadButton:            { backgroundColor: '#dcfce7' },
  viewBookingButton:         { backgroundColor: '#eff6ff' },
  removeButton:              { backgroundColor: '#fee2e2' },
  cancelButton:              { backgroundColor: '#f3f4f6' },
  notificationActionText:    { fontSize: 12, fontWeight: '500' },
  emptyNotifications:        { alignItems: 'center', paddingVertical: 60 },
  emptyNotificationsText:    { fontSize: 16, fontWeight: '500', color: '#6b7280', marginTop: 12 },
  emptyNotificationsSubtext: { fontSize: 14, color: '#9ca3af', marginTop: 4 },

  // Form
  label:              { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 12 },
  input:              { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: 'white', color: '#111827' },
  textArea:           { minHeight: 100, textAlignVertical: 'top' },
  addButton:          { padding: 4 },
  arrayItemContainer: { backgroundColor: '#f9fafb', borderRadius: 8, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  arrayItemHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  arrayItemTitle:     { fontSize: 14, fontWeight: '600', color: '#374151' },
  saveButton:         { backgroundColor: '#222', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 24, marginBottom: 40 },
  saveButtonDisabled: { backgroundColor: '#9ca3af', opacity: 0.6 },
  saveButtonText:     { color: 'white', fontSize: 16, fontWeight: '600' },
  loadingContainer:   { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  hint:               { fontSize: 13, color: '#6b7280', marginBottom: 24 },

  // Gallery
  uploadButton:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#222', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  uploadButtonText:      { color: 'white', fontSize: 14, fontWeight: '500' },
  emptyGallery:          { alignItems: 'center', paddingVertical: 60 },
  emptyGalleryText:      { fontSize: 16, fontWeight: '500', color: '#6b7280', marginTop: 12 },
  galleryGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 20 },
  galleryItem:           { width: (width - 64) / 2, backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  galleryImage:          { width: '100%', height: 120, resizeMode: 'cover' },
  galleryItemActions:    { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 6 },
  galleryActionBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  activeBtn:             { backgroundColor: '#222' },
  deleteBtn:             { backgroundColor: 'rgba(239,68,68,0.8)' },
  galleryItemInfo:       { padding: 8 },
  galleryItemTitle:      { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 4 },
  galleryItemMeta:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  galleryItemDate:       { fontSize: 11, color: '#6b7280' },
  galleryItemStatus:     { marginTop: 6 },
  statusBadge:           { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  statusBadgeText:       { fontSize: 10, fontWeight: '600' },
  uploadFormContainer:   { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  uploadFormTitle:       { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 16 },
  imagePreviewContainer: { width: '100%', height: 200, borderRadius: 8, overflow: 'hidden', marginBottom: 16 },
  imagePreview:          { width: '100%', height: '100%', resizeMode: 'cover' },
  formGroup:             { marginBottom: 16 },
  formLabel:             { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  formInput:             { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: 'white', color: '#111827' },
  formTextArea:          { minHeight: 80, textAlignVertical: 'top' },
  uploadFormActions:     { flexDirection: 'column', gap: 10, marginTop: 8 },
  uploadFormButton:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, gap: 8 },
  confirmButton:         { backgroundColor: '#222' },
  cancelUploadButton:    { backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb' },
  uploadFormButtonText:  { fontSize: 14, fontWeight: '600', color: 'white' },

  // Dashboard layout
  scrollView:      { flex: 1 },
  scrollContainer: { paddingBottom: Platform.OS === 'ios' ? 100 : 80 },

  // Stat cards — black icons preserved
  statsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  statCard:       { backgroundColor: 'white', borderRadius: 16, padding: 16, width: '49%', marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3.84, elevation: 3, alignItems: 'center' },
  statContent:    { alignItems: 'center' },
  statIcon:       { marginBottom: 8 },
  statValue:      { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  statTitle:      { color: '#374151', fontSize: 12, fontWeight: '500', textAlign: 'center' },

  // Revenue
  revenueCard:        { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3.84, elevation: 3 },
  revenueHeader:      { marginBottom: 12 },
  revenueContent:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  revenueValue:       { fontSize: 28, fontWeight: 'bold', color: '#4CAF50', marginBottom: 4 },
  revenueSubtext:     { fontSize: 14, color: '#9ca3af', fontWeight: '500' },
  revenueIconContainer:{ backgroundColor: '#4CAF5018', padding: 12, borderRadius: 12 },

  // Status overview — all 8 statuses in correct booking-screen colours
  statusOverviewCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3.84, elevation: 3 },
  statusGrid:         { flexDirection: 'row', gap: 12, marginTop: 12 },
  statusItem:         { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f9fafb', borderRadius: 10, gap: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  statusDot:          { width: 12, height: 12, borderRadius: 6 },
  statusValue:        { fontSize: 20, fontWeight: '800', color: '#111827' },
  statusLabel:        { fontSize: 11, color: '#6b7280', fontWeight: '500', marginTop: 1 },

  // Sections
  section:        { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 3.84, elevation: 3 },
  sectionHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  sectionTitle:   { fontWeight: '800', fontSize: 17, letterSpacing: -0.3, color: '#111827' },
  sectionSubtitle:{ fontSize: 12, color: '#9ca3af', marginTop: 2 },
  viewAllText:    { fontSize: 14, color: '#222', fontWeight: '600' },

  // View all / show more buttons
  viewAllBtn:    { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#f3f4f6', borderRadius: 8 },
  viewAllBtnText:{ fontSize: 12, color: '#374151', fontWeight: '600' },
  showMoreBtn:   { marginTop: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  showMoreTxt:   { fontSize: 13, color: '#6b7280', fontWeight: '500' },

  // Driver Assignments — tap-to-navigate, no assign button
  paymentTrackerBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#222', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  paymentTrackerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  driverBookingItem:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10, backgroundColor: '#f9fafb', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', gap: 10 },
  bookingStatusBar:      { width: 4, alignSelf: 'stretch', borderRadius: 4 },
  driverBookingInfo:     { flex: 1 },
  driverBookingCustomer: { fontSize: 14, fontWeight: '700', color: '#111827' },
  driverBookingVehicle:  { fontSize: 12, color: '#374151', marginTop: 2 },
  driverBookingAddress:  { fontSize: 11, color: '#6b7280', marginTop: 2 },
  driverChip:            { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  driverChipText:        { fontSize: 11, fontWeight: '600', color: '#065f46' },
  noDriverChip:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  noDriverChipText:      { fontSize: 11, fontWeight: '600', color: '#92400e' },
  statusMiniPill:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusMiniText:        { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  // Recent bookings
  bookingItem:     { flexDirection: 'row', alignItems: 'stretch', marginBottom: 10, backgroundColor: '#f9fafb', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', minHeight: 80 },
  bookingLeft:     { flexDirection: 'row', alignItems: 'stretch', flex: 1, marginRight: 12, minWidth: 0 },
  bookingInfo:     { flex: 1, justifyContent: 'center', minWidth: 0 },
  bookingNameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  bookingCustomer: { fontWeight: 'bold', fontSize: 15, color: '#111827' },
  bookingVehicleRow:{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  bookingPlateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
  bookingVehicle:  { fontSize: 13, color: '#6b7280' },
  bookingDateRow:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bookingDate:     { fontSize: 11, color: '#9ca3af' },
  bookingRight:    { alignItems: 'flex-end', justifyContent: 'center' },
  bookingAmount:   { fontWeight: 'bold', fontSize: 15, color: '#111827', marginBottom: 4 },
  bookingStatusText:{ fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },

  emptyState:    { alignItems: 'center', paddingVertical: 40 },
  emptyStateText:{ color: '#6b7280', fontWeight: '500', fontSize: 15, marginTop: 12 },

  // Website management — improved layout
  websiteCardFull:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  websiteCardIconBox: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  websiteCardTitle:   { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  websiteCardDesc:    { fontSize: 12, color: '#9ca3af', lineHeight: 16 },
  websiteTileRow:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  websiteTile:        { flex: 1, backgroundColor: '#f9fafb', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' },
  websiteTileIcon:    { width: 52, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  websiteTileTitle:   { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 3, textAlign: 'center' },
  websiteTileDesc:    { fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 15 },

  // Payment tracker
  paymentTotalBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 16, padding: 16, backgroundColor: '#f0fdf4', borderRadius: 12, borderWidth: 1, borderColor: '#d1fae5' },
  paymentTotalLabel:  { fontSize: 14, fontWeight: '600', color: '#166534' },
  paymentTotalValue:  { fontSize: 20, fontWeight: '800', color: '#15803d' },
  paymentLogItem:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  paymentLogEvent:    { fontSize: 14, fontWeight: '600', color: '#111827' },
  paymentLogCustomer: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  paymentLogTime:     { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  paymentLogAmount:   { fontSize: 16, fontWeight: '800', color: '#059669' },
});