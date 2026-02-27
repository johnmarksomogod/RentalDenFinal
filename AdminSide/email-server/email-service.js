import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 80;

app.use(cors());
app.use(express.json());

// ─── Transporter ──────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (v) =>
  `₱${parseFloat(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const fmtDate = (d) =>
  !d
    ? "—"
    : new Date(d).toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

const fmtDateTime = (d) =>
  !d
    ? "—"
    : new Date(d).toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

// Safe string — prevents undefined/null from leaking into HTML
const safe = (v, fallback = "—") =>
  v !== null && v !== undefined && String(v).trim() !== ""
    ? String(v)
    : fallback;

// ─── Status metadata ──────────────────────────────────────────────────────────
const STATUS_META = {
  pending: {
    color: "#f59e0b",
    bg: "#fffbeb",
    icon: "⏳",
    title: "Booking Received – Under Review",
    headline: "We've received your booking!",
    message:
      "Our team is reviewing your request and will confirm it shortly. You'll receive another email once it's been confirmed.",
  },
  confirmed: {
    color: "#3b82f6",
    bg: "#eff6ff",
    icon: "✅",
    title: "Booking Confirmed",
    headline: "Your booking is confirmed!",
    message:
      "Great news! Your vehicle has been reserved and a driver will be assigned to handle your rental.",
  },
  ongoing: {
    color: "#8b5cf6",
    bg: "#f5f3ff",
    icon: "🚗",
    title: "Your Rental is Now Ongoing",
    headline: "Your rental is underway!",
    message:
      "Your vehicle is now on its way. Please be ready at the delivery address. Ensure your balance and security deposit are prepared.",
  },
  delivered: {
    color: "#ec4899",
    bg: "#fdf2f8",
    icon: "📦",
    title: "Vehicle Delivered",
    headline: "Vehicle has been delivered!",
    message:
      "Your vehicle has been successfully delivered. Please review the payment summary below. Drive safely and enjoy your rental!",
  },
  retrieved: {
    color: "#06b6d4",
    bg: "#ecfeff",
    icon: "🔁",
    title: "Vehicle Retrieved – Rental Complete",
    headline: "Vehicle successfully retrieved!",
    message:
      "Thank you! Your vehicle has been retrieved and your rental is now wrapping up. Please review the final payment summary below.",
  },
  completed: {
    color: "#10b981",
    bg: "#f0fdf4",
    icon: "🏁",
    title: "Booking Completed – Thank You!",
    headline: "Your booking is fully completed!",
    message:
      "Thank you for choosing The Rental Den! We hope you had a wonderful experience. We'd love to hear your feedback.",
  },
  cancelled: {
    color: "#ef4444",
    bg: "#fef2f2",
    icon: "🚫",
    title: "Booking Cancelled",
    headline: "Your booking has been cancelled.",
    message:
      "Your booking has been cancelled. If you believe this is an error or have questions, please contact us right away.",
  },
  declined: {
    color: "#f97316",
    bg: "#fff7ed",
    icon: "❌",
    title: "Booking Declined",
    headline: "We're unable to process your booking.",
    message:
      "Unfortunately, we are unable to fulfill your booking request at this time. See the reason below. Feel free to reach out or submit a new booking.",
  },
};

// ─── Shared CSS ───────────────────────────────────────────────────────────────
const BASE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f3f4f6; color: #1f2937; }
  .wrapper { max-width: 620px; margin: 0 auto; background: #f3f4f6; padding: 24px 12px; }
  .card { background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
  .topbar { background: #111827; padding: 28px 32px; text-align: center; }
  .topbar h1 { color: #fff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .topbar p { color: #9ca3af; font-size: 13px; margin-top: 4px; }
  .status-banner { padding: 20px 32px; border-bottom: 1px solid #f3f4f6; }
  .status-pill { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
  .status-banner h2 { font-size: 20px; font-weight: 800; color: #111827; margin-bottom: 6px; }
  .status-banner p { font-size: 14px; color: #6b7280; line-height: 1.6; }
  .body { padding: 24px 32px; }
  .section { background: #f9fafb; border-radius: 12px; padding: 18px 20px; margin-bottom: 18px; border: 1px solid #e5e7eb; }
  .section-title { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; }
  .row { display: flex; justify-content: space-between; align-items: flex-start; padding: 6px 0; border-bottom: 1px solid #f3f4f6; }
  .row:last-child { border-bottom: none; }
  .row-label { font-size: 13px; color: #6b7280; font-weight: 500; }
  .row-value { font-size: 13px; color: #111827; font-weight: 600; text-align: right; max-width: 55%; }
  .highlight-box { border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; }
  .highlight-box h4 { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
  .highlight-box ul { padding-left: 18px; }
  .highlight-box ul li { font-size: 13px; line-height: 1.8; }
  .pay-table { width: 100%; border-collapse: collapse; }
  .pay-table th { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; text-align: left; border-bottom: 2px solid #e5e7eb; }
  .pay-table td { font-size: 13px; padding: 10px 10px; border-bottom: 1px solid #f3f4f6; color: #374151; }
  .pay-table td.amount { font-weight: 700; color: #059669; text-align: right; }
  .pay-total { display: flex; justify-content: space-between; padding: 12px 10px; background: #f0fdf4; border-radius: 8px; margin-top: 10px; }
  .pay-total-label { font-size: 14px; font-weight: 700; color: #166534; }
  .pay-total-value { font-size: 16px; font-weight: 800; color: #15803d; }
  .deposit-box { border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; }
  .deposit-box .d-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .deposit-box .d-label { font-size: 13px; color: #6b7280; }
  .deposit-box .d-value { font-size: 14px; font-weight: 700; }
  .review-box { background: linear-gradient(135deg, #111827 0%, #1f2937 100%); border-radius: 14px; padding: 24px; text-align: center; margin-bottom: 18px; }
  .review-box h3 { color: #fff; font-size: 18px; font-weight: 800; margin-bottom: 8px; }
  .review-box p { color: #9ca3af; font-size: 13px; margin-bottom: 18px; line-height: 1.6; }
  .stars { font-size: 32px; margin-bottom: 14px; letter-spacing: 4px; }
  .review-btn { display: inline-block; background: #f59e0b; color: #111827; font-weight: 800; font-size: 14px; padding: 12px 28px; border-radius: 10px; text-decoration: none; }
  .driver-box { display: flex; align-items: center; gap: 14px; background: #f8fafc; border-radius: 10px; padding: 14px 18px; margin-bottom: 18px; border: 1px solid #e2e8f0; }
  .driver-avatar { width: 46px; height: 46px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; color: #374151; flex-shrink: 0; }
  .driver-name { font-size: 15px; font-weight: 700; color: #111827; }
  .driver-sub { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .footer { background: #111827; padding: 24px 32px; text-align: center; }
  .footer p { color: #6b7280; font-size: 12px; line-height: 1.8; }
  .footer a { color: #9ca3af; }
  .contact-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px; margin-bottom: 18px; text-align: center; }
  .contact-box p { font-size: 13px; color: #6b7280; line-height: 1.8; }
  .contact-box strong { color: #111827; }
  .decline-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 16px 20px; margin-bottom: 18px; }
  .decline-box h4 { font-size: 13px; font-weight: 700; color: #b91c1c; margin-bottom: 6px; }
  .decline-box p { font-size: 13px; color: #7f1d1d; line-height: 1.6; }
`;

