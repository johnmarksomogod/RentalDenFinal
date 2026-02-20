/**
 * Firebase service layer - AdminSide
 * All data operations are USER-SCOPED: only the logged-in user's data is accessed.
 * Multi-tenant: each business owner sees only their own vehicles, bookings, etc.
 */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, uploadString, getDownloadURL, deleteObject, StringFormat } from "firebase/storage";
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updatePassword, onAuthStateChanged, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, authUserCreation, db, storage } from "./firebase";

// ============ AUTH ============
export const firebaseAuth = {
  signInWithPassword: (email, password) =>
    signInWithEmailAndPassword(auth, email, password),

  signOut: () => signOut(auth),

  resetPasswordForEmail: (email) => sendPasswordResetEmail(auth, email),

  updatePassword: (newPassword) => {
    const user = auth.currentUser;
    if (!user) throw new Error("User must be logged in");
    return updatePassword(user, newPassword);
  },

  getCurrentUser: () => auth.currentUser,

  onAuthStateChange: (callback) => onAuthStateChanged(auth, callback),
};

// ============ APP USERS (roles: owner | admin | driver) ============
export const getCurrentAppUser = async () => {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  const snap = await getDoc(doc(db, "app_users", uid));
  if (snap.exists()) return fromFirestore(snap);
  return { id: uid, role: "owner", owner_uid: uid, status: "active", email: auth.currentUser?.email || "" };
};

export const ensureOwnerAppUser = async () => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const d = doc(db, "app_users", uid);
  const snap = await getDoc(d);
  if (snap.exists()) return;
  await setDoc(d, {
    email: auth.currentUser?.email || "",
    role: "owner",
    owner_uid: uid,
    status: "active",
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  }, { merge: true });
};
const requireUserId = () => {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be logged in");
  return user.uid;
};

// Role-based: tenant (owner) id and role cached by App after login
let _effectiveOwnerId = null;
let _role = "owner";
export const setAuthCache = (effectiveOwnerId, role) => {
  _effectiveOwnerId = effectiveOwnerId;
  _role = role || "owner";
};
export const getEffectiveOwnerIdSync = () => _effectiveOwnerId;
export const getRoleSync = () => _role;
const requireOwnerId = () => _effectiveOwnerId || requireUserId();

const toFirestore = (obj) => {
  if (!obj) return obj;
  const out = { ...obj };
  for (const k of Object.keys(out)) {
    if (out[k] instanceof Date) out[k] = Timestamp.fromDate(out[k]);
  }
  return out;
};

const fromFirestore = (docSnap) => {
  if (!docSnap?.exists()) return null;
  const d = docSnap.data();
  const id = docSnap.id;
  const out = { id, ...d };
  for (const k of Object.keys(out)) {
    if (out[k]?.toDate) out[k] = out[k].toDate();
  }
  return out;
};

const fromFirestoreList = (snapshot) =>
  snapshot.docs.map((d) => fromFirestore(d));

// ============ VEHICLES (owner-scoped) ============
export const vehiclesService = {
  list: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "vehicles"),
      where("user_id", "==", ownerId),
      orderBy("created_at", "desc")
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  subscribe: (onData, onError) => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "vehicles"),
      where("user_id", "==", ownerId),
      orderBy("created_at", "desc")
    );
    return onSnapshot(q, (snap) => onData(fromFirestoreList(snap)), onError);
  },

  add: async (data) => {
    const ownerId = requireOwnerId();
    const ref = await addDoc(collection(db, "vehicles"), {
      ...toFirestore(data),
      user_id: ownerId,
      created_at: serverTimestamp(),
    });
    return { id: ref.id };
  },

  update: async (id, data) => {
    const ownerId = requireOwnerId();
    const d = doc(db, "vehicles", id);
    const snap = await getDoc(d);
    if (!snap.exists() || snap.data().user_id !== ownerId) {
      throw new Error("Vehicle not found or access denied");
    }
    await updateDoc(d, { ...data, updated_at: serverTimestamp() });
  },

  delete: async (id) => {
    const ownerId = requireOwnerId();
    const d = doc(db, "vehicles", id);
    const snap = await getDoc(d);
    if (!snap.exists() || snap.data().user_id !== ownerId) {
      throw new Error("Vehicle not found or access denied");
    }
    // Delete associated variants first
    const vq = query(
      collection(db, "vehicle_variants"),
      where("vehicle_id", "==", id),
      where("user_id", "==", ownerId)
    );
    const vSnap = await getDocs(vq);
    const batch = writeBatch(db);
    vSnap.docs.forEach((vd) => batch.delete(vd.ref));
    batch.delete(d);
    await batch.commit();
  },

  getById: async (id) => {
    const ownerId = requireOwnerId();
    const snap = await getDoc(doc(db, "vehicles", id));
    const v = fromFirestore(snap);
    if (!v || v.user_id !== ownerId) return null;
    return v;
  },
};

