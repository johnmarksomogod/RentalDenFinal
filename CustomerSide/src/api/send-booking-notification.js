// pages/api/send-booking-notification.js or app/api/send-booking-notification/route.js

import nodemailer from 'nodemailer';

// Create transporter (configure with your email provider)
const transporter = nodemailer.createTransport({
  // Gmail configuration
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS, // Your app password
  },
  // Or for other providers:
  // host: 'smtp.your-email-provider.com',
  // port: 587,
  // secure: false,
  // auth: {
  //   user: process.env.EMAIL_USER,
  //   pass: process.env.EMAIL_PASS,
  // },
});

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const getPickupLocationName = (location) => {
  const locations = {
    'cebu-airport': 'Cebu Airport',
    'cebu-city-center': 'Cebu City Center',
    'lahug-area': 'Lahug Business District',
    'it-park': 'Cebu IT Park',
    'ayala-center': 'Ayala Center Cebu',
    'sm-cebu': 'SM City Cebu'
  };
  return locations[location] || location;
};

export default async function handler(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ message: "Method not allowed" });
    }
  
    try {
      const { booking, vehicle, customer } = req.body;
  
      await transporter.sendMail({
        from: `"The Rental Den" <${process.env.EMAIL_USER}>`,
        to: customer.email,
        subject: `Booking Confirmation - ${vehicle.make} ${vehicle.model}`,
        html: customerEmailHTML, // (your existing template)
      });
  
      await transporter.sendMail({
        from: `"The Rental Den" <${process.env.EMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
        subject: `New Booking: ${customer.name} - ${vehicle.make} ${vehicle.model}`,
        html: adminEmailHTML, // (your existing template)
      });
  
      return res.status(200).json({ message: "Emails sent successfully" });
    } catch (error) {
      console.error("Email sending error:", error);
      return res.status(500).json({ message: "Failed to send emails", error: error.message });
    }
  }
  