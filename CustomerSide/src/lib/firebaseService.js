/**
 * Firebase service for CustomerSide (public-facing website)
 * Fetches vehicles for the catalog. Optionally filter by business (VITE_OWNER_ID).
 * Bookings are created with owner's user_id so each business sees only their bookings in AdminSide.
 */
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const OWNER_ID = import.meta.env?.VITE_OWNER_ID || null;

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

const fromFirestoreList = (snapshot) => snapshot.docs.map((d) => fromFirestore(d));

export const getVehicleById = async (id) => {
  if (!id) return null;
  const snap = await getDoc(doc(db, "vehicles", id));
  return fromFirestore(snap);
};

// Public: list vehicles (optionally filter by owner for multi-tenant)
export const listVehicles = async () => {
  let q;
  if (OWNER_ID) {
    q = query(
      collection(db, "vehicles"),
      where("user_id", "==", OWNER_ID),
      orderBy("created_at", "desc")
    );
  } else {
    q = query(
      collection(db, "vehicles"),
      orderBy("created_at", "desc")
    );
  }
  const snap = await getDocs(q);
  return fromFirestoreList(snap);
};

// Public: list all variants (for stats)
export const listAllVariants = async () => {
  let q;
  if (OWNER_ID) {
    q = query(
      collection(db, "vehicle_variants"),
      where("user_id", "==", OWNER_ID)
    );
  } else {
    q = query(collection(db, "vehicle_variants"));
  }
  const snap = await getDocs(q);
  return fromFirestoreList(snap);
};

// Public: list variants for a vehicle
export const listVariantsByVehicleId = async (vehicleId) => {
  let q;
  if (OWNER_ID) {
    q = query(
      collection(db, "vehicle_variants"),
      where("vehicle_id", "==", vehicleId),
      where("user_id", "==", OWNER_ID)
    );
  } else {
    q = query(
      collection(db, "vehicle_variants"),
      where("vehicle_id", "==", vehicleId)
    );
  }
  const snap = await getDocs(q);
  return fromFirestoreList(snap);
};

// Public: list confirmed bookings for a variant (booked dates)
export const listBookingsByVariantId = async (variantId) => {
  let q;
  if (OWNER_ID) {
    q = query(
      collection(db, "bookings"),
      where("user_id", "==", OWNER_ID),
      where("vehicle_variant_id", "==", variantId),
      where("status", "==", "confirmed")
    );
  } else {
    q = query(
      collection(db, "bookings"),
      where("vehicle_variant_id", "==", variantId),
      where("status", "==", "confirmed")
    );
  }
  const snap = await getDocs(q);
  return fromFirestoreList(snap);
};

// Public: list confirmed bookings for availability check
export const listConfirmedBookings = async () => {
  let q;
  if (OWNER_ID) {
    q = query(
      collection(db, "bookings"),
      where("user_id", "==", OWNER_ID),
      where("status", "==", "confirmed")
    );
  } else {
    q = query(
      collection(db, "bookings"),
      where("status", "==", "confirmed")
    );
  }
  const snap = await getDocs(q);
  return fromFirestoreList(snap);
};

// Public: get website content by section
export const getWebsiteContent = async (section) => {
  let q;
  if (OWNER_ID) {
    q = query(
      collection(db, "website_content"),
      where("user_id", "==", OWNER_ID),
      where("section", "==", section)
    );
  } else {
    q = query(
      collection(db, "website_content"),
      where("section", "==", section)
    );
  }
  const snap = await getDocs(q);
  const list = fromFirestoreList(snap);
  return list[0] || null;
};

// Public: list gallery images
export const listGalleryImages = async () => {
  let q;
  if (OWNER_ID) {
    q = query(
      collection(db, "gallery_images"),
      where("user_id", "==", OWNER_ID),
      where("is_active", "==", true)
    );
  } else {
    q = query(
      collection(db, "gallery_images"),
      where("is_active", "==", true)
    );
  }
  const snap = await getDocs(q);
  return fromFirestoreList(snap);
};

// Create booking (customer-facing) - need owner user_id from vehicle
export const createBooking = async (bookingData, ownerUserId) => {
  const ref = await addDoc(collection(db, "bookings"), {
    ...toFirestore(bookingData),
    user_id: ownerUserId,
    created_at: serverTimestamp(),
  });
  return { id: ref.id };
};

// Upload gov ID
export const uploadGovId = async (fileName, blob) => {
  const path = `gov_ids/${Date.now()}_${fileName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
};
