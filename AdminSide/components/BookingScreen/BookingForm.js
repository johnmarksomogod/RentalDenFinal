import React, { useMemo, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Dropdown } from "react-native-element-dropdown";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { vehiclesService, variantsService, bookingsService, storageService } from "../../services/firebaseService";

// ─── Fuel helpers ─────────────────────────────────────────────────────────────
const FUEL_META = {
  gasoline:      { icon: "flame-outline",  color: "#f59e0b", bg: "#fef3c7" },
  diesel:        { icon: "water-outline",  color: "#0ea5e9", bg: "#e0f2fe" },
  electric:      { icon: "flash-outline",  color: "#3b82f6", bg: "#dbeafe" },
  hybrid:        { icon: "leaf-outline",   color: "#16a34a", bg: "#dcfce7" },
  plugin_hybrid: { icon: "leaf-outline",   color: "#059669", bg: "#d1fae5" },
  cng:           { icon: "cloud-outline",  color: "#8b5cf6", bg: "#ede9fe" },
  lpg:           { icon: "beaker-outline", color: "#f97316", bg: "#ffedd5" },
};

const getFuelMeta = (fuelType) => {
  if (!fuelType) return null;
  const f = fuelType.toLowerCase();
  if (f.includes("electric"))                         return FUEL_META.electric;
  if (f.includes("plug"))                             return FUEL_META.plugin_hybrid;
  if (f.includes("hybrid"))                           return FUEL_META.hybrid;
  if (f.includes("diesel"))                           return FUEL_META.diesel;
  if (f.includes("cng") || f.includes("compressed")) return FUEL_META.cng;
  if (f.includes("lpg") || f.includes("liquefied"))  return FUEL_META.lpg;
  return FUEL_META.gasoline;
};

// ─── Status config ─────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { label: "Pending",   value: "pending"   },
  { label: "Confirmed", value: "confirmed" },
  { label: "Ongoing",   value: "ongoing"   },
  { label: "Delivered", value: "delivered" },
  { label: "Retrieved", value: "retrieved" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Declined",  value: "declined"  },
];

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

// ─── Small reusable pieces ─────────────────────────────────────────────────────
const Section = ({ icon, title, children }) => (
  <View style={fs.section}>
    <View style={fs.sectionHeader}>
      <View style={fs.sectionIconWrap}>
        <Ionicons name={icon} size={16} color="#fff" />
      </View>
      <Text style={fs.sectionTitle}>{title}</Text>
    </View>
    {children}
  </View>
);

const Field = ({ label, hint, children }) => (
  <View style={fs.field}>
    <Text style={fs.fieldLabel}>{label}</Text>
    {children}
    {hint ? <Text style={fs.fieldHint}>{hint}</Text> : null}
  </View>
);

