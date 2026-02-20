import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Create transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Helpers
const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const getPickupLocationName = (location) => {
  const locations = {
    "cebu-airport": "Cebu Airport",
    "cebu-city-center": "Cebu City Center",
    "lahug-area": "Lahug Business District",
    "it-park": "Cebu IT Park",
    "ayala-center": "Ayala Center Cebu",
    "sm-cebu": "SM City Cebu",
  };
  return locations[location] || location;
};

app.post("/api/send-booking-notification", async (req, res) => {
  try {
    const { booking, vehicle, customer } = req.body;

    // build your HTML templates here (customerEmailHTML, adminEmailHTML)
    const customerEmailHTML = `<p>Dear ${customer.name}, your booking for ${vehicle.make} ${vehicle.model} is received.</p>`;
    const adminEmailHTML = `<p>New booking by ${customer.name} for ${vehicle.make} ${vehicle.model}.</p>`;

    // Send to customer
    await transporter.sendMail({
      from: `"The Rental Den" <${process.env.EMAIL_USER}>`,
      to: customer.email,
      subject: `Booking Confirmation - ${vehicle.make} ${vehicle.model}`,
      html: customerEmailHTML,
    });

    // Send to admin
    await transporter.sendMail({
      from: `"The Rental Den" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: `New Booking: ${customer.name} - ${vehicle.make} ${vehicle.model}`,
      html: adminEmailHTML,
    });

    res.status(200).json({ message: "Emails sent successfully" });
  } catch (error) {
    console.error("Email sending error:", error);
    res
      .status(500)
      .json({ message: "Failed to send emails", error: error.message });
  }
});

app.listen(5000, () =>
  console.log("Server running on http://localhost:5000")
);