// ============ VEHICLE VARIANTS (owner-scoped) ============
export const variantsService = {
  list: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "vehicle_variants"),
      where("user_id", "==", ownerId),
      orderBy("color", "asc")
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  listByOwnerId: async (ownerId) => {
    const tenantId = requireOwnerId();
    const q = query(
      collection(db, "vehicle_variants"),
      where("owner_id", "==", ownerId),
      where("user_id", "==", tenantId)
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  listByVehicleId: async (vehicleId) => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "vehicle_variants"),
      where("vehicle_id", "==", vehicleId),
      where("user_id", "==", ownerId)
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  listAvailable: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "vehicle_variants"),
      where("user_id", "==", ownerId),
      where("available_quantity", ">", 0)
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  listWithVehicles: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "vehicle_variants"),
      where("user_id", "==", ownerId)
    );
    const snap = await getDocs(q);
    const variants = fromFirestoreList(snap);
    const vehicleIds = [...new Set(variants.map((v) => v.vehicle_id).filter(Boolean))];
    const vehiclesMap = {};
    await Promise.all(vehicleIds.map(async (vid) => { vehiclesMap[vid] = await getVehicleById(vid); }));
    return variants.map((v) => ({ ...v, vehicles: vehiclesMap[v.vehicle_id] || null }));
  },

  listAvailableWithVehicles: async () => {
    const variants = await (async () => {
      const ownerId = requireOwnerId();
      const q = query(
        collection(db, "vehicle_variants"),
        where("user_id", "==", ownerId),
        where("available_quantity", ">", 0)
      );
      const snap = await getDocs(q);
      return fromFirestoreList(snap);
    })();
    const vehicleIds = [...new Set(variants.map((v) => v.vehicle_id).filter(Boolean))];
    const vehiclesMap = {};
    await Promise.all(vehicleIds.map(async (vid) => { vehiclesMap[vid] = await getVehicleById(vid); }));
    return variants.map((v) => ({
      ...v,
      vehicles: vehiclesMap[v.vehicle_id] || null,
    }));
  },

  subscribe: (onData, onError) => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "vehicle_variants"),
      where("user_id", "==", ownerId),
      orderBy("color", "asc")
    );
    return onSnapshot(q, (snap) => onData(fromFirestoreList(snap)), onError);
  },

  add: async (data) => {
    const ownerId = requireOwnerId();
    const ref = await addDoc(collection(db, "vehicle_variants"), {
      ...toFirestore(data),
      user_id: ownerId,
      created_at: serverTimestamp(),
    });
    return { id: ref.id };
  },

  update: async (id, data) => {
    const ownerId = requireOwnerId();
    const d = doc(db, "vehicle_variants", id);
    const snap = await getDoc(d);
    if (!snap.exists() || snap.data().user_id !== ownerId) {
      throw new Error("Variant not found or access denied");
    }
    await updateDoc(d, { ...data, updated_at: serverTimestamp() });
  },

  deleteByVehicleId: async (vehicleId) => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "vehicle_variants"),
      where("vehicle_id", "==", vehicleId),
      where("user_id", "==", ownerId)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  },

  getById: async (id) => {
    const snap = await getDoc(doc(db, "vehicle_variants", id));
    return fromFirestore(snap);
  },

  adjustQuantity: async (variantId, change) => {
    const d = doc(db, "vehicle_variants", variantId);
    const snap = await getDoc(d);
    if (!snap.exists()) throw new Error("Variant not found");
    const v = snap.data();
    const ownerId = requireOwnerId();
    if (v.user_id !== ownerId) throw new Error("Access denied");
    const avail = (v.available_quantity ?? 0) + change;
    const total = v.total_quantity ?? 1;
    await updateDoc(d, {
      available_quantity: Math.max(0, Math.min(avail, total)),
      updated_at: serverTimestamp(),
    });
  },
};

