"use strict";

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { carOwnersService, firebaseAuth } from '../services/firebaseService';
import ActionModal from '../components/AlertModal/ActionModal';

// ─── Design tokens — black/neutral theme (matches Dashboard/Vehicles/Bookings) ──
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
  cancelled:  '#ef4444',
};

export default function OwnerPortalSettings({ navigation }) {
  const [owner, setOwner]     = useState(null);
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  // Password change state
  const [currentPw, setCurrentPw]       = useState('');
  const [newPw, setNewPw]               = useState('');
  const [confirmPw, setConfirmPw]       = useState('');
  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [savingPw, setSavingPw]         = useState(false);

  const [feedbackModal, setFeedback]    = useState({ visible: false, type: 'success', message: '' });
  const [actionModal, setActionModal]   = useState(null);

  useEffect(() => { init(); }, []);

  const init = async () => {
    setLoading(true);
    try {
      const u = firebaseAuth.getCurrentUser();
      setUser(u);
      if (!u) return;
      const owners = await carOwnersService.list();
      const me = (owners || []).find(o => o.email === u.email);
      setOwner(me || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      setFeedback({ visible: true, type: 'error', message: 'Please fill in all password fields.' }); return;
    }
    if (newPw.length < 6) {
      setFeedback({ visible: true, type: 'error', message: 'New password must be at least 6 characters.' }); return;
    }
    if (newPw !== confirmPw) {
      setFeedback({ visible: true, type: 'error', message: 'New passwords do not match.' }); return;
    }
    if (newPw === currentPw) {
      setFeedback({ visible: true, type: 'error', message: 'New password must differ from current.' }); return;
    }

    setSavingPw(true);
    try {
      await firebaseAuth.reauthenticateWithPassword(currentPw);
      await firebaseAuth.updatePassword(newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setFeedback({ visible: true, type: 'success', message: 'Password updated successfully!' });
    } catch (e) {
      const msg =
        e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential'
          ? 'Current password is incorrect.'
          : e.code === 'auth/too-many-requests'
          ? 'Too many attempts. Please try again later.'
          : 'Failed to update password: ' + e.message;
      setFeedback({ visible: true, type: 'error', message: msg });
    } finally { setSavingPw(false); }
  };

  const handleSignOut = () => setActionModal({
    title:   'Sign Out',
    message: 'Are you sure you want to sign out of the Owner Portal?',
    onConfirm: async () => {
      try { await firebaseAuth.signOut(); }
      catch { setFeedback({ visible: true, type: 'error', message: 'Failed to sign out.' }); }
    },
  });

  // ── Reusable password field ──────────────────────────────────────────────
  const PwField = ({ label, value, onChange, show, onToggle }) => (
    <View style={s.fieldGroup}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.pwRow}>
        <TextInput
          style={[s.input, { flex: 1, borderWidth: 0, paddingRight: 0 }]}
          value={value}
          onChangeText={onChange}
          secureTextEntry={!show}
          placeholder="••••••••"
          placeholderTextColor={C.subtle}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <TouchableOpacity style={s.eyeBtn} onPress={onToggle}>
          <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.muted} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Info row component ───────────────────────────────────────────────────
  const InfoRow = ({ icon, label, value }) => (
    <View style={s.infoRow}>
      <View style={s.infoIcon}>
        <Ionicons name={icon} size={16} color={C.ink} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue} numberOfLines={1}>{value || '—'}</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      {/* Header */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: C.white }}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Settings</Text>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Profile Identity Card ─────────────────────────────────────────── */}
        <View style={s.profileCard}>
          <View style={s.profileAva}>
            <Text style={s.profileAvaText}>{(owner?.name || 'O').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{owner?.name || '—'}</Text>
            <Text style={s.profileEmail}>{owner?.email || user?.email || '—'}</Text>
            <View style={s.portalBadge}>
              <Ionicons name="shield-checkmark-outline" size={11} color={C.ink} />
              <Text style={s.portalBadgeTxt}>Car Owner Portal</Text>
              <View style={[s.statusDot, { backgroundColor: owner?.status === 'active' ? C.confirmed : C.muted }]} />
              <Text style={[s.portalBadgeTxt, { color: owner?.status === 'active' ? C.confirmed : C.muted }]}>
                {owner?.status || 'active'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Account Information ───────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconWrap}>
              <Ionicons name="person-circle-outline" size={20} color={C.ink} />
            </View>
            <Text style={s.cardTitle}>Account Information</Text>
          </View>

          <InfoRow icon="person-outline"          label="Full Name"      value={owner?.name} />
          <InfoRow icon="mail-outline"             label="Email Address"  value={owner?.email || user?.email} />
          <InfoRow icon="call-outline"             label="Phone"          value={owner?.phone || owner?.contact_number} />
          <InfoRow icon="checkmark-circle-outline" label="Account Status" value={owner?.status ? owner.status.charAt(0).toUpperCase() + owner.status.slice(1) : 'Active'} />
        </View>

        {/* ── Change Password ───────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={C.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Change Password</Text>
              <Text style={s.cardSub}>Secure your account with a strong password</Text>
            </View>
          </View>

          <PwField
            label="Current Password"
            value={currentPw}
            onChange={setCurrentPw}
            show={showCurrent}
            onToggle={() => setShowCurrent(v => !v)}
          />
          <PwField
            label="New Password"
            value={newPw}
            onChange={setNewPw}
            show={showNew}
            onToggle={() => setShowNew(v => !v)}
          />
          <PwField
            label="Confirm New Password"
            value={confirmPw}
            onChange={setConfirmPw}
            show={showConfirm}
            onToggle={() => setShowConfirm(v => !v)}
          />

          <View style={s.pwHint}>
            <Ionicons name="information-circle-outline" size={13} color={C.subtle} />
            <Text style={s.pwHintTxt}>Password must be at least 6 characters</Text>
          </View>

          <TouchableOpacity
            style={[s.pwBtn, (savingPw || !currentPw || !newPw || !confirmPw) && s.pwBtnDisabled]}
            onPress={handleChangePassword}
            disabled={savingPw || !currentPw || !newPw || !confirmPw}
          >
            <Ionicons name="lock-closed" size={16} color="#fff" />
            <Text style={s.pwBtnTxt}>{savingPw ? 'Updating...' : 'Update Password'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Portal Access Info ────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconWrap}>
              <Ionicons name="information-circle-outline" size={20} color={C.ink} />
            </View>
            <Text style={s.cardTitle}>Portal Access</Text>
          </View>

          {[
            { icon: 'car-outline',           txt: 'View and manage bookings for your vehicles' },
            { icon: 'add-circle-outline',    txt: 'Submit vehicles for admin review and approval' },
            { icon: 'notifications-outline', txt: 'Receive notifications about rentals and approvals' },
            { icon: 'analytics-outline',     txt: 'View earnings and rental statistics' },
          ].map(item => (
            <View key={item.txt} style={s.accessRow}>
              <View style={s.accessIcon}>
                <Ionicons name={item.icon} size={15} color={C.ink} />
              </View>
              <Text style={s.accessTxt}>{item.txt}</Text>
            </View>
          ))}

          <View style={s.accessDivider} />

          <View style={s.accessRow}>
            <View style={s.accessIcon}>
              <Ionicons name="shield-outline" size={15} color={C.subtle} />
            </View>
            <Text style={[s.accessTxt, { color: C.muted }]}>
              Booking status changes are managed by admin
            </Text>
          </View>
          <View style={s.accessRow}>
            <View style={s.accessIcon}>
              <Ionicons name="globe-outline" size={15} color={C.subtle} />
            </View>
            <Text style={[s.accessTxt, { color: C.muted }]}>
              Website management is handled by admin
            </Text>
          </View>
        </View>

        {/* ── Quick Navigation ──────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIconWrap}>
              <Ionicons name="apps-outline" size={20} color={C.ink} />
            </View>
            <Text style={s.cardTitle}>Navigate</Text>
          </View>

          {[
            { label: 'Dashboard',   icon: 'grid-outline',          screen: 'OwnerPortalDashboard' },
            { label: 'My Vehicles', icon: 'car-outline',           screen: 'OwnerPortalVehicles'  },
            { label: 'My Bookings', icon: 'document-text-outline', screen: 'OwnerPortalBookings'  },
          ].map(item => (
            <TouchableOpacity
              key={item.screen}
              style={s.navRow}
              onPress={() => navigation?.navigate?.(item.screen)}
            >
              <View style={s.navIcon}>
                <Ionicons name={item.icon} size={16} color={C.ink} />
              </View>
              <Text style={s.navTxt}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={C.border} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Sign Out ──────────────────────────────────────────────────────── */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={C.cancelled} />
          <Text style={s.signOutTxt}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={s.versionTxt}>Owner Portal · Car Rental Management</Text>
      </ScrollView>

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

const s = StyleSheet.create({
  // ── Header ────────────────────────────────────────────────────────────────
  header:      { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 26, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },

  // ── Profile Card ──────────────────────────────────────────────────────────
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    margin: 16, marginTop: 14, padding: 16,
    backgroundColor: C.ink, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
  },
  profileAva:    { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  profileAvaText:{ fontSize: 22, fontWeight: '800', color: '#fff' },
  profileName:   { fontSize: 17, fontWeight: '800', color: '#fff' },
  profileEmail:  { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  portalBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start', marginTop: 7 },
  portalBadgeTxt:{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  statusDot:     { width: 6, height: 6, borderRadius: 3 },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card:       {
    backgroundColor: C.white, borderRadius: 16, marginHorizontal: 16,
    marginBottom: 14, padding: 16, borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardIconWrap:{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.borderSoft, justifyContent: 'center', alignItems: 'center' },
  cardTitle:  { fontSize: 16, fontWeight: '800', color: C.ink, letterSpacing: -0.3 },
  cardSub:    { fontSize: 12, color: C.subtle, marginTop: 2 },

  // ── Info rows ─────────────────────────────────────────────────────────────
  infoRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  infoIcon:   { width: 32, height: 32, borderRadius: 10, backgroundColor: C.borderSoft, justifyContent: 'center', alignItems: 'center' },
  infoLabel:  { fontSize: 10, color: C.subtle, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue:  { fontSize: 14, fontWeight: '600', color: C.ink, marginTop: 2 },

  // ── Password ──────────────────────────────────────────────────────────────
  fieldGroup: { marginBottom: 2 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  input:      { borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 12, fontSize: 14, color: C.ink, backgroundColor: C.white },
  pwRow:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, borderRadius: 8, backgroundColor: C.white, overflow: 'hidden' },
  eyeBtn:     { paddingHorizontal: 12, paddingVertical: 10 },
  pwHint:     { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, marginBottom: 4 },
  pwHintTxt:  { fontSize: 12, color: C.subtle },
  pwBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.ink, borderRadius: 10, paddingVertical: 13, marginTop: 14 },
  pwBtnDisabled: { opacity: 0.4 },
  pwBtnTxt:   { color: '#fff', fontSize: 15, fontWeight: '700' },

  // ── Access Info ───────────────────────────────────────────────────────────
  accessRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  accessIcon:   { width: 28, height: 28, borderRadius: 8, backgroundColor: C.borderSoft, justifyContent: 'center', alignItems: 'center' },
  accessTxt:    { fontSize: 13, color: C.inkSoft, flex: 1, lineHeight: 18 },
  accessDivider:{ height: 1, backgroundColor: C.borderSoft, marginVertical: 8 },

  // ── Navigation ────────────────────────────────────────────────────────────
  navRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.borderSoft },
  navIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.borderSoft, justifyContent: 'center', alignItems: 'center' },
  navTxt:  { flex: 1, fontSize: 14, fontWeight: '600', color: C.ink },

  // ── Sign Out ──────────────────────────────────────────────────────────────
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 4, marginBottom: 12, paddingVertical: 14,
    backgroundColor: '#fef2f2', borderRadius: 12, borderWidth: 1, borderColor: '#fecaca',
  },
  signOutTxt: { fontSize: 16, fontWeight: '700', color: C.cancelled },
  versionTxt: { textAlign: 'center', fontSize: 11, color: C.subtle, paddingBottom: 16 },
});