// ─── HTML fragment builders ───────────────────────────────────────────────────

const emailHeader = (meta) => `
<!DOCTYPE html><html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safe(meta.title)} – The Rental Den</title>
  <style>${BASE_STYLES}</style>
</head><body>
<div class="wrapper"><div class="card">
  <div class="topbar">
    <h1>🚗 The Rental Den</h1>
    <p>Your trusted car rental partner in Cebu</p>
  </div>
  <div class="status-banner" style="background:${meta.bg}">
    <div class="status-pill" style="background:${meta.color}22;color:${meta.color}">${meta.icon} ${meta.title}</div>
    <h2>${meta.headline}</h2>
    <p>${meta.message}</p>
  </div>
  <div class="body">
`;

const emailFooter = () => `
    <div class="contact-box">
      <p>Questions? We're here to help.<br>
      📞 <strong>+63 900 000 0000</strong> &nbsp;|&nbsp; ✉️ <strong>hello@rentalden.com</strong><br>
      📍 Cebu City, Philippines</p>
    </div>
  </div>
  <div class="footer">
    <p>© ${new Date().getFullYear()} The Rental Den · Cebu City, Philippines<br>
    You're receiving this because you have an active booking with us.</p>
  </div>
</div></div></body></html>
`;

const bookingDetailsSection = (b) => {
  const vehicleLine = [b.vehicleYear, b.vehicleMake, b.vehicleModel].filter(Boolean).join(" ");
  return `
  <div class="section">
    <div class="section-title">📋 Booking Details</div>
    <div class="row"><span class="row-label">Booking ID</span><span class="row-value">#${safe(b.bookingId || b.id)}</span></div>
    <div class="row"><span class="row-label">Customer</span><span class="row-value">${safe(b.customer_name)}</span></div>
    ${b.customer_phone ? `<div class="row"><span class="row-label">Phone</span><span class="row-value">${safe(b.customer_phone)}</span></div>` : ""}
    ${b.license_number ? `<div class="row"><span class="row-label">License No.</span><span class="row-value">${safe(b.license_number)}</span></div>` : ""}
    <div class="row"><span class="row-label">Vehicle</span><span class="row-value">${vehicleLine || "—"}</span></div>
    ${b.variantColor ? `<div class="row"><span class="row-label">Color</span><span class="row-value">${safe(b.variantColor)}</span></div>` : ""}
    ${b.plate_number ? `<div class="row"><span class="row-label">Plate No.</span><span class="row-value">${safe(b.plate_number)}</span></div>` : ""}
    ${b.fuel_type ? `<div class="row"><span class="row-label">Fuel Type</span><span class="row-value">${safe(b.fuel_type)}</span></div>` : ""}
    <div class="row"><span class="row-label">Rental Start</span><span class="row-value">${fmtDate(b.rental_start_date)}</span></div>
    <div class="row"><span class="row-label">Rental End</span><span class="row-value">${fmtDate(b.rental_end_date)}</span></div>
    ${b.pickup_location ? `<div class="row"><span class="row-label">Pickup Location</span><span class="row-value">${safe(b.pickup_location)}</span></div>` : ""}
    ${b.delivery_address ? `<div class="row"><span class="row-label">Delivery Address</span><span class="row-value">${safe(b.delivery_address)}</span></div>` : ""}
    ${b.delivery_option ? `<div class="row"><span class="row-label">Service Type</span><span class="row-value">${b.delivery_option === "deliver" ? "🚚 Delivery" : "🏢 Self-Pickup"}</span></div>` : ""}
    <div class="row"><span class="row-label">Total Rental Fee</span><span class="row-value" style="color:#059669;font-size:15px">${fmt(b.total_price)}</span></div>
  </div>`;
};