// ============ BOOKINGS (owner-scoped; driver sees only assigned) ============
const getVehicleById = async (id) => {
  if (!id) return null;
  const snap = await getDoc(doc(db, "vehicles", id));
  return fromFirestore(snap);
};
const getVariantById = async (id) => {
  if (!id) return null;
  const snap = await getDoc(doc(db, "vehicle_variants", id));
  return fromFirestore(snap);
};

export const bookingsService = {
  list: async () => {
    const ownerId = requireOwnerId();
    const isDriver = getRoleSync() === "driver";
    const constraints = [
      where("user_id", "==", ownerId),
      orderBy("created_at", "desc"),
    ];
    if (isDriver) constraints.unshift(where("assigned_driver_id", "==", requireUserId()));
    const q = query(collection(db, "bookings"), ...constraints);
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  /**
   * Unscoped list of ALL bookings for the current owner (user_id),
   * regardless of which driver is assigned. Intended for admin views
   * and the Driver Dashboard, where drivers can see all bookings but
   * can only act on cards assigned to them.
   */
  listAll: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "bookings"),
      where("user_id", "==", ownerId),
      orderBy("created_at", "desc")
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  subscribe: (onData, onError) => {
    const ownerId = requireOwnerId();
    const isDriver = getRoleSync() === "driver";
    const constraints = [
      where("user_id", "==", ownerId),
      orderBy("created_at", "desc"),
    ];
    if (isDriver) constraints.unshift(where("assigned_driver_id", "==", requireUserId()));
    const q = query(collection(db, "bookings"), ...constraints);
    return onSnapshot(q, (snap) => onData(fromFirestoreList(snap)), onError);
  },

  add: async (data) => {
    const ownerId = requireOwnerId();
    const ref = await addDoc(collection(db, "bookings"), {
      ...toFirestore(data),
      user_id: ownerId,
      created_at: serverTimestamp(),
    });
    return { id: ref.id };
  },

  update: async (id, data) => {
    const ownerId = requireOwnerId();
    const myUid = requireUserId();
    const d = doc(db, "bookings", id);
    const snap = await getDoc(d);
    if (!snap.exists()) throw new Error("Booking not found");
    const b = snap.data();
    if (b.user_id !== ownerId) throw new Error("Access denied");
    if (getRoleSync() === "driver" && b.assigned_driver_id !== myUid) throw new Error("Access denied");
    await updateDoc(d, { ...data, updated_at: serverTimestamp() });
  },

  delete: async (id) => {
    const ownerId = requireOwnerId();
    const d = doc(db, "bookings", id);
    const snap = await getDoc(d);
    if (!snap.exists() || snap.data().user_id !== ownerId) {
      throw new Error("Booking not found or access denied");
    }
    await deleteDoc(d);
  },

  getById: async (id) => {
    const snap = await getDoc(doc(db, "bookings", id));
    const b = fromFirestore(snap);
    if (!b) return null;
    const ownerId = requireOwnerId();
    if (b.user_id !== ownerId) return null;
    if (getRoleSync() === "driver" && b.assigned_driver_id !== requireUserId()) return null;
    return b;
  },

  listByVariantIds: async (variantIds) => {
    if (!variantIds?.length) return [];
    const bookings = await bookingsService.list();
    return bookings.filter((b) => variantIds.includes(b.vehicle_variant_id));
  },

  listWithDetails: async () => {
    const bookings = await bookingsService.list();
    const vehicleIds = [...new Set(bookings.map((b) => b.vehicle_id).filter(Boolean))];
    const variantIds = [...new Set(bookings.map((b) => b.vehicle_variant_id).filter(Boolean))];
    const vehiclesMap = {};
    const variantsMap = {};
    await Promise.all(vehicleIds.map(async (vid) => { vehiclesMap[vid] = await getVehicleById(vid); }));
    await Promise.all(variantIds.map(async (vid) => { variantsMap[vid] = await getVariantById(vid); }));
    return bookings.map((b) => ({
      ...b,
      vehicles: vehiclesMap[b.vehicle_id] || null,
      vehicle_variants: variantsMap[b.vehicle_variant_id] || null,
    }));
  },

  /**
   * Same as listWithDetails but using listAll() so it ignores the
   * driver scoping applied in list() when role === "driver".
   */
  listAllWithDetails: async () => {
    const bookings = await bookingsService.listAll();
    const vehicleIds = [...new Set(bookings.map((b) => b.vehicle_id).filter(Boolean))];
    const variantIds = [...new Set(bookings.map((b) => b.vehicle_variant_id).filter(Boolean))];
    const vehiclesMap = {};
    const variantsMap = {};
    await Promise.all(vehicleIds.map(async (vid) => { vehiclesMap[vid] = await getVehicleById(vid); }));
    await Promise.all(variantIds.map(async (vid) => { variantsMap[vid] = await getVariantById(vid); }));
    return bookings.map((b) => ({
      ...b,
      vehicles: vehiclesMap[b.vehicle_id] || null,
      vehicle_variants: variantsMap[b.vehicle_variant_id] || null,
    }));
  },
};