// ─── Main component ────────────────────────────────────────────────────────────
export default function BookingForm({
  booking,
  setBooking,
  styles: _parentStyles,
  formatDate,
  setDatePickerVisible,
  setDateField,
  isEdit = false,
}) {
  // ── Raw data ──────────────────────────────────────────────────────────────
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [allVehicles,     setAllVehicles]     = useState([]);
  const [allVariants,     setAllVariants]     = useState([]);
  const [rentedVariantIds, setRentedVariantIds] = useState(new Set());

  // ── Full detail doc for selected vehicle ──────────────────────────────────
  const [vehicleDetails, setVehicleDetails] = useState(null);

  // ── Image upload ──────────────────────────────────────────────────────────
  const [uploadingImage, setUploadingImage] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 — Fetch all vehicles + variants + today's bookings on mount.
  //          This is the SAME availability logic used in VehiclesScreen and
  //          the website's FleetSection / HeroSection.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingVehicles(true);
        const [vehicles, variants, bookings] = await Promise.all([
          vehiclesService.list(),
          variantsService.list(),
          bookingsService.list(),
        ]);
        if (!alive) return;

        // Build set of variant IDs that are rented right now
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const busy = new Set();
        (bookings || []).forEach((b) => {
          if (b.status !== "confirmed") return;
          const s = new Date(b.rental_start_date); s.setHours(0, 0, 0, 0);
          const e = new Date(b.rental_end_date);   e.setHours(23, 59, 59, 999);
          if (s <= today && e >= today && b.vehicle_variant_id) {
            busy.add(b.vehicle_variant_id);
          }
        });

        setAllVehicles(vehicles  || []);
        setAllVariants(variants  || []);
        setRentedVariantIds(busy);
      } catch (err) {
        console.error("BookingForm fetchData error:", err);
      } finally {
        if (alive) setLoadingVehicles(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 2 — Load full vehicle doc when selection changes
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!booking?.vehicle_id) { setVehicleDetails(null); return; }
    vehiclesService.getById(booking.vehicle_id)
      .then((d) => setVehicleDetails(d || null))
      .catch(console.error);
  }, [booking?.vehicle_id]);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3 — Auto-calculate price (add-mode only)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isEdit || !booking?.rental_start_date || !booking?.rental_end_date) return;
    const ppd = vehicleDetails?.price_per_day;
    if (!ppd) return;
    const start = new Date(booking.rental_start_date);
    const end   = new Date(booking.rental_end_date);
    if (end <= start) return;
    const days = Math.ceil(Math.abs(end - start) / 86400000);
    if (days > 0) {
      updateBooking((p) => ({
        ...p,
        total_price: (days * ppd).toString(),
        rental_days: days,
      }));
    }
  }, [booking?.rental_start_date, booking?.rental_end_date, vehicleDetails?.price_per_day, isEdit]);

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED: available vehicle list for dropdown
  //   • A vehicle is available when it has ≥1 variant that is
  //     not in maintenance (is_available !== false) AND
  //     not currently rented (id not in rentedVariantIds)
  //   • In edit-mode we show ALL vehicles so admin can switch
  // ─────────────────────────────────────────────────────────────────────────
  const vehicleDropdownList = useMemo(() => {
    if (isEdit) return allVehicles;

    // Group variants by vehicle
    const varsByVehicle = {};
    allVariants.forEach((v) => {
      if (!varsByVehicle[v.vehicle_id]) varsByVehicle[v.vehicle_id] = [];
      varsByVehicle[v.vehicle_id].push(v);
    });

    return allVehicles.filter((vehicle) => {
      const vvs = varsByVehicle[vehicle.id] || [];
      // At least one variant that is available & not rented today
      return vvs.some(
        (v) => v.is_available !== false && !rentedVariantIds.has(v.id)
      );
    });
  }, [allVehicles, allVariants, rentedVariantIds, isEdit]);

  // ─────────────────────────────────────────────────────────────────────────
  // DERIVED: color/variant list for the selected vehicle
  //   • Add-mode: only available (not maintenance, not rented)
  //   • Edit-mode: all variants, but mark unavailable ones
  // ─────────────────────────────────────────────────────────────────────────
  const variantDropdownList = useMemo(() => {
    if (!booking?.vehicle_id) return [];
    return allVariants
      .filter((v) => v.vehicle_id === booking.vehicle_id)
      .map((v) => {
        const isAvailable = v.is_available !== false && !rentedVariantIds.has(v.id);
        return {
          label: [
            v.color,
            v.plate_number || null,
            `${v.available_quantity ?? 0}/${v.total_quantity ?? 0} avail`,
          ].filter(Boolean).join(" · "),
          value: v.id,
          color: v.color,
          plate_number: v.plate_number,
          available: v.available_quantity ?? 0,
          total: v.total_quantity ?? 0,
          isAvailable,
          price_per_day: v.price_per_day,
          image_url: v.image_url,
        };
      })
      .filter((v) => isEdit || v.isAvailable);
  }, [allVariants, booking?.vehicle_id, rentedVariantIds, isEdit]);

  const selectedVariant = variantDropdownList.find(
    (v) => v.value === booking?.vehicle_variant_id
  ) || null;

  // ─────────────────────────────────────────────────────────────────────────
  // Prices
  // ─────────────────────────────────────────────────────────────────────────
  const rentalDays = useMemo(() => {
    if (!booking?.rental_start_date || !booking?.rental_end_date) return 0;
    const s = new Date(booking.rental_start_date);
    const e = new Date(booking.rental_end_date);
    return e > s ? Math.ceil(Math.abs(e - s) / 86400000) : 0;
  }, [booking?.rental_start_date, booking?.rental_end_date]);

  const pricePerDay   = selectedVariant?.price_per_day || vehicleDetails?.price_per_day || 0;
  const depositAmount = Number(vehicleDetails?.deposit_amount || 0);
  const baseTotal     = rentalDays * pricePerDay;

  // ─────────────────────────────────────────────────────────────────────────
  // Image upload
  // ─────────────────────────────────────────────────────────────────────────
  const uploadImage = async (uri) => {
    let pUri = uri;
    if (uri.toLowerCase().endsWith(".heic")) {
      const r = await ImageManipulator.manipulateAsync(uri, [], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
      pUri = r.uri;
    } else {
      const r = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1024 } }], { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG });
      pUri = r.uri;
    }
    const ext  = (pUri.split(".").pop()?.toLowerCase() || "jpg").replace("heic", "jpg");
    const name = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const blob = await (await fetch(pUri)).blob();
    return storageService.uploadGovId(name, blob);
  };

  const pickGovId = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission Required", "Grant camera roll access to upload an ID."); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7, aspect: [4, 3] });
    if (r.canceled || !r.assets?.[0]) return;
    setUploadingImage(true);
    try {
      const url = await uploadImage(r.assets[0].uri);
      if (url) updateBooking((p) => ({ ...p, gov_id_url: url }));
    } catch (e) {
      Alert.alert("Upload Failed", "Could not upload the image. Please try again.");
    } finally {
      setUploadingImage(false);
    }
  };

  const updateBooking = (fn) => typeof setBooking === "function" && setBooking(fn);

  const formatSignedAt = (v) =>
    !v ? "" : new Date(v).toLocaleString(undefined, { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" });

  if (!booking) {
    return <View style={fs.section}><Text style={{ color: "#9ca3af", textAlign: "center" }}>No booking data.</Text></View>;
  }

  const fuelMeta    = getFuelMeta(vehicleDetails?.fuel_type);
  const statusColor = STATUS_COLORS[booking.status] || "#6b7280";

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View>

      {/* ─── Vehicle Preview Card ─────────────────────────────────────────── */}
      {booking.vehicle_id && vehicleDetails && (
        <View style={fs.vehicleCard}>
          {vehicleDetails.image_url ? (
            <Image source={{ uri: vehicleDetails.image_url }} style={fs.vehicleCardImg} resizeMode="contain" />
          ) : (
            <View style={[fs.vehicleCardImg, fs.vehicleCardImgEmpty]}>
              <Ionicons name="car-outline" size={32} color="#6b7280" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={fs.vehicleCardName}>
              {vehicleDetails.year} {vehicleDetails.make} {vehicleDetails.model}
            </Text>
            <View style={fs.vehicleCardBadges}>
              {vehicleDetails.seats ? (
                <View style={fs.badge}>
                  <Ionicons name="people-outline" size={11} color="#374151" />
                  <Text style={fs.badgeTxt}>{vehicleDetails.seats} seats</Text>
                </View>
              ) : null}
              {fuelMeta && vehicleDetails.fuel_type ? (
                <View style={[fs.badge, { backgroundColor: fuelMeta.bg }]}>
                  <Ionicons name={fuelMeta.icon} size={11} color={fuelMeta.color} />
                  <Text style={[fs.badgeTxt, { color: fuelMeta.color }]}>{vehicleDetails.fuel_type}</Text>
                </View>
              ) : null}
            </View>
            <Text style={fs.vehicleCardPrice}>
              ₱{Number(pricePerDay).toLocaleString("en-PH")}
              <Text style={fs.vehicleCardPriceUnit}>/day</Text>
            </Text>
            {depositAmount > 0 ? (
              <View style={fs.depositRow}>
                <Ionicons name="shield-outline" size={11} color="#fbbf24" />
                <Text style={fs.depositRowTxt}>₱{depositAmount.toLocaleString("en-PH")} deposit (refundable)</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* ─── 1. Customer Information ──────────────────────────────────────── */}
      <Section icon="person-circle-outline" title="Customer Information">
        <Field label="Customer Name *">
          <TextInput style={fs.input} value={booking.customer_name || ""} onChangeText={(t) => updateBooking((p) => ({ ...p, customer_name: t }))} placeholder="Enter customer name" autoCapitalize="words" placeholderTextColor="#9ca3af" />
        </Field>
        <View style={fs.row}>
          <View style={fs.half}>
            <Field label="Email *">
              <TextInput style={fs.input} value={booking.customer_email || ""} onChangeText={(t) => updateBooking((p) => ({ ...p, customer_email: t }))} keyboardType="email-address" placeholder="email@example.com" autoCapitalize="none" placeholderTextColor="#9ca3af" />
            </Field>
          </View>
          <View style={fs.half}>
            <Field label="Phone">
              <TextInput style={fs.input} value={booking.customer_phone || ""} onChangeText={(t) => updateBooking((p) => ({ ...p, customer_phone: t }))} keyboardType="phone-pad" placeholder="+63 XXX XXX XXXX" placeholderTextColor="#9ca3af" />
            </Field>
          </View>
        </View>
        <Field label="License Number">
          <TextInput style={fs.input} value={booking.license_number || ""} onChangeText={(t) => updateBooking((p) => ({ ...p, license_number: t }))} placeholder="Enter license number" autoCapitalize="characters" placeholderTextColor="#9ca3af" />
        </Field>
      </Section>

      {/* ─── 2. Vehicle Selection ─────────────────────────────────────────── */}
      <Section icon="car-outline" title="Vehicle Selection">
        {loadingVehicles ? (
          <View style={fs.loadingRow}>
            <ActivityIndicator size="small" color="#111827" />
            <Text style={fs.loadingTxt}>Loading available vehicles…</Text>
          </View>
        ) : (
          <>
            {/* Green banner: how many are available today */}
            {!isEdit && (
              <View style={fs.availBanner}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#166534" />
                <Text style={fs.availBannerTxt}>
                  {vehicleDropdownList.length} vehicle{vehicleDropdownList.length !== 1 ? "s" : ""} available to book today
                </Text>
              </View>
            )}

            {/* Vehicle dropdown */}
            <Field label={isEdit ? "Vehicle" : "Select Available Vehicle"}>
              <Dropdown
                style={fs.input}
                data={vehicleDropdownList.map((v) => ({
                  label: `${v.year} ${v.make} ${v.model}`,
                  sublabel: `₱${Number(v.price_per_day || 0).toLocaleString("en-PH")}/day`,
                  value: v.id,
                  fuel_type: v.fuel_type,
                  seats: v.seats,
                }))}
                labelField="label"
                valueField="value"
                placeholder={
                  vehicleDropdownList.length === 0
                    ? "No vehicles available today"
                    : "Choose a vehicle"
                }
                value={booking.vehicle_id}
                search
                searchPlaceholder="Search vehicles…"
                maxHeight={320}
                placeholderStyle={{ color: "#9ca3af", fontSize: 14 }}
                selectedTextStyle={{ color: "#111827", fontSize: 14, fontWeight: "600" }}
                onChange={(item) =>
                  updateBooking((p) => ({
                    ...p,
                    vehicle_id: item.value,
                    vehicle_variant_id: null,
                  }))
                }
                renderItem={(item, selected) => {
                  const fm = getFuelMeta(item.fuel_type);
                  return (
                    <View style={[fs.ddItem, selected && fs.ddItemSel]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[fs.ddLabel, selected && { fontWeight: "700", color: "#111827" }]}>{item.label}</Text>
                        <Text style={fs.ddSub}>{item.sublabel}{item.seats ? ` · ${item.seats} seats` : ""}</Text>
                      </View>
                      {fm && item.fuel_type ? (
                        <View style={[fs.badge, { backgroundColor: fm.bg }]}>
                          <Ionicons name={fm.icon} size={10} color={fm.color} />
                          <Text style={[fs.badgeTxt, { color: fm.color, fontSize: 10 }]}>{item.fuel_type}</Text>
                        </View>
                      ) : null}
                      {selected ? <Ionicons name="checkmark-circle" size={18} color="#111827" style={{ marginLeft: 6 }} /> : null}
                    </View>
                  );
                }}
              />
            </Field>

            {/* Color / variant dropdown */}
            {booking.vehicle_id && variantDropdownList.length > 0 && (
              <Field label="Select Color & Variant">
                <Dropdown
                  style={fs.input}
                  data={variantDropdownList}
                  labelField="label"
                  valueField="value"
                  placeholder="Choose a color variant"
                  value={booking.vehicle_variant_id}
                  maxHeight={300}
                  placeholderStyle={{ color: "#9ca3af", fontSize: 14 }}
                  selectedTextStyle={{ color: "#111827", fontSize: 14, fontWeight: "600" }}
                  onChange={(item) => updateBooking((p) => ({ ...p, vehicle_variant_id: item.value }))}
                  renderItem={(item, selected) => (
                    <View style={[fs.ddItem, selected && fs.ddItemSel, !item.isAvailable && fs.ddItemNA]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[fs.ddLabel, selected && { fontWeight: "700" }, !item.isAvailable && { color: "#9ca3af" }]}>
                          {item.color}
                        </Text>
                        {item.plate_number ? <Text style={fs.ddSub}>{item.plate_number}</Text> : null}
                        <Text style={[fs.ddSub, !item.isAvailable && { color: "#ef4444" }]}>
                          {item.available}/{item.total} available
                        </Text>
                      </View>
                      {!item.isAvailable ? (
                        <View style={fs.naPill}><Text style={fs.naPillTxt}>Unavailable</Text></View>
                      ) : selected ? (
                        <Ionicons name="checkmark-circle" size={18} color="#111827" />
                      ) : null}
                    </View>
                  )}
                />
              </Field>
            )}

            {/* No variants warning */}
            {booking.vehicle_id && !loadingVehicles && variantDropdownList.length === 0 && (
              <View style={[fs.infoBox, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
                <Ionicons name="warning-outline" size={16} color="#ef4444" />
                <Text style={[fs.infoBoxTxt, { color: "#dc2626" }]}>
                  No available variants for this vehicle today. All units are rented or under maintenance.
                </Text>
              </View>
            )}

            {/* Selected variant chip */}
            {selectedVariant ? (
              <View style={fs.variantChip}>
                <Ionicons name="color-palette-outline" size={13} color="#166534" />
                <Text style={fs.variantChipTxt}>
                  {selectedVariant.color}
                  {selectedVariant.plate_number ? ` · ${selectedVariant.plate_number}` : ""}
                  {" · "}{selectedVariant.available}/{selectedVariant.total} available
                </Text>
                <View style={fs.greenDot} />
              </View>
            ) : null}
          </>
        )}
      </Section>

      {/* ─── 3. Rental Period ─────────────────────────────────────────────── */}
      <Section icon="calendar-outline" title="Rental Period">
        <View style={fs.row}>
          <View style={fs.half}>
            <Field label="Start Date">
              <TouchableOpacity style={[fs.input, fs.dateBtn]} onPress={() => { setDatePickerVisible?.(true); setDateField?.("start"); }}>
                <Text style={[fs.dateTxt, !booking.rental_start_date && { color: "#9ca3af" }]}>
                  {booking.rental_start_date ? formatDate(booking.rental_start_date) : "Select date"}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#6b7280" />
              </TouchableOpacity>
            </Field>
          </View>
          <View style={fs.half}>
            <Field label="End Date">
              <TouchableOpacity
                style={[fs.input, fs.dateBtn, !booking.rental_start_date && { opacity: 0.5 }]}
                onPress={() => {
                  if (!booking.rental_start_date) { Alert.alert("Select Start Date", "Please select a start date first."); return; }
                  setDatePickerVisible?.(true); setDateField?.("end");
                }}
                disabled={!booking.rental_start_date}
              >
                <Text style={[fs.dateTxt, !booking.rental_end_date && { color: "#9ca3af" }]}>
                  {booking.rental_end_date ? formatDate(booking.rental_end_date) : "Select date"}
                </Text>
                <Ionicons name="calendar-outline" size={16} color="#6b7280" />
              </TouchableOpacity>
            </Field>
          </View>
        </View>

        {/* Dark pricing summary */}
        {rentalDays > 0 && pricePerDay > 0 && (
          <View style={fs.priceBox}>
            <View style={fs.priceBoxHeader}>
              <Ionicons name="receipt-outline" size={14} color="#9ca3af" />
              <Text style={fs.priceBoxTitle}>PRICING SUMMARY</Text>
            </View>
            <View style={fs.priceRow}>
              <Text style={fs.priceRowLbl}>₱{Number(pricePerDay).toLocaleString("en-PH")}/day × {rentalDays} {rentalDays === 1 ? "day" : "days"}</Text>
              <Text style={fs.priceRowVal}>₱{baseTotal.toLocaleString("en-PH")}</Text>
            </View>
            {depositAmount > 0 && (
              <View style={fs.priceRow}>
                <Text style={fs.priceRowLbl}>Security Deposit (refundable)</Text>
                <Text style={[fs.priceRowVal, { color: "#fbbf24" }]}>₱{depositAmount.toLocaleString("en-PH")}</Text>
              </View>
            )}
            {booking.delivery_option === "deliver" && (
              <View style={fs.priceRow}>
                <Text style={fs.priceRowLbl}>Delivery Fee</Text>
                <Text style={[fs.priceRowVal, { color: "#60a5fa" }]}>Charged on delivery</Text>
              </View>
            )}
            <View style={fs.priceTotalRow}>
              <Text style={fs.priceTotalLbl}>Rental Total</Text>
              <Text style={fs.priceTotalVal}>₱{baseTotal.toLocaleString("en-PH")}</Text>
            </View>
            {depositAmount > 0 && (
              <Text style={fs.priceNote}>* Plus ₱{depositAmount.toLocaleString("en-PH")} refundable deposit</Text>
            )}
          </View>
        )}

        {isEdit && (
          <Field label="Total Price (₱)" hint="Override the auto-calculated price if needed.">
            <TextInput style={fs.input} value={booking.total_price?.toString() || ""} onChangeText={(t) => updateBooking((p) => ({ ...p, total_price: t }))} keyboardType="numeric" placeholder="Enter total price" placeholderTextColor="#9ca3af" />
          </Field>
        )}
      </Section>

      {/* ─── 4. Pickup or Delivery ────────────────────────────────────────── */}
      <Section icon="location-outline" title="Pickup or Delivery">
        <Text style={fs.sectionSub}>Choose how the customer receives the vehicle.</Text>
        <View style={fs.deliveryRow}>
          {/* Self-pickup */}
          <TouchableOpacity style={[fs.deliveryOpt, booking.delivery_option !== "deliver" && fs.deliveryOptSel]} onPress={() => updateBooking((p) => ({ ...p, delivery_option: "pickup", delivery_address: "" }))} activeOpacity={0.8}>
            <View style={[fs.radio, booking.delivery_option !== "deliver" && fs.radioSel]}>
              {booking.delivery_option !== "deliver" && <View style={fs.radioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={fs.deliveryTitle}>🏠 Self-Pickup</Text>
              <Text style={fs.deliveryDesc}>Customer picks up at the owner's garage</Text>
            </View>
          </TouchableOpacity>
          {/* Delivery */}
          <TouchableOpacity style={[fs.deliveryOpt, booking.delivery_option === "deliver" && fs.deliveryOptSel]} onPress={() => updateBooking((p) => ({ ...p, delivery_option: "deliver", pickup_location: "" }))} activeOpacity={0.8}>
            <View style={[fs.radio, booking.delivery_option === "deliver" && fs.radioSel]}>
              {booking.delivery_option === "deliver" && <View style={fs.radioDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={fs.deliveryTitle}>🚗 Delivery</Text>
              <Text style={fs.deliveryDesc}>Driver delivers the car to customer's address</Text>
            </View>
          </TouchableOpacity>
        </View>

        {booking.delivery_option !== "deliver" ? (
          <>
            <View style={fs.infoBox}>
              <Ionicons name="notifications-outline" size={16} color="#d97706" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={fs.infoBoxTitle}>Pickup location sent after approval</Text>
                <Text style={fs.infoBoxTxt}>The garage address will be shared with the customer once the booking is confirmed.</Text>
              </View>
            </View>
            <Field label="Pickup Location (optional note)">
              <TextInput style={fs.input} value={booking.pickup_location || ""} onChangeText={(t) => updateBooking((p) => ({ ...p, pickup_location: t }))} placeholder="e.g. Owner's garage address, landmark…" placeholderTextColor="#9ca3af" />
            </Field>
          </>
        ) : (
          <>
            <View style={[fs.infoBox, fs.infoBoxBlue]}>
              <Ionicons name="information-circle-outline" size={16} color="#2563eb" style={{ marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <Text style={[fs.infoBoxTitle, { color: "#1e40af" }]}>Delivery fee charged on arrival</Text>
                <Text style={[fs.infoBoxTxt, { color: "#1e40af" }]}>Fee is based on distance from the owner's garage to the delivery address.</Text>
              </View>
            </View>
            <Field label="Delivery Address *">
              <TextInput style={[fs.input, { minHeight: 80, textAlignVertical: "top" }]} value={booking.delivery_address || ""} onChangeText={(t) => updateBooking((p) => ({ ...p, delivery_address: t }))} placeholder="Enter the complete delivery address" multiline numberOfLines={3} placeholderTextColor="#9ca3af" />
            </Field>
          </>
        )}
      </Section>

      {/* ─── 5. Identity Verification ─────────────────────────────────────── */}
      <Section icon="id-card-outline" title="Identity Verification">
        <Field label="Driver's License Card">
          <TouchableOpacity style={[fs.uploadBtn, uploadingImage && { backgroundColor: "#6b7280" }]} onPress={pickGovId} disabled={uploadingImage}>
            <Ionicons name={uploadingImage ? "cloud-upload" : "cloud-upload-outline"} size={16} color="#fff" />
            <Text style={fs.uploadBtnTxt}>
              {uploadingImage ? "Uploading…" : booking.gov_id_url ? "Change Driver's License Card" : "Upload Driver's License Card"}
            </Text>
          </TouchableOpacity>
          {booking.gov_id_url && (
            <View style={fs.idWrap}>
              <Image key={booking.gov_id_url} source={{ uri: booking.gov_id_url }} style={fs.idImg} resizeMode="cover" />
              <View style={fs.idOverlay}>
                <Text style={fs.idOverlayLbl}>Driver's License Preview</Text>
                <TouchableOpacity style={fs.idDeleteBtn} onPress={() => updateBooking((p) => ({ ...p, gov_id_url: "" }))}>
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Field>
      </Section>

      {/* ─── 6. Booking Status (edit only) ───────────────────────────────── */}
      {isEdit && (
        <Section icon="swap-vertical-outline" title="Booking Status">
          <Field label="Status">
            <Dropdown
              style={fs.input}
              data={STATUS_OPTIONS}
              labelField="label"
              valueField="value"
              placeholder="Select status"
              value={booking.status}
              placeholderStyle={{ color: "#9ca3af", fontSize: 14 }}
              selectedTextStyle={{ color: statusColor, fontSize: 14, fontWeight: "700" }}
              onChange={(item) => updateBooking((p) => ({ ...p, status: item.value, decline_reason: item.value !== "declined" ? "" : p.decline_reason }))}
              renderItem={(item, selected) => (
                <View style={[fs.ddItem, selected && fs.ddItemSel]}>
                  <View style={[fs.statusDot, { backgroundColor: STATUS_COLORS[item.value] || "#6b7280" }]} />
                  <Text style={[fs.ddLabel, { color: STATUS_COLORS[item.value] || "#374151" }, selected && { fontWeight: "700" }]}>{item.label}</Text>
                  {selected && <Ionicons name="checkmark" size={16} color={STATUS_COLORS[item.value] || "#374151"} />}
                </View>
              )}
            />
          </Field>
          {booking.status === "declined" && (
            <Field label="Decline Reason *" hint="This reason will be included in the email notification to the customer.">
              <TextInput style={[fs.input, { minHeight: 80, textAlignVertical: "top" }]} value={booking.decline_reason || ""} onChangeText={(t) => updateBooking((p) => ({ ...p, decline_reason: t }))} placeholder="Please provide a reason for declining this booking…" multiline numberOfLines={3} placeholderTextColor="#9ca3af" />
            </Field>
          )}
        </Section>
      )}

      {/* ─── 7. Signed Contract (read-only) ──────────────────────────────── */}
      {booking.contract_text?.trim()?.length > 0 && (
        <Section icon="document-text-outline" title="Signed Contract">
          <View style={fs.contractCard}>
            {booking.contract_text.split(/\n{2,}/).map((para, i) => (
              <Text key={i} style={fs.contractPara}>{para}</Text>
            ))}
            <View style={fs.contractMeta}>
              <Text style={fs.contractMetaLbl}>
                Signed by <Text style={fs.contractMetaName}>{booking.contract_signed_name || "Customer"}</Text>
              </Text>
              {booking.contract_signed_at && <Text style={fs.contractMetaDate}>{formatSignedAt(booking.contract_signed_at)}</Text>}
            </View>
          </View>
        </Section>
      )}

    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const fs = StyleSheet.create({
  section:        { backgroundColor: "#fff", borderRadius: 16, marginBottom: 14, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3 },
  sectionHeader:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  sectionIconWrap:{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#111827", justifyContent: "center", alignItems: "center" },
  sectionTitle:   { fontSize: 15, fontWeight: "700", color: "#111827" },
  sectionSub:     { fontSize: 13, color: "#6b7280", marginBottom: 12, marginTop: -6 },

  field:      { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: "#374151", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  fieldHint:  { fontSize: 11, color: "#9ca3af", marginTop: 5, fontStyle: "italic" },

  input:   { backgroundColor: "#f9fafb", borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: "#111827" },
  row:     { flexDirection: "row", gap: 10 },
  half:    { flex: 1 },

  dateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dateTxt: { fontSize: 14, color: "#111827", flex: 1 },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 16, justifyContent: "center" },
  loadingTxt: { fontSize: 13, color: "#6b7280" },

  availBanner:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 10, borderWidth: 1, borderColor: "#bbf7d0" },
  availBannerTxt: { fontSize: 12, color: "#166534", fontWeight: "600" },

  vehicleCard:       { backgroundColor: "#111827", borderRadius: 16, marginBottom: 14, padding: 16, flexDirection: "row", gap: 14, alignItems: "center" },
  vehicleCardImg:    { width: 100, height: 70, borderRadius: 10 },
  vehicleCardImgEmpty:{ backgroundColor: "#1f2937", justifyContent: "center", alignItems: "center" },
  vehicleCardName:   { fontSize: 15, fontWeight: "700", color: "#fff", marginBottom: 6 },
  vehicleCardBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  vehicleCardPrice:  { fontSize: 20, fontWeight: "900", color: "#fff" },
  vehicleCardPriceUnit:{ fontSize: 12, fontWeight: "400", color: "#9ca3af" },
  depositRow:        { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(251,191,36,0.15)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4, marginTop: 6, alignSelf: "flex-start" },
  depositRowTxt:     { fontSize: 11, color: "#fbbf24", fontWeight: "600" },

  badge:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f3f4f6", borderRadius: 20, paddingHorizontal: 7, paddingVertical: 3 },
  badgeTxt: { fontSize: 11, color: "#374151", fontWeight: "600" },

  ddItem:  { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  ddItemSel:{ backgroundColor: "#f0f9ff" },
  ddItemNA: { backgroundColor: "#fef2f2", opacity: 0.7 },
  ddLabel:  { fontSize: 14, color: "#374151", fontWeight: "500" },
  ddSub:    { fontSize: 12, color: "#6b7280", marginTop: 2 },
  statusDot:{ width: 8, height: 8, borderRadius: 4 },

  naPill:    { backgroundColor: "#fee2e2", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  naPillTxt: { fontSize: 10, color: "#ef4444", fontWeight: "700", textTransform: "uppercase" },

  variantChip:    { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f0fdf4", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, marginTop: -4, marginBottom: 6, borderWidth: 1, borderColor: "#bbf7d0" },
  variantChipTxt: { fontSize: 13, color: "#166534", fontWeight: "600", flex: 1 },
  greenDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10b981" },

  priceBox:       { backgroundColor: "#111827", borderRadius: 14, padding: 16, marginTop: 4 },
  priceBoxHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  priceBoxTitle:  { fontSize: 11, fontWeight: "700", color: "#9ca3af", letterSpacing: 0.8 },
  priceRow:       { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  priceRowLbl:    { fontSize: 13, color: "#9ca3af" },
  priceRowVal:    { fontSize: 13, fontWeight: "600", color: "#fff" },
  priceTotalRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#374151", paddingTop: 10, marginTop: 6 },
  priceTotalLbl:  { fontSize: 14, fontWeight: "600", color: "#fff" },
  priceTotalVal:  { fontSize: 22, fontWeight: "900", color: "#fff" },
  priceNote:      { fontSize: 11, color: "#6b7280", marginTop: 6, fontStyle: "italic" },

  deliveryRow:    { flexDirection: "row", gap: 10, marginBottom: 12 },
  deliveryOpt:    { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 2, borderColor: "#e5e7eb", borderRadius: 12, padding: 12, backgroundColor: "#f9fafb" },
  deliveryOptSel: { borderColor: "#111827", backgroundColor: "#f3f4f6" },
  radio:          { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "#d1d5db", justifyContent: "center", alignItems: "center", marginTop: 2, flexShrink: 0 },
  radioSel:       { borderColor: "#111827" },
  radioDot:       { width: 9, height: 9, borderRadius: 4.5, backgroundColor: "#111827" },
  deliveryTitle:  { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 2 },
  deliveryDesc:   { fontSize: 11, color: "#6b7280" },

  infoBox:      { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 12, padding: 12, marginBottom: 12 },
  infoBoxBlue:  { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  infoBoxTitle: { fontSize: 13, fontWeight: "700", color: "#92400e", marginBottom: 2 },
  infoBoxTxt:   { fontSize: 12, color: "#92400e", lineHeight: 17 },

  uploadBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#111827", borderRadius: 10, paddingVertical: 13, paddingHorizontal: 18 },
  uploadBtnTxt: { fontSize: 14, color: "#fff", fontWeight: "600" },

  idWrap:       { marginTop: 12, borderRadius: 12, overflow: "hidden", backgroundColor: "#f3f4f6" },
  idImg:        { width: "100%", height: 130 },
  idOverlay:    { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.7)", paddingVertical: 8, paddingHorizontal: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  idOverlayLbl: { color: "#fff", fontSize: 12, fontWeight: "500" },
  idDeleteBtn:  { padding: 4, borderRadius: 4, backgroundColor: "rgba(239,68,68,0.25)" },

  contractCard: { backgroundColor: "#f9fafb", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#e5e7eb" },
  contractPara: { fontSize: 13, color: "#374151", lineHeight: 20, marginBottom: 10 },
  contractMeta: { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 10, marginTop: 4 },
  contractMetaLbl:  { fontSize: 12, color: "#6b7280" },
  contractMetaName: { fontWeight: "700", color: "#111827" },
  contractMetaDate: { fontSize: 11, color: "#9ca3af", marginTop: 3 },
});