const depositSection = (b) => {
  const depositAmount = parseFloat(b.deposit_amount || 0);
  if (!depositAmount) return "";
  const collected = parseFloat(b.deposit_collected || 0);
  const returned = !!b.deposit_returned;

  let bg = "#f9fafb", borderColor = "#e5e7eb", statusText = "⏳ To be collected at delivery", valueColor = "#374151";
  if (returned) { bg = "#f0fdf4"; borderColor = "#86efac"; statusText = "✅ Returned to customer"; valueColor = "#059669"; }
  else if (collected > 0) { bg = "#f5f3ff"; borderColor = "#ddd6fe"; statusText = "🔒 Collected – to be returned upon retrieval"; valueColor = "#7c3aed"; }

  return `
  <div class="deposit-box" style="background:${bg};border:1px solid ${borderColor}">
    <div class="section-title">🛡️ Security Deposit</div>
    <div class="d-row">
      <span class="d-label">Deposit Amount</span>
      <span class="d-value" style="color:${valueColor}">${fmt(depositAmount)}</span>
    </div>
    <div class="d-row">
      <span class="d-label">Status</span>
      <span style="font-size:13px;font-weight:600;color:${valueColor}">${statusText}</span>
    </div>
    ${!returned && !collected ? `<p style="font-size:12px;color:#6b7280;margin-top:8px">💡 Please prepare <strong>${fmt(depositAmount)}</strong> as security deposit. It will be returned to you when the vehicle is retrieved.</p>` : ""}
    ${returned ? `<p style="font-size:12px;color:#166534;margin-top:8px">Your security deposit of ${fmt(depositAmount)} has been returned.</p>` : ""}
  </div>`;
};

