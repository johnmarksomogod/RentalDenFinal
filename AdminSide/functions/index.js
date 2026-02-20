/**
 * Firebase Cloud Functions - runs in the cloud, no local server needed.
 * Email works in APK and production.
 *
 * Setup: Run once before deploy:
 *   firebase functions:config:set email.user="your@gmail.com" email.pass="your-app-password"
 *   cd functions && npm install && cd .. && firebase deploy --only functions
 */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();

// ---------- createAppUser ----------
exports.createAppUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Not logged in"
    );
  }

  const ownerUid = context.auth.uid;
  const { email, password, full_name, contact_number, role, status } = data;

  if (!email || !password || !role) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields"
    );
  }

  try {
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: full_name,
    });

    await admin
      .firestore()
      .collection("app_users")
      .doc(userRecord.uid)
      .set({
        full_name,
        email,
        contact_number: contact_number || null,
        role,
        status: status || "active",
        owner_uid: ownerUid,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError("internal", error.message);
  }
});

// ---------- Email helpers ----------
function getNodemailerTransporter() {
  const config = functions.config().email || {};
  const user = config.user || process.env.EMAIL_USER;
  const pass = config.pass || process.env.EMAIL_PASS;
  if (!user || !pass) {
    throw new Error("Email config missing. Run: firebase functions:config:set email.user=\"...\" email.pass=\"...\"");
  }
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

function getStatusInfo(status) {
  const map = {
    pending: { color: "#f59e0b", message: "Your booking is being reviewed by our team.", title: "Booking Under Review" },
    confirmed: { color: "#10b981", message: "Great! Your booking has been confirmed and your vehicle is reserved.", title: "Booking Confirmed" },
    completed: { color: "#3b82f6", message: "Thank you for choosing The Rental Den! We hope you had a great experience.", title: "Booking Completed" },
    cancelled: { color: "#ef4444", message: "Your booking has been cancelled. If you have any questions, please contact us.", title: "Booking Cancelled" },
    declined: { color: "#ef4444", message: "Unfortunately, we are unable to process your booking request at this time.", title: "Booking Declined" },
  };
  return map[status] || { color: "#6b7280", message: "Your booking status has been updated.", title: "Booking Update" };
}

function createStatusUpdateEmailHtml(d) {
  const si = getStatusInfo(d.newStatus);
  const declineBlock = d.newStatus === "declined" && d.decline_reason
    ? `<div class="decline-reason"><h4>Reason for Decline:</h4><p>${d.decline_reason}</p></div>`
    : "";
  const confirmedBlock = d.newStatus === "confirmed"
    ? `<div class="highlight"><p><strong>Next Steps:</strong></p><ul><li>Please arrive 15 minutes before pickup</li><li>Bring your driver's license and valid ID</li><li>Balance should be settled before you can use the car</li></ul></div>`
    : "";
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>${si.title}</title>
<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#101010;color:white;padding:20px;text-align:center}.content{padding:20px;background:#f9f9f9}.booking-details{background:white;padding:15px;margin:15px 0;border-radius:5px}.status-update{background:${si.color}20;border-left:4px solid ${si.color};padding:15px;margin:15px 0;border-radius:5px}.decline-reason{background:#fef2f2;border:1px solid #fecaca;padding:15px;margin:15px 0;border-radius:5px}.footer{background:#101010;color:white;padding:15px;text-align:center}.status-badge{color:${si.color};font-weight:bold;text-transform:uppercase}.highlight{background:#fffbeb;padding:10px;border-radius:5px;margin:10px 0}</style></head><body>
<div class="container"><div class="header"><h1>The Rental Den</h1><h2>${si.title}</h2></div>
<div class="content"><p>Dear ${d.customer_name},</p>
<div class="status-update"><h3>Status Update</h3><p><strong>Your booking status has been updated to: <span class="status-badge">${d.newStatus}</span></strong></p><p>${si.message}</p></div>
${declineBlock}
<div class="booking-details"><h3>Booking Details:</h3><p><strong>Booking ID:</strong> #${d.bookingId}</p><p><strong>Vehicle:</strong> ${d.vehicleMake} ${d.vehicleModel} (${d.vehicleYear})</p><p><strong>Pickup Date:</strong> ${new Date(d.rental_start_date).toLocaleDateString()}</p><p><strong>Return Date:</strong> ${new Date(d.rental_end_date).toLocaleDateString()}</p><p><strong>Pickup Location:</strong> ${d.pickup_location || ""}</p><p><strong>Total Price:</strong> ₱${Number(d.total_price || 0).toLocaleString()}</p></div>
${confirmedBlock}
<p>Best regards,<br>The Rental Den Team</p></div>
<div class="footer"><p>&copy; 2024 The Rental Den. Cebu City, Philippines</p></div></div></body></html>`;
}

function createBookingConfirmationEmailHtml(d) {
  const contractSection = d.contractText
    ? `<div class="contract-section"><h3>Signed Contract</h3><p>${d.contractText.replace(/\n/g, "<br>")}</p><p><strong>Signed by:</strong> ${d.contractSignedName || "N/A"}</p></div>`
    : "";
  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Booking Confirmation</title>
<style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background:#101010;color:white;padding:20px;text-align:center}.content{padding:20px;background:#f9f9f9}.booking-details{background:white;padding:15px;margin:15px 0;border-radius:5px}.footer{background:#101010;color:white;padding:15px;text-align:center}.status-pending{color:#f59e0b;font-weight:bold}.contract-section{background:#fff7ed;border:1px solid #fed7aa;padding:20px;border-radius:10px;margin:20px 0}</style></head><body>
<div class="container"><div class="header"><h1>The Rental Den</h1><h2>Booking Confirmation</h2></div>
<div class="content"><p>Dear ${d.customer_name},</p>
<p>Thank you for your booking request! We have successfully received your reservation and it is currently being processed.</p>
<div class="booking-details"><h3>Booking Details:</h3><p><strong>Vehicle:</strong> ${d.vehicleMake} ${d.vehicleModel} (${d.vehicleYear})</p><p><strong>Color:</strong> ${d.variantColor || "Standard"}</p><p><strong>Pickup Date:</strong> ${new Date(d.rental_start_date).toLocaleDateString()}</p><p><strong>Return Date:</strong> ${new Date(d.rental_end_date).toLocaleDateString()}</p><p><strong>Pickup Location:</strong> ${d.pickup_location || ""}</p><p><strong>Total Price:</strong> ₱${Number(d.total_price || 0).toLocaleString()}</p><p><strong>Status:</strong> <span class="status-pending">Pending Confirmation</span></p></div>
<p><strong>Next Steps:</strong></p><ul><li>Our team will review your booking within 24 hours</li><li>You will receive a confirmation email once approved</li></ul>
${contractSection}
<p>Best regards,<br>The Rental Den Team</p></div>
<div class="footer"><p>&copy; 2024 The Rental Den. Cebu City, Philippines</p></div></div></body></html>`;
}

// ---------- sendStatusUpdateEmail (Admin/Driver - requires auth) ----------
exports.sendStatusUpdateEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Not logged in");
  }
  const { customer_email, customer_name, bookingId, vehicleMake, vehicleModel, vehicleYear, variantColor, rental_start_date, rental_end_date, pickup_location, total_price, newStatus, decline_reason } = data;
  if (!customer_email || !customer_name || !newStatus) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
  }
  if (newStatus === "declined" && !decline_reason) {
    throw new functions.https.HttpsError("invalid-argument", "Decline reason is required");
  }
  try {
    const transporter = getNodemailerTransporter();
    const config = functions.config().email || {};
    const from = config.user || process.env.EMAIL_USER;
    const si = getStatusInfo(newStatus);
    await transporter.sendMail({
      from,
      to: customer_email,
      subject: `${si.title} - The Rental Den (#${bookingId})`,
      html: createStatusUpdateEmailHtml({ ...data, vehicleMake: vehicleMake || "Vehicle", vehicleModel: vehicleModel || "", vehicleYear: vehicleYear || "" }),
    });
    return { success: true };
  } catch (err) {
    console.error("sendStatusUpdateEmail error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});

// ---------- sendBookingConfirmationEmail (Customer - no auth required) ----------
exports.sendBookingConfirmationEmail = functions.https.onCall(async (data, context) => {
  const { customer_email, customer_name, bookingId, vehicleMake, vehicleModel, vehicleYear, variantColor, rental_start_date, rental_end_date, pickup_location, total_price, contractText, contractSignedName, contractSignedAt } = data;
  if (!customer_email || !customer_name) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
  }
  try {
    const transporter = getNodemailerTransporter();
    const config = functions.config().email || {};
    const from = config.user || process.env.EMAIL_USER;
    await transporter.sendMail({
      from,
      to: customer_email,
      subject: `Booking Confirmation - The Rental Den (#${bookingId || "TBD"})`,
      html: createBookingConfirmationEmailHtml(data),
    });
    return { success: true };
  } catch (err) {
    console.error("sendBookingConfirmationEmail error:", err);
    throw new functions.https.HttpsError("internal", err.message);
  }
});
