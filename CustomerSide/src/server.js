import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
console.log("Loaded ENV:", process.env.EMAIL_USER, process.env.EMAIL_PASS ? "PASS_SET" : "PASS_MISSING");

const app = express();
const PORT = process.env.PORT || 3001;

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) =>
  `₱${parseFloat(v || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
};

const fmtDateTime = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const calcDays = (start, end) =>
  Math.max(1, Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)));

// Normalise vehicle name — works for both website payload and app payload
const vehicleLine = (d) =>
  [d.vehicleYear || d.vehicle_year, d.vehicleMake || d.vehicle_make, d.vehicleModel || d.vehicle_model]
    .filter(Boolean).join(" ") || d.vehicle_info || "—";

// Normalise booking id — website uses bookingId, app uses booking_id or id
const bookingId = (d) => d.bookingId || d.booking_id || d.id || "—";

// ─── Shared CSS ────────────────────────────────────────────────────────────────
const css = `
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,Helvetica,sans-serif;background:#f1f5f9;color:#1e293b}
  .wrap{max-width:620px;margin:24px auto}
  .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)}
  .hdr{padding:30px;text-align:center}
  .hdr-icon{font-size:38px;margin-bottom:10px}
  .hdr h1{font-size:22px;font-weight:800;color:#fff;letter-spacing:-.3px}
  .hdr p{font-size:14px;color:rgba(255,255,255,.85);margin-top:6px}
  .body{padding:26px 28px}
  .greeting{font-size:17px;color:#1e293b;margin-bottom:12px;font-weight:600}
  .intro{font-size:14px;color:#475569;line-height:1.75;margin-bottom:22px}
  .sec-title{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.9px;margin-bottom:8px;margin-top:18px}
  .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:4px}
  .row{display:flex;justify-content:space-between;align-items:flex-start;padding:10px 14px;border-bottom:1px solid #f1f5f9}
  .row:last-child{border-bottom:none}
  .lbl{font-size:13px;color:#64748b;font-weight:500;width:43%}
  .val{font-size:13px;color:#1e293b;font-weight:600;width:55%;text-align:right}
  .val small{font-size:11px;font-weight:400;color:#94a3b8}
  .price-row{background:#f0fdf4}
  .price-row .lbl{font-weight:700;color:#15803d}
  .price-row .val{font-size:16px;font-weight:800;color:#15803d}
  .note{border-left:4px solid;border-radius:0 10px 10px 0;padding:14px 16px;margin-top:18px}
  .note h4{font-size:13px;font-weight:700;margin-bottom:8px}
  .note ul{padding-left:18px}
  .note li{font-size:13px;line-height:1.8;color:#475569}
  .contact-box{background:#f8fafc;border-radius:12px;padding:16px;text-align:center;margin-top:18px}
  .contact-box h4{font-size:14px;font-weight:700;color:#1e293b;margin-bottom:7px}
  .contact-box p{font-size:13px;color:#475569;line-height:1.9}
  .contact-box a{color:#1e293b;font-weight:600;text-decoration:none}
  .review-box{background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1.5px solid #86efac;border-radius:14px;padding:22px;text-align:center;margin-top:18px}
  .review-box h3{font-size:18px;color:#15803d;margin-bottom:7px}
  .review-box p{font-size:13px;color:#374151;margin-bottom:14px}
  .stars{font-size:26px;letter-spacing:4px;margin:8px 0}
  .cta{display:inline-block;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;color:#fff}
  .contract-box{background:#fff7ed;border:1px solid #fed7aa;padding:18px;border-radius:10px;margin-top:18px}
  .contract-box h4{font-size:13px;font-weight:700;color:#b45309;margin-bottom:8px}
  .contract-box p{font-size:12px;color:#78350f;line-height:1.7;margin-bottom:8px}
  .sig{margin-top:10px;padding-top:10px;border-top:1px solid #fed7aa;font-size:12px;color:#7c2d12}
  .footer{background:#101010;padding:20px 28px;text-align:center}
  .footer p{font-size:12px;color:#94a3b8;line-height:1.8}
  .footer a{color:#60a5fa;text-decoration:none}
</style>`;

// ─── Shared Partials ──────────────────────────────────────────────────────────
const hdr = (bg, icon, title, sub) =>
  `<div class="hdr" style="background:${bg}"><div class="hdr-icon">${icon}</div><h1>${title}</h1><p>${sub}</p></div>`;

const ftr = () =>
  `<div class="footer">
    <p><strong style="color:#e2e8f0">The Rental Den</strong><br>
    Your Premier Car Rental Service in Cebu<br>
    <a href="mailto:hello@rentalden.com">hello@rentalden.com</a> &nbsp;|&nbsp;
    <a href="tel:+639000000000">+63 900 000 0000</a></p>
    <p style="margin-top:8px;font-size:11px;opacity:.5">Automated message — please do not reply directly. &nbsp;© ${new Date().getFullYear()} The Rental Den</p>
  </div>`;

const contactBlock = () =>
  `<div class="contact-box"><h4>📞 Need Help?</h4>
  <p><a href="tel:+639000000000">+63 900 000 0000</a><br>
  <a href="mailto:hello@rentalden.com">hello@rentalden.com</a><br>
  Mon–Sun &nbsp; 8:00 AM – 8:00 PM</p></div>`;

const wrap = (inner) =>
  `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">${css}</head>
  <body><div class="wrap"><div class="card">${inner}${ftr()}</div></div></body></html>`;

// ─── Reusable Data Blocks ─────────────────────────────────────────────────────
const bookingBlock = (d) => `
  <p class="sec-title">📋 Booking Information</p>
  <div class="box">
    <div class="row"><span class="lbl">Booking ID</span><span class="val"><strong>#${bookingId(d)}</strong></span></div>
    <div class="row"><span class="lbl">Vehicle</span><span class="val">${vehicleLine(d)}</span></div>
    ${(d.variantColor || d.variant_color) ? `<div class="row"><span class="lbl">Color</span><span class="val">${d.variantColor || d.variant_color}</span></div>` : ""}
    ${d.plate_number ? `<div class="row"><span class="lbl">Plate No.</span><span class="val">${d.plate_number}</span></div>` : ""}
    <div class="row"><span class="lbl">Pickup Date</span><span class="val">${fmtDate(d.rental_start_date)}</span></div>
    <div class="row"><span class="lbl">Return Date</span><span class="val">${fmtDate(d.rental_end_date)}</span></div>
    <div class="row"><span class="lbl">Duration</span><span class="val">${calcDays(d.rental_start_date, d.rental_end_date)} day(s)</span></div>
    <div class="row"><span class="lbl">${d.delivery_option === "deliver" ? "Delivery Address" : "Pickup Location"}</span>
      <span class="val">${d.delivery_address || d.pickup_location || "—"}</span></div>
    ${d.delivery_option ? `<div class="row"><span class="lbl">Service Type</span>
      <span class="val">${d.delivery_option === "deliver" ? "🚗 Door-to-Door Delivery" : "🏠 Self Pickup"}</span></div>` : ""}
    <div class="row"><span class="lbl">License No.</span><span class="val">${d.license_number || "—"}</span></div>
    <div class="row"><span class="lbl">Phone</span><span class="val">${d.customer_phone || "—"}</span></div>
  </div>`;

const paymentBlock = (d) => {
  const base    = parseFloat(d.total_price   || 0);
  const fuel    = parseFloat(d.fuel_charge   || 0);
  const delay   = parseFloat(d.delay_charge  || 0);
  const damage  = parseFloat(d.damage_fee    || 0);
  const deposit = parseFloat(d.deposit_amount || 0);
  const grand   = base + fuel + delay + damage;
  return `
  <p class="sec-title">💰 Payment Breakdown</p>
  <div class="box">
    <div class="row"><span class="lbl">Base Rental</span><span class="val">${fmt(base)}</span></div>
    ${fuel   > 0 ? `<div class="row"><span class="lbl">⛽ Fuel Charge</span><span class="val">${fmt(fuel)}</span></div>` : ""}
    ${delay  > 0 ? `<div class="row"><span class="lbl">⏰ Delay Charge</span><span class="val">${fmt(delay)}</span></div>` : ""}
    ${damage > 0 ? `<div class="row"><span class="lbl">🔧 Damage Fee</span><span class="val">${fmt(damage)}</span></div>` : ""}
    ${deposit > 0 ? `<div class="row"><span class="lbl">🛡️ Security Deposit</span>
      <span class="val">${fmt(deposit)} <small>(refundable)</small></span></div>` : ""}
    <div class="row price-row"><span class="lbl">Total Amount</span><span class="val">${fmt(grand)}</span></div>
  </div>`;
};

const payLogBlock = (log) => {
  if (!Array.isArray(log) || log.length === 0) return "";
  const total = log.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
  return `
  <p class="sec-title">📜 Payment Log</p>
  <div class="box">
    ${log.map(e => `
    <div class="row">
      <span class="lbl">${e.event || "Payment"}<br>
        <small style="color:#94a3b8">${fmtDateTime(e.recorded_at)}</small></span>
      <span class="val" style="color:#15803d">${fmt(e.amount)}</span>
    </div>`).join("")}
    <div class="row price-row"><span class="lbl">Total Collected</span><span class="val">${fmt(total)}</span></div>
  </div>`;
};

const contractBlock = (d) => {
  const text = d.contractText || d.contract_text;
  if (!text) return "";
  const name = d.contractSignedName || d.contract_signed_name || "Not provided";
  const at   = d.contractSignedAt   || d.contract_signed_at;
  const paras = text.split(/\n{2,}/).map(p => `<p>${p}</p>`).join("");
  return `
  <div class="contract-box">
    <h4>📄 Signed Rental Contract</h4>
    ${paras}
    <div class="sig">
      <p><strong>Signed by:</strong> ${name}</p>
      ${at ? `<p><strong>Signed on:</strong> ${fmtDateTime(at)}</p>` : ""}
    </div>
  </div>`;
};

const depositNote = (d, mode) => {
  const amt = parseFloat(d.deposit_amount || 0);
  if (amt <= 0) return "";
  if (mode === "collect") return `
  <div class="note" style="background:#f5f3ff;border-color:#c4b5fd">
    <h4 style="color:#7c3aed">🛡️ Security Deposit Collected</h4>
    <ul>
      <li>Your deposit of <strong>${fmt(amt)}</strong> has been collected today.</li>
      <li>It will be <strong>fully refunded</strong> upon vehicle retrieval, provided it is returned in good condition.</li>
    </ul>
  </div>`;
  if (mode === "status") return `
  <div class="note" style="background:${d.deposit_returned ? "#f0fdf4" : "#fef9c3"};border-color:${d.deposit_returned ? "#86efac" : "#fde047"}">
    <h4 style="color:${d.deposit_returned ? "#15803d" : "#a16207"}">🛡️ Security Deposit</h4>
    <ul>
      <li>${d.deposit_returned
        ? `✅ Your deposit of <strong>${fmt(amt)}</strong> has been <strong>returned</strong>. Thank you!`
        : `Your deposit of <strong>${fmt(amt)}</strong> will be returned after the final vehicle inspection.`
      }</li>
    </ul>
  </div>`;
  return "";
};

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

// 1. PENDING — new booking received (fired by website on submit)
const tplPending = (d) => wrap(`
  ${hdr("linear-gradient(135deg,#101010,#374151)", "🚗", "Booking Received!", "The Rental Den — We've got your request")}
  <div class="body">
    <p class="greeting">Dear ${d.customer_name},</p>
    <p class="intro">Thank you for choosing <strong>The Rental Den</strong>! We've received your booking and our team will review it within <strong>24 hours</strong>.</p>
    ${bookingBlock(d)}
    ${paymentBlock(d)}
    ${contractBlock(d)}
    <div class="note" style="background:#fefce8;border-color:#fbbf24">
      <h4 style="color:#b45309">⏳ What Happens Next?</h4>
      <ul>
        <li>Our team confirms your booking within <strong>24 hours</strong>.</li>
        <li>Prepare a valid <strong>Driver's License</strong> and a government-issued ID.</li>
        ${parseFloat(d.deposit_amount || 0) > 0 ? `<li>A refundable security deposit of <strong>${fmt(d.deposit_amount)}</strong> is required upon vehicle delivery.</li>` : ""}
        <li>Free cancellation up to <strong>24 hours</strong> before your pickup date.</li>
        ${d.delivery_option === "pickup" ? "<li>The owner's garage address will be shared once your booking is confirmed.</li>" : ""}
        ${d.delivery_option === "deliver" ? "<li>Delivery fee is calculated by distance and charged when the vehicle arrives.</li>" : ""}
      </ul>
    </div>
    ${contactBlock()}
  </div>`);

// 2. CONFIRMED
const tplConfirmed = (d) => wrap(`
  ${hdr("linear-gradient(135deg,#1d4ed8,#2563eb)", "✅", "Booking Confirmed!", "The Rental Den — Your reservation is set")}
  <div class="body">
    <p class="greeting">Dear ${d.customer_name},</p>
    <p class="intro">Great news! Your booking has been <strong>confirmed</strong>. A driver will be assigned shortly and you'll receive another update.</p>
    ${bookingBlock(d)}
    ${paymentBlock(d)}
    <div class="note" style="background:#eff6ff;border-color:#93c5fd">
      <h4 style="color:#1d4ed8">📌 Before Your Pickup Date</h4>
      <ul>
        <li>Be available at your location on <strong>${fmtDate(d.rental_start_date)}</strong>.</li>
        <li>Have your <strong>Driver's License</strong> and government ID ready.</li>
        ${parseFloat(d.deposit_amount || 0) > 0 ? `<li>Prepare <strong>${fmt(d.deposit_amount)}</strong> cash for the refundable security deposit.</li>` : ""}
        <li>Payment is collected upon vehicle delivery. We accept cash and cards.</li>
        <li>To cancel, contact us at least <strong>24 hours</strong> in advance.</li>
        ${d.delivery_option === "pickup" ? "<li>The exact pickup address will be provided to you separately.</li>" : ""}
      </ul>
    </div>
    ${contactBlock()}
  </div>`);

// 3. DRIVER ASSIGNED
const tplDriverAssigned = (d) => wrap(`
  ${hdr("linear-gradient(135deg,#6d28d9,#7c3aed)", "👨‍✈️", "Driver Assigned!", "The Rental Den — Your driver is ready")}
  <div class="body">
    <p class="greeting">Dear ${d.customer_name},</p>
    <p class="intro">A driver has been assigned to your booking. Please be ready at your location on the scheduled date.</p>
    <p class="sec-title">🧑 Assigned Driver</p>
    <div class="box">
      <div class="row"><span class="lbl">Driver Name</span><span class="val"><strong>${d.assigned_driver || "—"}</strong></span></div>
      ${d.assigned_driver_email ? `<div class="row"><span class="lbl">Driver Email</span><span class="val">${d.assigned_driver_email}</span></div>` : ""}
    </div>
    ${bookingBlock(d)}
    ${paymentBlock(d)}
    <div class="note" style="background:#faf5ff;border-color:#c4b5fd">
      <h4 style="color:#7c3aed">🚗 Delivery Day Reminders</h4>
      <ul>
        <li>Keep your phone on — your driver will call before arriving.</li>
        <li>Have your <strong>Driver's License</strong> and government ID ready for verification.</li>
        ${parseFloat(d.deposit_amount || 0) > 0 ? `<li>Prepare <strong>${fmt(d.deposit_amount)}</strong> cash for the security deposit upon delivery.</li>` : ""}
        <li>Inspect the vehicle carefully before signing off.</li>
      </ul>
    </div>
    ${contactBlock()}
  </div>`);

// 4. ONGOING — driver en route
const tplOngoing = (d) => wrap(`
  ${hdr("linear-gradient(135deg,#b45309,#d97706)", "🚙", "Vehicle On Its Way!", "The Rental Den — Driver is en route")}
  <div class="body">
    <p class="greeting">Dear ${d.customer_name},</p>
    <p class="intro">Your driver is now <strong>on the way</strong> to deliver your vehicle. Please be ready — the driver will call upon arrival.</p>
    <p class="sec-title">🧑 Your Driver</p>
    <div class="box">
      <div class="row"><span class="lbl">Driver</span><span class="val"><strong>${d.assigned_driver || "—"}</strong></span></div>
      <div class="row"><span class="lbl">Going To</span><span class="val">${d.delivery_address || d.pickup_location || "—"}</span></div>
    </div>
    ${bookingBlock(d)}
    ${paymentBlock(d)}
    <div class="note" style="background:#fefce8;border-color:#fbbf24">
      <h4 style="color:#b45309">💳 Payment Due Upon Delivery</h4>
      <ul>
        <li>Rental total: <strong>${fmt(d.total_price)}</strong></li>
        ${parseFloat(d.deposit_amount || 0) > 0 ? `<li>Security deposit: <strong>${fmt(d.deposit_amount)}</strong> — fully refunded at retrieval.</li>` : ""}
        ${parseFloat(d.partial_payment || 0) > 0 ? `<li>Partial payment already recorded: <strong>${fmt(d.partial_payment)}</strong></li>` : ""}
        <li>We accept <strong>cash and major credit cards</strong>.</li>
      </ul>
    </div>
    ${contactBlock()}
  </div>`);

// 5. DELIVERED — vehicle handed over, show collected payments
const tplDelivered = (d) => wrap(`
  ${hdr("linear-gradient(135deg,#be185d,#ec4899)", "📦", "Vehicle Delivered!", "The Rental Den — Enjoy your ride")}
  <div class="body">
    <p class="greeting">Dear ${d.customer_name},</p>
    <p class="intro">Your vehicle has been successfully <strong>delivered</strong>! Below is your complete rental summary and what was collected today.</p>
    ${bookingBlock(d)}
    ${paymentBlock(d)}
    ${payLogBlock(d.payment_log)}
    ${depositNote(d, "collect")}
    <div class="note" style="background:#f0fdf4;border-color:#86efac">
      <h4 style="color:#15803d">📋 During Your Rental</h4>
      <ul>
        <li>Adhere to traffic rules and all agreed rental terms.</li>
        <li>Do not sublet the vehicle to another person.</li>
        <li>Contact us immediately in case of emergency or accident.</li>
        <li>Return the vehicle with the same fuel level as received.</li>
        <li>Return on or before: <strong>${fmtDate(d.rental_end_date)}</strong></li>
      </ul>
    </div>
    ${contactBlock()}
  </div>`);

// 6. RETRIEVED — vehicle returned, show full payment summary
const tplRetrieved = (d) => wrap(`
  ${hdr("linear-gradient(135deg,#0e7490,#0891b2)", "🔁", "Vehicle Retrieved", "The Rental Den — Final payment summary")}
  <div class="body">
    <p class="greeting">Dear ${d.customer_name},</p>
    <p class="intro">Your vehicle has been successfully <strong>retrieved</strong>. Thank you for choosing The Rental Den! Here is your complete payment summary.</p>
    ${bookingBlock(d)}
    ${paymentBlock(d)}
    ${payLogBlock(d.payment_log)}
    ${depositNote(d, "status")}
    <div class="note" style="background:#eff6ff;border-color:#93c5fd">
      <h4 style="color:#1d4ed8">⭐ We'd Love Your Feedback!</h4>
      <ul>
        <li>Once your booking is marked <strong>completed</strong>, you'll receive a direct link to rate and review your experience.</li>
        <li>Your feedback helps us serve you better!</li>
      </ul>
    </div>
    ${contactBlock()}
  </div>`);

// 7. COMPLETED — final receipt + star review CTA
const tplCompleted = (d) => {
  const reviewUrl = d.review_url || `https://therentalden.com/review?booking=${bookingId(d)}`;
  return wrap(`
  ${hdr("linear-gradient(135deg,#059669,#10b981)", "🏁", "Rental Completed!", "The Rental Den — Thank you for riding with us")}
  <div class="body">
    <p class="greeting">Dear ${d.customer_name},</p>
    <p class="intro">Your rental has been officially <strong>completed</strong>. It was a pleasure serving you! Below is your final receipt.</p>
    ${bookingBlock(d)}
    ${paymentBlock(d)}
    ${payLogBlock(d.payment_log)}
    ${depositNote(d, "status")}
    <div class="review-box">
      <div class="stars">⭐⭐⭐⭐⭐</div>
      <h3>How was your experience?</h3>
      <p>Take 1 minute to rate your ride and leave a review — it means the world to us and helps us keep improving!</p>
      <a href="${reviewUrl}" class="cta" style="background:#15803d">⭐ Rate &amp; Review Your Rental</a>
    </div>
    <div class="note" style="background:#f8fafc;border-color:#e2e8f0">
      <h4 style="color:#374151">🎉 Rent With Us Again!</h4>
      <ul>
        <li>We'd love to have you back. Contact us anytime to check availability.</li>
        <li>Follow us for exclusive deals and promotions.</li>
      </ul>
    </div>
    ${contactBlock()}
  </div>`);
};

// 8. CANCELLED
const tplCancelled = (d) => wrap(`
  ${hdr("linear-gradient(135deg,#991b1b,#ef4444)", "🚫", "Booking Cancelled", "The Rental Den — Cancellation Notice")}
  <div class="body">
    <p class="greeting">Dear ${d.customer_name},</p>
    <p class="intro">Your booking <strong>#${bookingId(d)}</strong> has been <strong>cancelled</strong>. We're sorry about this.</p>
    ${bookingBlock(d)}
    <div class="note" style="background:#fef2f2;border-color:#fca5a5">
      <h4 style="color:#dc2626">📋 Cancellation Details</h4>
      <ul>
        <li>Cancelled on: <strong>${fmtDateTime(new Date().toISOString())}</strong></li>
        ${d.decline_reason ? `<li>Reason: <strong>${d.decline_reason}</strong></li>` : ""}
        ${parseFloat(d.deposit_amount || 0) > 0 ? `<li>Any collected deposit will be refunded within <strong>3–5 business days</strong>.</li>` : ""}
        <li>Feel free to book again whenever you're ready!</li>
      </ul>
    </div>
    ${contactBlock()}
  </div>`);

// 9. DECLINED
const tplDeclined = (d) => wrap(`
  ${hdr("linear-gradient(135deg,#c2410c,#f97316)", "❌", "Booking Declined", "The Rental Den — Booking Not Approved")}
  <div class="body">
    <p class="greeting">Dear ${d.customer_name},</p>
    <p class="intro">We regret that your booking <strong>#${bookingId(d)}</strong> has been <strong>declined</strong>. We sincerely apologize for the inconvenience.</p>
    ${bookingBlock(d)}
    <div class="note" style="background:#fff7ed;border-color:#fdba74">
      <h4 style="color:#c2410c">📋 Reason for Decline</h4>
      <ul>
        <li>${d.decline_reason || "No specific reason provided. Please contact us for more information."}</li>
        ${parseFloat(d.deposit_amount || 0) > 0 ? `<li>Any collected deposit will be refunded within <strong>3–5 business days</strong>.</li>` : ""}
        <li>Please contact us to discuss alternatives or rebook.</li>
      </ul>
    </div>
    ${contactBlock()}
  </div>`);

// ─── Template Router ───────────────────────────────────────────────────────────
const getTemplate = (event, d) => {
  const ev = (event || "").toLowerCase().trim();
  const id = bookingId(d);
  const map = {
    pending:         { subject: `Booking Received #${id} – The Rental Den`,             html: tplPending(d)        },
    confirmed:       { subject: `✅ Booking Confirmed #${id} – The Rental Den`,          html: tplConfirmed(d)      },
    driver_assigned: { subject: `👨‍✈️ Driver Assigned – Booking #${id}`,               html: tplDriverAssigned(d) },
    ongoing:         { subject: `🚙 Your Vehicle is On Its Way! – #${id}`,              html: tplOngoing(d)        },
    delivered:       { subject: `📦 Vehicle Delivered – Booking #${id}`,                html: tplDelivered(d)      },
    retrieved:       { subject: `🔁 Vehicle Retrieved – Final Summary #${id}`,          html: tplRetrieved(d)      },
    completed:       { subject: `🏁 Rental Complete – Leave a Review! #${id}`,          html: tplCompleted(d)      },
    cancelled:       { subject: `🚫 Booking Cancelled #${id} – The Rental Den`,         html: tplCancelled(d)      },
    declined:        { subject: `❌ Booking Declined #${id} – The Rental Den`,          html: tplDeclined(d)       },
  };
  return map[ev] || map["pending"];
};

const sendMail = (to, subject, html) =>
  transporter.sendMail({ from: process.env.EMAIL_USER, to, subject, html });

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/send-booking-email
 * ─── Used by the WEBSITE (RentalModal submitBooking) ───────────────────────
 * Fires the "pending" (booking received) template.
 * Accepts the exact body the website already sends — no changes needed there.
 */
app.post("/api/send-booking-email", async (req, res) => {
  try {
    const d = req.body;
    if (!d.customer_email || !d.customer_name) {
      return res.status(400).json({ error: "Missing required booking data" });
    }
    const { subject, html } = getTemplate("pending", d);
    await sendMail(d.customer_email, subject, html);
    res.status(200).json({ success: true, message: "Confirmation email sent successfully" });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ success: false, error: "Failed to send email", details: err.message });
  }
});

/**
 * POST /api/send-status-update
 * ─── Used by the MOBILE APP (BookingsScreen) ──────────────────────────────
 * Fires the matching email template based on the `event` field.
 *
 * Required:  event, customer_email, customer_name
 * Optional:  all other booking fields (include as many as possible for
 *            full transparency in the email)
 *
 * event values:
 *   confirmed | driver_assigned | ongoing | delivered |
 *   retrieved | completed | cancelled | declined
 */
app.post("/api/send-status-update", async (req, res) => {
  try {
    const d = req.body;
    if (!d.customer_email) return res.status(400).json({ success: false, error: "Missing customer_email" });
    if (!d.event)          return res.status(400).json({ success: false, error: "Missing event field" });

    const { subject, html } = getTemplate(d.event, d);
    await sendMail(d.customer_email, subject, html);
    res.status(200).json({ success: true, message: `Email sent for event: ${d.event}` });
  } catch (err) {
    console.error("Email error:", err);
    res.status(500).json({ success: false, error: "Failed to send email", details: err.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "Email service is running", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Email service running on port ${PORT}`);
});