const driverSection = (b) => {
  if (!b.assigned_driver) return "";
  const initials = b.assigned_driver.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  return `
  <div class="driver-box">
    <div class="driver-avatar">${initials}</div>
    <div>
      <div class="driver-name">🧑‍✈️ ${safe(b.assigned_driver)}</div>
      <div class="driver-sub">Your assigned driver for this booking</div>
      ${b.assigned_driver_email ? `<div class="driver-sub">✉️ ${safe(b.assigned_driver_email)}</div>` : ""}
    </div>
  </div>`;
};

const paymentLogSection = (b, showTitle = "💳 Payment Log") => {
  const log = Array.isArray(b.payment_log) ? b.payment_log : [];
  if (!log.length) return "";
  const total = log.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const rows = log.map((e) => `
    <tr>
      <td>${safe(e.event, "Payment")}</td>
      <td style="color:#6b7280;font-size:12px">${fmtDateTime(e.recorded_at)}</td>
      <td class="amount">${fmt(e.amount)}</td>
    </tr>`).join("");
  return `
  <div class="section">
    <div class="section-title">${showTitle}</div>
    <table class="pay-table">
      <thead><tr>
        <th>Description</th><th>Date &amp; Time</th><th style="text-align:right">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="pay-total">
      <span class="pay-total-label">Total Collected</span>
      <span class="pay-total-value">${fmt(total)}</span>
    </div>
  </div>`;
};

const extraChargesSection = (b) => {
  const fuel = parseFloat(b.fuel_charge || 0);
  const delay = parseFloat(b.delay_charge || 0);
  const damage = parseFloat(b.damage_fee || 0);
  if (!fuel && !delay && !damage) return "";
  return `
  <div class="section">
    <div class="section-title">⚠️ Additional Charges</div>
    ${fuel > 0 ? `<div class="row"><span class="row-label">⛽ Fuel Charge</span><span class="row-value" style="color:#d97706">${fmt(fuel)}</span></div>` : ""}
    ${delay > 0 ? `<div class="row"><span class="row-label">⏰ Delay Charge</span><span class="row-value" style="color:#db2777">${fmt(delay)}</span></div>` : ""}
    ${damage > 0 ? `<div class="row"><span class="row-label">🔧 Damage Fee</span><span class="row-value" style="color:#b91c1c">${fmt(damage)}</span></div>` : ""}
    <div class="row" style="border-top:2px solid #e5e7eb;margin-top:4px;padding-top:10px">
      <span class="row-label" style="font-weight:700;color:#111827">Total Additional</span>
      <span class="row-value" style="color:#b91c1c;font-size:15px">${fmt(fuel + delay + damage)}</span>
    </div>
  </div>`;
};

