"use strict";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  Alert, RefreshControl, Modal, ScrollView, TextInput,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  vehiclesService, variantsService, carOwnersService,
  storageService, notificationsService, firebaseAuth,
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
  confirmed:  '#10b981',
  pending:    '#f59e0b',
  cancelled:  '#ef4444',
};

const APPROVAL_STATUS = {
  pending_approval: { label: 'Pending Approval', color: C.pending,   icon: 'time-outline'            },
  approved:         { label: 'Approved',          color: C.confirmed, icon: 'checkmark-circle-outline' },
  rejected:         { label: 'Rejected',          color: C.cancelled, icon: 'close-circle-outline'     },
};

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Hatchback', 'Convertible', 'Truck', 'Van', 'Luxury', 'Other'];

// ─── Submit Vehicle Modal ──────────────────────────────────────────────────────
const SubmitVehicleModal = ({ visible, onClose, ownerId, ownerName, onSubmitted }) => {
  const [form, setForm]       = useState({ make: '', model: '', year: '', type: '', seats: '', description: '', pricePerDay: '', color: '', plateNumber: '' });
  const [imageUri, setImageUri] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [customType, setCustomType] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const reset = () => {
    setForm({ make: '', model: '', year: '', type: '', seats: '', description: '', pricePerDay: '', color: '', plateNumber: '' });
    setImageUri(null); setSaving(false); setUploading(false);
    setCustomType(''); setShowCustom(false);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera roll permission required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    const finalType = form.type === 'Other' ? customType.trim() : form.type;
    if (!form.make || !form.model || !form.year || !finalType || !form.seats || !form.color || !form.plateNumber || !form.pricePerDay) {
      Alert.alert('Required', 'Please fill all required fields.'); return;
    }

    setSaving(true);
    try {
      let imageUrl = null;
      if (imageUri) {
        setUploading(true);
        const response = await fetch(imageUri);
        const blob     = await response.blob();
        const ext      = imageUri.split('.').pop() || 'jpg';
        imageUrl       = await storageService.uploadVehicleImage(`vehicle-submissions/${Date.now()}.${ext}`, blob);
        setUploading(false);
      }

      // Create vehicle with pending_approval status
      const vehicleData = {
        make:        form.make,
        model:       form.model,
        year:        parseInt(form.year),
        type:        finalType,
        seats:       parseInt(form.seats),
        description: form.description,
        price_per_day:       parseFloat(form.pricePerDay),
        total_quantity:      1,
        available_quantity:  0,     // 0 until approved
        image_url:           imageUrl,
        owner_id:            ownerId,
        owner_name:          ownerName,
        approval_status:     'pending_approval',  // KEY FIELD
        approved:            false,
        submitted_by_owner:  true,
        created_at:          new Date().toISOString(),
        updated_at:          new Date().toISOString(),
      };

      const { id: vehicleId } = await vehiclesService.add(vehicleData);

      // Create the variant
      await variantsService.add({
        vehicle_id:         vehicleId,
        color:              form.color,
        plate_number:       form.plateNumber.trim().toUpperCase(),
        price_per_day:      parseFloat(form.pricePerDay),
        image_url:          imageUrl,
        is_available:       false,  // Not available until approved
        available_quantity: 0,
        total_quantity:     1,
        owner_id:           ownerId,
        approval_status:    'pending_approval',
      });

      reset();
      onClose();
      onSubmitted?.();
    } catch (e) {
      console.error('Submit vehicle error:', e);
      Alert.alert('Error', 'Failed to submit vehicle: ' + e.message);
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const Field = ({ label, placeholder, value, onChange, keyboard, multi }) => (
    <View style={ms.fieldGroup}>
      <Text style={ms.fieldLabel}>{label}</Text>
      <TextInput
        style={[ms.fieldInput, multi && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.subtle}
        keyboardType={keyboard || 'default'}
        multiline={multi}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
        <View style={ms.header}>
          <Text style={ms.headerTitle}>Submit New Vehicle</Text>
          <TouchableOpacity onPress={() => { reset(); onClose(); }}>
            <Ionicons name="close" size={24} color={C.ink} />
          </TouchableOpacity>
        </View>

        <View style={ms.infoBanner}>
          <Ionicons name="information-circle-outline" size={16} color={C.inkSoft} />
          <Text style={ms.infoTxt}>Your vehicle will be reviewed by the admin before it appears on the website.</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Image */}
          <TouchableOpacity style={ms.imagePicker} onPress={pickImage}>
            {imageUri
              ? <Image source={{ uri: imageUri }} style={ms.pickerImage} resizeMode="cover" />
              : <View style={ms.pickerPlaceholder}>
                  <Ionicons name="camera-outline" size={32} color={C.muted} />
                  <Text style={ms.pickerHint}>Tap to add vehicle photo</Text>
                </View>
            }
          </TouchableOpacity>

          <Field label="Make *"          placeholder="e.g., Toyota"    value={form.make}         onChange={v => setForm({ ...form, make: v })} />
          <Field label="Model *"         placeholder="e.g., Vios"      value={form.model}        onChange={v => setForm({ ...form, model: v })} />
          <Field label="Year *"          placeholder="e.g., 2022"      value={form.year}         onChange={v => setForm({ ...form, year: v })}         keyboard="numeric" />
          <Field label="Seats *"         placeholder="e.g., 5"         value={form.seats}        onChange={v => setForm({ ...form, seats: v })}        keyboard="numeric" />
          <Field label="Price per Day (₱) *" placeholder="e.g., 1500" value={form.pricePerDay}  onChange={v => setForm({ ...form, pricePerDay: v })}  keyboard="decimal-pad" />
          <Field label="Color *"         placeholder="e.g., White"     value={form.color}        onChange={v => setForm({ ...form, color: v })} />
          <Field label="Plate Number *"  placeholder="e.g., ABC-1234"  value={form.plateNumber}  onChange={v => setForm({ ...form, plateNumber: v.toUpperCase() })} />
          <Field label="Description"     placeholder="Additional info..." value={form.description} onChange={v => setForm({ ...form, description: v })} multi />

          {/* Type Selector */}
          <Text style={ms.fieldLabel}>Vehicle Type *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {VEHICLE_TYPES.map(t => (
              <TouchableOpacity
                key={t}
                style={[ms.typeChip, form.type === t && ms.typeChipActive]}
                onPress={() => { setForm({ ...form, type: t }); setShowCustom(t === 'Other'); }}
              >
                <Text style={[ms.typeChipTxt, form.type === t && ms.typeChipTxtActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {showCustom && (
            <Field label="Custom Type *" placeholder="e.g., Coupe" value={customType} onChange={setCustomType} />
          )}

          <TouchableOpacity
            style={[ms.submitBtn, (saving || uploading) && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={saving || uploading}
          >
            <Ionicons name="send-outline" size={18} color="#fff" />
            <Text style={ms.submitBtnTxt}>{uploading ? 'Uploading...' : saving ? 'Submitting...' : 'Submit for Approval'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const ms = StyleSheet.create({
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle:    { fontSize: 20, fontWeight: '800', color: C.ink },
  infoBanner:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, margin: 14, padding: 12, backgroundColor: '#fffbeb', borderRadius: 10, borderWidth: 1, borderColor: '#fde68a' },
  infoTxt:        { flex: 1, fontSize: 13, color: C.inkSoft, lineHeight: 18 },
  imagePicker:    { height: 160, backgroundColor: C.borderSoft, borderRadius: 12, marginBottom: 14, overflow: 'hidden', borderWidth: 1, borderColor: C.border, borderStyle: 'dashed' },
  pickerImage:    { width: '100%', height: '100%' },
  pickerPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  pickerHint:     { fontSize: 13, color: C.muted },
  fieldGroup:     { marginBottom: 12 },
  fieldLabel:     { fontSize: 12, fontWeight: '700', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  fieldInput:     { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, fontSize: 15, color: C.ink, backgroundColor: C.white },
  typeChip:       { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: C.borderSoft, marginRight: 8, borderWidth: 1, borderColor: C.border },
  typeChipActive: { backgroundColor: C.ink, borderColor: C.ink },
  typeChipTxt:    { fontSize: 13, fontWeight: '600', color: C.muted },
  typeChipTxtActive: { color: '#fff' },
  submitBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15, marginTop: 8 },
  submitBtnTxt:   { fontSize: 16, fontWeight: '700', color: '#fff' },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function OwnerPortalVehicles({ navigation }) {
  const [owner, setOwner]           = useState(null);
  const [variants, setVariants]     = useState([]);
  const [vehicles, setVehicles]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [feedbackModal, setFeedbackModal] = useState({ visible: false, type: 'success', message: '' });
  const [actionModal, setActionModal] = useState(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    setLoading(true);
    try {
      const u = firebaseAuth.getCurrentUser();
      if (!u) return;
      const owners = await carOwnersService.list();
      const me = (owners || []).find(o => o.email === u.email);
      setOwner(me || null);
      if (me) await loadVehicles(me.id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const loadVehicles = async (ownerId) => {
    try {
      const allVariants = await variantsService.list();
      const myVariants  = (allVariants || []).filter(v => v.owner_id === ownerId);
      setVariants(myVariants);

      const allVehicles = await vehiclesService.list();
      // Include vehicles submitted by this owner (even pending)
      const myVehicleIds = new Set(myVariants.map(v => v.vehicle_id));
      // Also fetch vehicles submitted by owner directly
      const ownerVehicles = allVehicles.filter(v => v.owner_id === ownerId || myVehicleIds.has(v.id));
      setVehicles(ownerVehicles);
    } catch (e) { console.error('loadVehicles error:', e); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await init();
    setRefreshing(false);
  };

  // Build a unified display list: each vehicle with its variants
  const displayItems = useMemo(() => {
    return vehicles.map(v => {
      const myVariantsForVehicle = variants.filter(vr => vr.vehicle_id === v.id);
      return { ...v, myVariants: myVariantsForVehicle };
    });
  }, [vehicles, variants]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return displayItems;
    if (activeFilter === 'pending') return displayItems.filter(v => v.approval_status === 'pending_approval');
    if (activeFilter === 'approved') return displayItems.filter(v => v.approval_status === 'approved' || !v.approval_status);
    if (activeFilter === 'rejected') return displayItems.filter(v => v.approval_status === 'rejected');
    return displayItems;
  }, [displayItems, activeFilter]);

  const renderVehicle = ({ item }) => {
    const approvalStatus = item.approval_status || 'approved';
    const approval = APPROVAL_STATUS[approvalStatus] || APPROVAL_STATUS.approved;
    const isApproved = approvalStatus === 'approved' || !item.approval_status;
    const isPending  = approvalStatus === 'pending_approval';
    const isRejected = approvalStatus === 'rejected';

    return (
      <View style={vs.card}>
        {/* Approval Banner */}
        {isPending && (
          <View style={[vs.approvalBanner, { backgroundColor: '#fffbeb', borderBottomColor: '#fde68a' }]}>
            <Ionicons name="time-outline" size={14} color={C.pending} />
            <Text style={[vs.approvalBannerTxt, { color: '#92400e' }]}>Waiting for admin approval</Text>
          </View>
        )}
        {isRejected && (
          <View style={[vs.approvalBanner, { backgroundColor: '#fef2f2', borderBottomColor: '#fecaca' }]}>
            <Ionicons name="close-circle-outline" size={14} color={C.cancelled} />
            <Text style={[vs.approvalBannerTxt, { color: '#991b1b' }]}>Rejected by admin</Text>
          </View>
        )}
        {isApproved && (
          <View style={[vs.approvalBanner, { backgroundColor: '#f0fdf4', borderBottomColor: '#bbf7d0' }]}>
            <Ionicons name="checkmark-circle-outline" size={14} color={C.confirmed} />
            <Text style={[vs.approvalBannerTxt, { color: '#166534' }]}>Approved — Live on website</Text>
          </View>
        )}

        {/* Image */}
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={vs.vehicleImage} resizeMode="cover" />
        ) : (
          <View style={[vs.vehicleImage, vs.noImage]}>
            <Ionicons name="car-outline" size={40} color={C.muted} />
          </View>
        )}

        <View style={vs.cardBody}>
          <View style={vs.cardHead}>
            <View style={{ flex: 1 }}>
              <Text style={vs.vehicleName}>{item.make} {item.model}</Text>
              <Text style={vs.vehicleYear}>{item.year} · {item.type}</Text>
            </View>
            <View style={[vs.approvalPill, { backgroundColor: approval.color + '20' }]}>
              <Ionicons name={approval.icon} size={12} color={approval.color} />
              <Text style={[vs.approvalPillTxt, { color: approval.color }]}>{approval.label}</Text>
            </View>
          </View>

          {/* Variants */}
          {item.myVariants.length > 0 && (
            <View style={vs.variantsWrap}>
              {item.myVariants.map(vr => (
                <View key={vr.id} style={vs.variantRow}>
                  <View style={vs.variantDot} />
                  <Text style={vs.variantTxt}>{vr.color}</Text>
                  {vr.plate_number && <Text style={vs.plateTxt}>{vr.plate_number}</Text>}
                  <Text style={vs.priceTxt}>₱{parseFloat(vr.price_per_day || 0).toLocaleString()}/day</Text>
                </View>
              ))}
            </View>
          )}

          {/* Stats row */}
          <View style={vs.statsRow}>
            <View style={vs.statItem}>
              <Ionicons name="people-outline" size={14} color={C.muted} />
              <Text style={vs.statTxt}>{item.seats} seats</Text>
            </View>
            <View style={vs.statItem}>
              <Ionicons name="cash-outline" size={14} color={C.muted} />
              <Text style={vs.statTxt}>₱{parseFloat(item.price_per_day || 0).toLocaleString()}/day</Text>
            </View>
          </View>

          {item.approval_notes && (
            <View style={vs.notesBox}>
              <Ionicons name="chatbox-outline" size={13} color={C.inkSoft} />
              <Text style={vs.notesTxt} numberOfLines={2}>{item.approval_notes}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const pendingCount  = displayItems.filter(v => v.approval_status === 'pending_approval').length;
  const approvedCount = displayItems.filter(v => v.approval_status === 'approved' || !v.approval_status).length;

  return (
    <View style={vs.container}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.white }}>
        <View style={vs.header}>
          <View>
            <Text style={vs.headerTitle}>My Vehicles</Text>
            <Text style={vs.headerSub}>{displayItems.length} vehicle{displayItems.length !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity style={vs.addBtn} onPress={() => setSubmitModal(true)}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={vs.addBtnTxt}>Submit Vehicle</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Info Banner if has pending */}
      {pendingCount > 0 && (
        <View style={vs.pendingBanner}>
          <Ionicons name="time-outline" size={16} color="#92400e" />
          <Text style={vs.pendingBannerTxt}>{pendingCount} vehicle{pendingCount > 1 ? 's' : ''} waiting for admin approval</Text>
        </View>
      )}

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={vs.filterBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 10 }}>
        {[
          { key: 'all',      label: 'All',      count: displayItems.length },
          { key: 'approved', label: 'Approved',  count: approvedCount },
          { key: 'pending',  label: 'Pending',   count: pendingCount },
          { key: 'rejected', label: 'Rejected',  count: displayItems.filter(v => v.approval_status === 'rejected').length },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[vs.filterTab, activeFilter === f.key && vs.filterTabActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[vs.filterTabTxt, activeFilter === f.key && vs.filterTabTxtActive]}>{f.label}</Text>
            <View style={[vs.filterBadge, activeFilter === f.key && vs.filterBadgeActive]}>
              <Text style={[vs.filterBadgeTxt, activeFilter === f.key && vs.filterBadgeTxtActive]}>{f.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderVehicle}
        contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading || refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={vs.empty}>
            <Ionicons name="car-outline" size={52} color="#d1d5db" />
            <Text style={vs.emptyTitle}>No vehicles yet</Text>
            <Text style={vs.emptyTxt}>Submit a vehicle for admin approval to get it listed on the website</Text>
            <TouchableOpacity style={vs.emptyBtn} onPress={() => setSubmitModal(true)}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={vs.emptyBtnTxt}>Submit Vehicle</Text>
            </TouchableOpacity>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />

      <SubmitVehicleModal
        visible={submitModal}
        onClose={() => setSubmitModal(false)}
        ownerId={owner?.id}
        ownerName={owner?.name}
        onSubmitted={() => {
          setFeedbackModal({ visible: true, type: 'success', message: 'Vehicle submitted! Admin will review and approve it shortly.' });
          init();
        }}
      />

      {actionModal && (
        <ActionModal visible type="confirm" title={actionModal.title} message={actionModal.message}
          onClose={() => setActionModal(null)}
          onConfirm={async () => { await actionModal.onConfirm?.(); setActionModal(null); }} />
      )}
      <ActionModal
        visible={feedbackModal.visible}
        type={feedbackModal.type}
        title={feedbackModal.type === 'success' ? 'Success' : 'Error'}
        message={feedbackModal.message}
        confirmText="OK"
        onClose={() => setFeedbackModal({ visible: false, type: 'success', message: '' })}
        onConfirm={() => setFeedbackModal({ visible: false, type: 'success', message: '' })}
      />
    </View>
  );
}

const vs = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.surface },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 24, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  headerSub:   { fontSize: 12, color: C.muted, marginTop: 2 },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.ink, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  addBtnTxt:   { color: '#fff', fontSize: 13, fontWeight: '700' },

  pendingBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, paddingHorizontal: 16, backgroundColor: '#fffbeb', borderBottomWidth: 1, borderBottomColor: '#fde68a' },
  pendingBannerTxt: { fontSize: 13, color: '#92400e', fontWeight: '600', flex: 1 },

  filterBar:    { backgroundColor: C.white, maxHeight: 56, borderBottomWidth: 1, borderBottomColor: C.border },
  filterTab:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: C.borderSoft, borderWidth: 1, borderColor: C.border },
  filterTabActive: { backgroundColor: C.ink, borderColor: C.ink },
  filterTabTxt: { fontSize: 13, fontWeight: '600', color: C.muted },
  filterTabTxtActive: { color: '#fff' },
  filterBadge:  { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.border, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeTxt:    { fontSize: 10, fontWeight: '700', color: C.muted },
  filterBadgeTxtActive: { color: '#fff' },

  card:         { backgroundColor: C.white, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 4, elevation: 3 },
  approvalBanner: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1 },
  approvalBannerTxt: { fontSize: 12, fontWeight: '700', flex: 1 },
  vehicleImage: { width: '100%', height: 160 },
  noImage:      { backgroundColor: C.borderSoft, justifyContent: 'center', alignItems: 'center' },
  cardBody:     { padding: 14 },
  cardHead:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  vehicleName:  { fontSize: 17, fontWeight: '800', color: C.ink },
  vehicleYear:  { fontSize: 13, color: C.muted, marginTop: 2 },
  approvalPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  approvalPillTxt: { fontSize: 11, fontWeight: '700' },
  variantsWrap: { backgroundColor: C.surface, borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  variantRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  variantDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.ink },
  variantTxt:   { fontSize: 13, fontWeight: '600', color: C.inkSoft, flex: 1 },
  plateTxt:     { fontSize: 12, color: C.muted, fontFamily: 'monospace' },
  priceTxt:     { fontSize: 12, fontWeight: '700', color: C.ink },
  statsRow:     { flexDirection: 'row', gap: 16, marginBottom: 8 },
  statItem:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statTxt:      { fontSize: 13, color: C.muted },
  notesBox:     { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: C.borderSoft, borderRadius: 8, padding: 8, marginTop: 8 },
  notesTxt:     { flex: 1, fontSize: 12, color: C.inkSoft, lineHeight: 16 },

  empty:        { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30 },
  emptyTitle:   { fontSize: 18, fontWeight: '800', color: C.inkSoft, marginTop: 16, marginBottom: 8 },
  emptyTxt:     { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.ink, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnTxt:  { color: '#fff', fontSize: 14, fontWeight: '700' },
});