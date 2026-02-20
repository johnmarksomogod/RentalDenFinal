import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
console.log("Loaded ENV:", process.env.EMAIL_USER, process.env.EMAIL_PASS ? "PASS_SET" : "PASS_MISSING");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create transporter for nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail", // or your email service
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASS  // Your app password
  }
});

const formatDateTime = (value) => {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
};

const renderContractSection = (bookingData) => {
  if (!bookingData.contractText) return "";

  const paragraphs = bookingData.contractText
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");

  return `
    <div class="contract-section">
      <h3>Signed Contract</h3>
      ${paragraphs}
      <div class="signature-block">
        <p><strong>Signed by:</strong> ${bookingData.contractSignedName || "Not provided"}</p>
        ${
          bookingData.contractSignedAt
            ? `<p><strong>Signed on:</strong> ${formatDateTime(bookingData.contractSignedAt)}</p>`
            : ""
        }
      </div>
    </div>
  `;
};

// Email template
const createBookingConfirmationEmail = (bookingData) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Booking Confirmation - The Rental Den</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #101010; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
            .footer { background: #101010; color: white; padding: 15px; text-align: center; }
            .status-pending { color: #f59e0b; font-weight: bold; }
            .contract-section { background: #fff7ed; border: 1px solid #fed7aa; padding: 20px; border-radius: 10px; margin: 20px 0; }
            .contract-section h3 { margin-top: 0; color: #b45309; }
            .contract-section p { margin-bottom: 12px; color: #78350f; }
            .signature-block { margin-top: 12px; padding-top: 12px; border-top: 1px solid #fed7aa; font-size: 14px; color: #7c2d12; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>The Rental Den</h1>
                <h2>Booking Confirmation</h2>
            </div>
            
            <div class="content">
                <p>Dear ${bookingData.customer_name},</p>
                
                <p>Thank you for your booking request! We have successfully received your reservation and it is currently being processed.</p>
                
                <div class="booking-details">
                    <h3>Booking Details:</h3>
                    <p><strong>Vehicle:</strong> ${bookingData.vehicleMake} ${bookingData.vehicleModel} (${bookingData.vehicleYear})</p>
                    <p><strong>Color:</strong> ${bookingData.variantColor || 'Standard'}</p>
                    <p><strong>Pickup Date:</strong> ${new Date(bookingData.rental_start_date).toLocaleDateString()}</p>
                    <p><strong>Return Date:</strong> ${new Date(bookingData.rental_end_date).toLocaleDateString()}</p>
                    <p><strong>Pickup Location:</strong> ${bookingData.pickup_location}</p>
                    <p><strong>Total Price:</strong> ₱${bookingData.total_price.toLocaleString()}</p>
                    <p><strong>Status:</strong> <span class="status-pending">Pending Confirmation</span></p>
                </div>
                
                <p><strong>Next Steps:</strong></p>
                <ul>
                    <li>Our team will review your booking within 24 hours</li>
                    <li>You will receive a confirmation email once approved</li>
                    <li>Please have your driver's license and ID ready for pickup</li>
                </ul>

                ${renderContractSection(bookingData)}
                
                <p>If you have any questions, please don't hesitate to contact us at:</p>
                <p>📞 +63 900 000 0000<br>
                📧 hello@rentalden.com</p>
            </div>
            
            <div class="footer">
                <p>&copy; 2024 The Rental Den. All rights reserved.</p>
                <p>Cebu City, Philippines</p>
            </div>
        </div>
    </body>
    </html>
  `;
};

// Email endpoint
app.post("/api/send-booking-email", async (req, res) => {
  try {
    const bookingData = req.body;
    
    // Validate required data
    if (!bookingData.customer_email || !bookingData.customer_name) {
      return res.status(400).json({ error: "Missing required booking data" });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: bookingData.customer_email,
      subject: `Booking Confirmation - The Rental Den (#${bookingData.bookingId || "TBD"})`,
      html: createBookingConfirmationEmail(bookingData),
    };

    // Send email
    await transporter.sendMail(mailOptions);
    
    res.status(200).json({ 
      success: true, 
      message: "Confirmation email sent successfully" 
    });
    
  } catch (error) {
    console.error("Email sending error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to send email",
      details: error.message 
    });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "Email service is running" });
});

app.listen(PORT, () => {
  console.log(`Email service running on port ${PORT}`);
});