const paymentSummarySection = (b) => {
  const base = parseFloat(b.total_price || 0);
  const fuel = parseFloat(b.fuel_charge || 0);
  const delay = parseFloat(b.delay_charge || 0);
  const damage = parseFloat(b.damage_fee || 0);
  const deposit = parseFloat(b.deposit_amount || 0);
  const depositReturned = !!b.deposit_returned;
  const paid = (Array.isArray(b.payment_log) ? b.payment_log : []).reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  const totalOwed = base + fuel + delay + damage;

  return `
  <div class="section">
    <div class="section-title">🧾 Final Payment Summary</div>
    <div class="row"><span class="row-label">Base Rental Fee</span><span class="row-value">${fmt(base)}</span></div>
    ${fuel > 0 ? `<div class="row"><span class="row-label">⛽ Fuel Charge</span><span class="row-value" style="color:#d97706">${fmt(fuel)}</span></div>` : ""}
    ${delay > 0 ? `<div class="row"><span class="row-label">⏰ Delay Charge</span><span class="row-value" style="color:#db2777">${fmt(delay)}</span></div>` : ""}
    ${damage > 0 ? `<div class="row"><span class="row-label">🔧 Damage Fee</span><span class="row-value" style="color:#b91c1c">${fmt(damage)}</span></div>` : ""}
    <div class="row" style="border-top:2px solid #e5e7eb;margin-top:4px;padding-top:10px">
      <span class="row-label" style="font-weight:700;color:#111827">Total Amount</span>
      <span class="row-value" style="color:#111827;font-size:15px">${fmt(totalOwed)}</span>
    </div>
    <div class="row">
      <span class="row-label">Total Collected</span>
      <span class="row-value" style="color:#059669">${fmt(paid)}</span>
    </div>
    ${deposit > 0 ? `
    <div class="row">
      <span class="row-label">Security Deposit</span>
      <span class="row-value" style="color:${depositReturned ? "#059669" : "#7c3aed"}">${fmt(deposit)} ${depositReturned ? "(Returned ✅)" : "(Held 🔒)"}</span>
    </div>` : ""}
  </div>`;
};

const reviewSection = (b) => {
  const id = safe(b.bookingId || b.id);
  return `
  <div class="review-box">
    <div class="stars">⭐⭐⭐⭐⭐</div>
    <h3>How was your experience?</h3>
    <p>Your feedback helps us improve and serve you better. It only takes 30 seconds!</p>
    <a class="review-btn" href="mailto:hello@rentalden.com?subject=Review%20for%20Booking%20%23${id}&body=Booking%20ID%3A%20%23${id}%0A%0ARating%20(1-5%20stars)%3A%20%0A%0AYour%20review%3A%20">
      ✍️ Write Your Review
    </a>
    <p style="color:#6b7280;font-size:12px;margin-top:12px">Or email us at hello@rentalden.com with subject: Review #${id}</p>
  </div>`;
};

// ─── Email builders per status ────────────────────────────────────────────────

const buildPendingEmail = (b) =>
  emailHeader(STATUS_META.pending) +
  bookingDetailsSection(b) +
  depositSection(b) +
  `<div class="highlight-box" style="background:#fffbeb;border:1px solid #fde68a">
    <h4 style="color:#92400e;margin-bottom:8px">📌 While you wait – Good to know:</h4>
    <ul style="color:#78350f">
      <li>Balance must be settled before you can use the car</li>
      <li>Fuel must be returned at the same level as pickup</li>
      <li>Extended hours are charged at ₱300/hour</li>
      <li>Delivery within 5km from our garage: ₱250</li>
      <li>Please ensure your ID and driver's license are ready</li>
    </ul>
  </div>` +
  emailFooter();