// ============ CAR OWNERS (owner-scoped) ============
export const carOwnersService = {
  list: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "car_owners"),
      where("user_id", "==", ownerId),
      where("status", "==", "active"),
      orderBy("name", "asc")
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  listAll: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "car_owners"),
      where("user_id", "==", ownerId),
      orderBy("created_at", "desc")
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  subscribe: (onData, onError) => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "car_owners"),
      where("user_id", "==", ownerId),
      orderBy("name", "asc")
    );
    return onSnapshot(q, (snap) => onData(fromFirestoreList(snap)), onError);
  },

  add: async (data) => {
    const ownerId = requireOwnerId();
    const ref = await addDoc(collection(db, "car_owners"), {
      ...toFirestore(data),
      user_id: ownerId,
      created_at: serverTimestamp(),
    });
    return { id: ref.id };
  },

  update: async (id, data) => {
    const ownerId = requireOwnerId();
    const d = doc(db, "car_owners", id);
    const snap = await getDoc(d);
    if (!snap.exists() || snap.data().user_id !== ownerId) {
      throw new Error("Car owner not found or access denied");
    }
    await updateDoc(d, { ...data, updated_at: serverTimestamp() });
  },

  delete: async (id) => {
    const ownerId = requireOwnerId();
    const d = doc(db, "car_owners", id);
    const snap = await getDoc(d);
    if (!snap.exists() || snap.data().user_id !== ownerId) {
      throw new Error("Car owner not found or access denied");
    }
    await deleteDoc(d);
  },

  getById: async (id) => {
    const snap = await getDoc(doc(db, "car_owners", id));
    const o = fromFirestore(snap);
    if (!o) return null;
    const ownerId = requireOwnerId();
    if (o.user_id !== ownerId) return null;
    return o;
  },
};

// ============ NOTIFICATIONS (owner-scoped) ============
export const notificationsService = {
  list: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", ownerId),
      orderBy("created_at", "desc")
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  listUnread: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", ownerId),
      where("dismissed", "==", false),
      orderBy("created_at", "desc")
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  subscribe: (onData, onError) => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", ownerId),
      orderBy("created_at", "desc")
    );
    return onSnapshot(q, (snap) => onData(fromFirestoreList(snap)), onError);
  },

  add: async (data) => {
    const ownerId = requireOwnerId();
    const ref = await addDoc(collection(db, "notifications"), {
      ...toFirestore(data),
      user_id: ownerId,
      created_at: serverTimestamp(),
    });
    return { id: ref.id };
  },

  update: async (id, data) => {
    const ownerId = requireOwnerId();
    const d = doc(db, "notifications", id);
    const snap = await getDoc(d);
    if (!snap.exists() || snap.data().user_id !== ownerId) {
      throw new Error("Notification not found or access denied");
    }
    await updateDoc(d, { ...data, updated_at: serverTimestamp() });
  },

  listByBookingId: async (bookingId) => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", ownerId),
      where("booking_id", "==", bookingId),
      where("dismissed", "==", false)
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  markAllDismissed: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", ownerId),
      where("dismissed", "==", false)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { dismissed: true, updated_at: serverTimestamp() }));
    if (snap.docs.length > 0) await batch.commit();
  },

  markAllRead: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "notifications"),
      where("user_id", "==", ownerId),
      where("read", "==", false)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.update(d.ref, { read: true, updated_at: serverTimestamp() }));
    if (snap.docs.length > 0) await batch.commit();
  },
};

