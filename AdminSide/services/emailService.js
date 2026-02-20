// emailService.js - Uses Firebase Cloud Functions (works in APK, no local server needed)
import { functions } from "./firebase";
import { httpsCallable } from "firebase/functions";

class EmailService {
  static async sendStatusUpdateEmail(booking, newStatus) {
    try {
      const emailData = {
        customer_email: booking.customer_email,
        customer_name: booking.customer_name,
        bookingId: booking.id,
        vehicleMake: booking.vehicles?.make || "Vehicle",
        vehicleModel: booking.vehicles?.model || "",
        vehicleYear: booking.vehicles?.year || "",
        variantColor: booking.vehicle_variants?.color || "",
        rental_start_date: booking.rental_start_date,
        rental_end_date: booking.rental_end_date,
        pickup_location: booking.pickup_location || "",
        total_price: parseFloat(booking.total_price || 0),
        newStatus,
        decline_reason: newStatus === "declined" ? booking.decline_reason || "" : null,
      };

      if (newStatus === "declined" && (!emailData.decline_reason || emailData.decline_reason.trim() === "")) {
        return { success: false, error: "Decline reason is required when status is declined" };
      }

      const sendEmail = httpsCallable(functions, "sendStatusUpdateEmail");
      const result = await sendEmail(emailData);
      if (result.data?.success) {
        return { success: true, message: "Email sent successfully" };
      }
      return { success: false, error: result.data?.error || "Unknown error" };
    } catch (error) {
      console.error("Email service error:", error);
      return { success: false, error: error?.message || "Email service unavailable" };
    }
  }

  static async checkEmailService() {
    return true;
  }
}

export default EmailService;