const buildConfirmedEmail = (b) =>
  emailHeader(STATUS_META.confirmed) +
  bookingDetailsSection(b) +
  driverSection(b) +
  depositSection(b) +
  `<div class="highlight-box" style="background:#eff6ff;border:1px solid #bfdbfe">
    <h4 style="color:#1e40af;margin-bottom:8px">🚀 Next Steps – Please Prepare:</h4>
    <ul style="color:#1e3a8a">
      <li>Arrive / be available 15 minutes before your scheduled time</li>
      <li>Bring your valid driver's license and government-issued ID</li>
      <li>Settle remaining balance before vehicle use</li>
      <li>Prepare security deposit: <strong>${fmt(b.deposit_amount || 0)}</strong></li>
      <li>Our team will contact you 24 hours before delivery</li>
      <li>Vehicle inspection will be done before handover</li>
    </ul>
  </div>
  <div class="highlight-box" style="background:#f0fdf4;border:1px solid #86efac;margin-top:0">
    <h4 style="color:#166534;margin-bottom:8px">📋 Important Rental Guidelines:</h4>
    <ul style="color:#14532d">
      <li><strong>Fuel:</strong> Return vehicle with same fuel level as pickup</li>
      <li><strong>Extended Hours:</strong> ₱300 per hour beyond agreed return time</li>
      <li><strong>Delivery:</strong> Within 5km from our garage for ₱250</li>
      <li><strong>Payment:</strong> Balance settled before vehicle use</li>
    </ul>
  </div>` +
  emailFooter();

const buildOngoingEmail = (b) =>
  emailHeader(STATUS_META.ongoing) +
  bookingDetailsSection(b) +
  driverSection(b) +
  depositSection(b) +
  `<div class="highlight-box" style="background:#f5f3ff;border:1px solid #ddd6fe">
    <h4 style="color:#5b21b6;margin-bottom:8px">🚗 Driver is on the way – Please Prepare:</h4>
    <ul style="color:#4c1d95">
      <li>Be at your delivery address and ready to receive the vehicle</li>
      <li>Have your valid ID and driver's license ready for verification</li>
      <li>Prepare your <strong>balance payment</strong> and <strong>security deposit ${fmt(b.deposit_amount || 0)}</strong></li>
      <li>A vehicle inspection will be done upon delivery – please be present</li>
      ${b.partial_payment_amount ? `<li>Partial payment of <strong>${fmt(b.partial_payment_amount)}</strong> acknowledged</li>` : ""}
    </ul>
  </div>` +
  (b.partial_payment_amount
    ? `<div class="section">
        <div class="section-title">💰 Payment Status</div>
        <div class="row"><span class="row-label">Total Rental Fee</span><span class="row-value">${fmt(b.total_price)}</span></div>
        <div class="row"><span class="row-label">Partial Payment Received</span><span class="row-value" style="color:#059669">${fmt(b.partial_payment_amount)}</span></div>
        <div class="row"><span class="row-label">Remaining Balance</span><span class="row-value" style="color:#b91c1c;font-size:15px">${fmt(parseFloat(b.total_price || 0) - parseFloat(b.partial_payment_amount || 0))}</span></div>
      </div>`
    : "") +
  emailFooter();

const buildDeliveredEmail = (b) =>
  emailHeader(STATUS_META.delivered) +
  bookingDetailsSection(b) +
  driverSection(b) +
  paymentLogSection(b, "💳 Payment Collected at Delivery") +
  depositSection(b) +
  extraChargesSection(b) +
  `<div class="highlight-box" style="background:#fdf2f8;border:1px solid #f9a8d4">
    <h4 style="color:#9d174d;margin-bottom:8px">🌟 Enjoy Your Rental!</h4>
    <ul style="color:#831843">
      <li>Drive safely and responsibly</li>
      <li>Return the vehicle with the same fuel level as when received</li>
      <li>Contact us immediately for any issues: <strong>+63 900 000 0000</strong></li>
      <li>Extended hours: ₱300/hour after agreed return time</li>
      <li>Security deposit of <strong>${fmt(b.deposit_amount || 0)}</strong> will be returned upon vehicle retrieval</li>
    </ul>
  </div>` +
  emailFooter();