// ============ WEBSITE CONTENT (owner-scoped) ============
export const websiteContentService = {
  getBySection: async (section) => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "website_content"),
      where("user_id", "==", ownerId),
      where("section", "==", section)
    );
    const snap = await getDocs(q);
    const list = fromFirestoreList(snap);
    return list[0] || null;
  },

  upsert: async (section, data) => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "website_content"),
      where("user_id", "==", ownerId),
      where("section", "==", section)
    );
    const snap = await getDocs(q);
    const existing = snap.docs[0];
    const payload = { ...data, section, user_id: ownerId, updated_at: serverTimestamp() };
    if (existing) {
      await updateDoc(existing.ref, payload);
      return { id: existing.id };
    }
    const ref = await addDoc(collection(db, "website_content"), {
      ...payload,
      created_at: serverTimestamp(),
    });
    return { id: ref.id };
  },
};

// ============ GALLERY (owner-scoped) ============
export const galleryService = {
  list: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "gallery"),
      where("user_id", "==", ownerId)
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  getImages: async (galleryId) => {
    const ownerId = requireOwnerId();
    const gRef = doc(db, "gallery", galleryId);
    const gSnap = await getDoc(gRef);
    if (!gSnap.exists() || gSnap.data().user_id !== ownerId) return [];
    const q = query(
      collection(db, "gallery_images"),
      where("gallery_id", "==", galleryId),
      where("is_active", "==", true)
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  addImage: async (galleryId, data) => {
    const ownerId = requireOwnerId();
    const gRef = doc(db, "gallery", galleryId);
    const gSnap = await getDoc(gRef);
    if (!gSnap.exists() || gSnap.data().user_id !== ownerId) {
      throw new Error("Gallery not found or access denied");
    }
    const ref = await addDoc(collection(db, "gallery_images"), {
      ...toFirestore(data),
      gallery_id: galleryId,
      user_id: ownerId,
      created_at: serverTimestamp(),
    });
    return { id: ref.id };
  },

  deleteImage: async (imageId) => {
    const ownerId = requireOwnerId();
    const d = doc(db, "gallery_images", imageId);
    const snap = await getDoc(d);
    if (!snap.exists() || snap.data().user_id !== ownerId) {
      throw new Error("Image not found or access denied");
    }
    await deleteDoc(d);
  },

  updateImage: async (imageId, data) => {
    const ownerId = requireOwnerId();
    const d = doc(db, "gallery_images", imageId);
    const snap = await getDoc(d);
    if (!snap.exists() || snap.data().user_id !== ownerId) {
      throw new Error("Image not found or access denied");
    }
    await updateDoc(d, { ...data, updated_at: serverTimestamp() });
  },

  getOrCreateGallery: async () => {
    const ownerId = requireOwnerId();
    const q = query(
      collection(db, "gallery"),
      where("user_id", "==", ownerId)
    );
    const snap = await getDocs(q);
    if (snap.docs.length > 0) return snap.docs[0].id;
    const ref = await addDoc(collection(db, "gallery"), {
      user_id: ownerId,
      created_at: serverTimestamp(),
    });
    return ref.id;
  },

  listImagesForUser: async () => {
    const galleryId = await galleryService.getOrCreateGallery();
    return galleryService.getImages(galleryId);
  },

  addImageToUserGallery: async (data) => {
    const galleryId = await galleryService.getOrCreateGallery();
    return galleryService.addImage(galleryId, data);
  },
};

// ============ STORAGE ============
export const storageService = {
  uploadGovId: async (fileName, blob) => {
    const ownerId = requireOwnerId();
    const path = `gov_ids/${ownerId}/${fileName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  },

  uploadGovIdFromBase64: async (fileName, base64Data) => {
    const ownerId = requireOwnerId();
    const path = `gov_ids/${ownerId}/${fileName}`;
    const storageRef = ref(storage, path);
    await uploadString(storageRef, base64Data, StringFormat.BASE64, { contentType: "image/jpeg" });
    return getDownloadURL(storageRef);
  },

  uploadGalleryImage: async (fileName, blob) => {
    const ownerId = requireOwnerId();
    const path = `gallery/${ownerId}/${fileName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  },

  uploadVehicleImage: async (path, blob) => {
    const ownerId = requireOwnerId();
    const fullPath = `vehicle-images/${ownerId}/${path}`;
    const storageRef = ref(storage, fullPath);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  },

  getPublicUrl: (path) => {
    const storageRef = ref(storage, path);
    return getDownloadURL(storageRef);
  },
};

// ============ APP USERS (Owner: list/edit; create via Cloud Function) ============
export const appUsersService = {
  listByOwner: async () => {
    const ownerId = requireOwnerId();
    const role = getRoleSync();
    if (role !== "owner" && role !== "admin") throw new Error("Only Owner or Admin can list users");
    const q = query(
      collection(db, "app_users"),
      where("owner_uid", "==", ownerId),
      orderBy("created_at", "desc")
    );
    const snap = await getDocs(q);
    return fromFirestoreList(snap);
  },

  getByUid: async (uid) => {
    const snap = await getDoc(doc(db, "app_users", uid));
    return fromFirestore(snap);
  },

  update: async (uid, data) => {
    const ownerId = requireOwnerId();
    if (getRoleSync() !== "owner") throw new Error("Only Owner can update users");
    const d = doc(db, "app_users", uid);
    const snap = await getDoc(d);
    if (!snap.exists()) throw new Error("User not found");
    if (snap.data().owner_uid !== ownerId) throw new Error("Access denied");
    await updateDoc(d, { ...data, updated_at: serverTimestamp() });
  },

  // Create new Admin/Driver: Auth user (via secondary app) + Firestore app_users doc
  create: async (data) => {
    const ownerId = requireOwnerId();
    if (getRoleSync() !== "owner") throw new Error("Only Owner can create users");
    const { email, password, full_name, contact_number, role, status } = data;
    if (!email || !password || !role) throw new Error("Email, password, and role are required");

    // Use secondary app so owner stays signed in on primary app
    const cred = await createUserWithEmailAndPassword(authUserCreation, email, password);
    const newUid = cred.user.uid;
    await signOut(authUserCreation);

    await setDoc(doc(db, "app_users", newUid), {
      full_name: full_name || "",
      email,
      contact_number: contact_number || null,
      role,
      status: status || "active",
      owner_uid: ownerId,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    }, { merge: true });
    return { id: newUid };
  },
};

// ============ SYSTEM SETTINGS (Owner only; fuel price, delay fee) ============
export const systemSettingsService = {
  get: async () => {
    const ownerId = requireOwnerId();
    const snap = await getDoc(doc(db, "system_settings", ownerId));
    if (!snap.exists()) return { fuel_price_per_liter: 0, delay_fee_per_hour: 0 };
    return fromFirestore(snap);
  },

  upsert: async (data) => {
    const ownerId = requireOwnerId();
    if (getRoleSync() !== "owner") throw new Error("Only Owner can update system settings");
    await setDoc(
      doc(db, "system_settings", ownerId),
      { ...data, updated_at: serverTimestamp() },
      { merge: true }
    );
  },
};

// ============ DEBUG ============
export const debugConnectivity = async () => {
  const results = {};
  try {
    const res = await fetch("https://www.gstatic.com/generate_204", { method: "GET" });
    results.internet = res.ok;
  } catch (e) {
    results.internet = false;
    results.internetError = String(e?.message || e);
  }
  try {
    const user = auth.currentUser;
    results.authSession = !!user;
    if (!user) results.authSessionError = "Not logged in";
  } catch (e) {
    results.authSession = false;
    results.authSessionError = String(e?.message || e);
  }
  console.log("[ConnectivityDebug]", results);
  return results;
};