const buildRetrievedEmail = (b) =>
  emailHeader(STATUS_META.retrieved) +
  bookingDetailsSection(b) +
  driverSection(b) +
  paymentSummarySection(b) +
  paymentLogSection(b, "📜 Complete Payment History") +
  depositSection(b) +
  `<div class="highlight-box" style="background:#ecfeff;border:1px solid #a5f3fc">
    <h4 style="color:#164e63;margin-bottom:8px">🔁 Vehicle Retrieved Successfully!</h4>
    <ul style="color:#155e75">
      <li>Vehicle has been inspected upon retrieval</li>
      <li>Any additional charges have been applied above</li>
      <li>Security deposit status is reflected above</li>
      <li>Booking will be marked as completed once fully processed</li>
    </ul>
  </div>` +
  reviewSection(b) +
  emailFooter();

const buildCompletedEmail = (b) =>
  emailHeader(STATUS_META.completed) +
  bookingDetailsSection(b) +
  paymentSummarySection(b) +
  paymentLogSection(b, "📜 Full Payment History") +
  depositSection(b) +
  `<div class="highlight-box" style="background:#f0fdf4;border:1px solid #86efac">
    <h4 style="color:#166534;margin-bottom:8px">🏆 Booking Fully Completed!</h4>
    <ul style="color:#14532d">
      <li>All payments have been settled</li>
      ${b.deposit_returned ? "<li>Security deposit has been returned ✅</li>" : ""}
      <li>We hope you had a wonderful experience</li>
      <li>We look forward to serving you again!</li>
    </ul>
  </div>` +
  reviewSection(b) +
  emailFooter();

const buildCancelledEmail = (b) =>
  emailHeader(STATUS_META.cancelled) +
  bookingDetailsSection(b) +
  `<div class="highlight-box" style="background:#fef2f2;border:1px solid #fecaca">
    <h4 style="color:#b91c1c;margin-bottom:8px">🚫 Cancellation Information:</h4>
    <ul style="color:#7f1d1d">
      <li>Your booking has been successfully cancelled</li>
      <li>Refund processing will begin within 3–5 business days (if applicable)</li>
      <li>You will receive a separate email regarding refund status</li>
      <li>Feel free to book again anytime!</li>
    </ul>
  </div>` +
  emailFooter();

const buildDeclinedEmail = (b) =>
  emailHeader(STATUS_META.declined) +
  bookingDetailsSection(b) +
  (b.decline_reason
    ? `<div class="decline-box">
        <h4>Reason for Decline:</h4>
        <p>${safe(b.decline_reason)}</p>
        <p style="margin-top:8px;font-style:italic">We apologize for the inconvenience. Please feel free to contact us to discuss alternative options.</p>
      </div>`
    : "") +
  `<div class="highlight-box" style="background:#fff7ed;border:1px solid #fed7aa">
    <h4 style="color:#92400e;margin-bottom:8px">📌 What happens next:</h4>
    <ul style="color:#78350f">
      <li>No charges will be applied to your account</li>
      <li>You're welcome to submit a new booking request</li>
      <li>Contact us to discuss alternative vehicle options</li>
      <li>We appreciate your understanding</li>
    </ul>
  </div>` +
  emailFooter();

// ─── Build email by status ────────────────────────────────────────────────────
const buildEmail = (b) => {
  switch (b.newStatus) {
    case "pending":   return buildPendingEmail(b);
    case "confirmed": return buildConfirmedEmail(b);
    case "ongoing":   return buildOngoingEmail(b);
    case "delivered": return buildDeliveredEmail(b);
    case "retrieved": return buildRetrievedEmail(b);
    case "completed": return buildCompletedEmail(b);
    case "cancelled": return buildCancelledEmail(b);
    case "declined":  return buildDeclinedEmail(b);
    default:
      return emailHeader(STATUS_META.pending) + bookingDetailsSection(b) + emailFooter();
  }
};

// ─── Email subjects ───────────────────────────────────────────────────────────
const getSubject = (b) => {
  const id = safe(b.bookingId || b.id, "N/A");
  const subjects = {
    pending:   `⏳ Booking Received – Under Review (#${id})`,
    confirmed: `✅ Booking Confirmed – Vehicle Reserved (#${id})`,
    ongoing:   `🚗 Your Driver is On the Way (#${id})`,
    delivered: `📦 Vehicle Delivered – Payment Summary (#${id})`,
    retrieved: `🔁 Vehicle Retrieved – Final Summary (#${id})`,
    completed: `🏁 Booking Completed – Thank You! (#${id})`,
    cancelled: `🚫 Booking Cancelled (#${id})`,
    declined:  `❌ Booking Declined (#${id})`,
  };
  return subjects[b.newStatus] || `📋 Booking Update (#${id})`;
};

// ─── Routes ───────────────────────────────────────────────────────────────────

app.post("/api/send-status-email", async (req, res) => {
  try {
    const b = req.body;
    console.log(`[email-server] Sending "${b.newStatus}" email → ${b.customer_email}`);

    if (!b.customer_email || !b.customer_name || !b.newStatus) {
      return res.status(400).json({ error: "Missing required fields: customer_email, customer_name, newStatus" });
    }
    if (b.newStatus === "declined" && !b.decline_reason) {
      return res.status(400).json({ error: "decline_reason is required when status is declined" });
    }

    await transporter.sendMail({
      from: `"The Rental Den" <${process.env.EMAIL_USER}>`,
      to: b.customer_email,
      subject: getSubject(b),
      html: buildEmail(b),
    });

    console.log(`[email-server] ✅ Sent to ${b.customer_email}`);
    res.status(200).json({ success: true, message: `Status email sent for status: ${b.newStatus}` });
  } catch (err) {
    console.error("[email-server] ❌ Error:", err.message);
    res.status(500).json({ success: false, error: "Failed to send email", details: err.message });
  }
});

app.post("/api/send-driver-assigned-email", async (req, res) => {
  try {
    const b = req.body;
    if (!b.customer_email || !b.assigned_driver) {
      return res.status(400).json({ error: "Missing customer_email or assigned_driver" });
    }

    const initials = b.assigned_driver.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

    const html =
      emailHeader({
        ...STATUS_META.confirmed,
        title:    "Driver Assigned",
        headline: "Your driver has been assigned!",
        message:  "A driver has been assigned to handle your vehicle delivery. See the details below.",
      }) +
      bookingDetailsSection(b) +
      `<div class="driver-box">
        <div class="driver-avatar">${initials}</div>
        <div>
          <div class="driver-name">🧑‍✈️ ${safe(b.assigned_driver)}</div>
          <div class="driver-sub">Assigned driver for Booking #${safe(b.bookingId || b.id)}</div>
          ${b.assigned_driver_email ? `<div class="driver-sub">✉️ ${safe(b.assigned_driver_email)}</div>` : ""}
        </div>
      </div>` +
      depositSection(b) +
      `<div class="highlight-box" style="background:#eff6ff;border:1px solid #bfdbfe">
        <h4 style="color:#1e40af;margin-bottom:8px">📌 Please prepare:</h4>
        <ul style="color:#1e3a8a">
          <li>Valid driver's license and government ID</li>
          <li>Remaining balance: <strong>${fmt(parseFloat(b.total_price || 0) - parseFloat(b.partial_payment_amount || 0))}</strong></li>
          <li>Security deposit: <strong>${fmt(b.deposit_amount || 0)}</strong></li>
        </ul>
      </div>` +
      emailFooter();

    await transporter.sendMail({
      from: `"The Rental Den" <${process.env.EMAIL_USER}>`,
      to: b.customer_email,
      subject: `🧑‍✈️ Driver Assigned – Booking #${safe(b.bookingId || b.id)}`,
      html,
    });

    console.log(`[email-server] ✅ Driver-assigned email sent to ${b.customer_email}`);
    res.status(200).json({ success: true, message: "Driver assignment email sent" });
  } catch (err) {
    console.error("[email-server] ❌ Error:", err.message);
    res.status(500).json({ success: false, error: "Failed to send email", details: err.message });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "✅ Email service is running", timestamp: new Date().toISOString() });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[email-server] 🚀 Running on port ${PORT}`);
  console.log(`[email-server] 📧 Account: ${process.env.EMAIL_USER}`);
});