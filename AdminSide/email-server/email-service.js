import express from "express";
import nodemailer from "nodemailer";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 80; // Different port from your main server

// Middleware
app.use(cors());
app.use(express.json());

// Create transporter for nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Status colors and messages
const getStatusInfo = (status) => {
  switch(status) {
    case 'pending':
      return {
        color: '#f59e0b',
        message: 'Your booking is being reviewed by our team.',
        title: 'Booking Under Review'
      };
    case 'confirmed':
      return {
        color: '#10b981',
        message: 'Great! Your booking has been confirmed and your vehicle is reserved.',
        title: 'Booking Confirmed'
      };
    case 'completed':
      return {
        color: '#3b82f6',
        message: 'Thank you for choosing The Rental Den! We hope you had a great experience.',
        title: 'Booking Completed'
      };
    case 'cancelled':
      return {
        color: '#ef4444',
        message: 'Your booking has been cancelled. If you have any questions, please contact us.',
        title: 'Booking Cancelled'
      };
    case 'declined':
      return {
        color: '#ef4444',
        message: 'Unfortunately, we are unable to process your booking request at this time.',
        title: 'Booking Declined'
      };
    default:
      return {
        color: '#6b7280',
        message: 'Your booking status has been updated.',
        title: 'Booking Update'
      };
  }
};

// Email template for status updates
const createStatusUpdateEmail = (bookingData) => {
  const statusInfo = getStatusInfo(bookingData.newStatus);
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${statusInfo.title} - The Rental Den</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #101010; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .booking-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
            .status-update { background: ${statusInfo.color}20; border-left: 4px solid ${statusInfo.color}; padding: 15px; margin: 15px 0; border-radius: 5px; }
            .decline-reason { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; margin: 15px 0; border-radius: 5px; }
            .footer { background: #101010; color: white; padding: 15px; text-align: center; }
            .status-badge { color: ${statusInfo.color}; font-weight: bold; text-transform: uppercase; }
            .highlight { background: #fffbeb; padding: 10px; border-radius: 5px; margin: 10px 0; }
            .important-notes { background: #f0f9ff; border: 1px solid #bfdbfe; padding: 15px; margin: 15px 0; border-radius: 5px; }
            .important-notes h4 { margin-top: 0; color: #1e40af; }
            .important-notes ul { margin-bottom: 0; }
            .important-notes li { margin-bottom: 5px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>The Rental Den</h1>
                <h2>${statusInfo.title}</h2>
            </div>
            
            <div class="content">
                <p>Dear ${bookingData.customer_name},</p>
                
                <div class="status-update">
                    <h3>Status Update</h3>
                    <p><strong>Your booking status has been updated to: <span class="status-badge">${bookingData.newStatus}</span></strong></p>
                    <p>${statusInfo.message}</p>
                </div>

                ${bookingData.newStatus === 'declined' && bookingData.decline_reason ? `
                <div class="decline-reason">
                    <h4>Reason for Decline:</h4>
                    <p>${bookingData.decline_reason}</p>
                    <p><em>We apologize for any inconvenience. Please feel free to contact us if you have any questions or would like to discuss alternative options.</em></p>
                </div>
                ` : ''}
                
                <div class="booking-details">
                    <h3>Booking Details:</h3>
                    <p><strong>Booking ID:</strong> #${bookingData.bookingId}</p>
                    <p><strong>Vehicle:</strong> ${bookingData.vehicleMake} ${bookingData.vehicleModel} (${bookingData.vehicleYear})</p>
                    ${bookingData.variantColor ? `<p><strong>Color:</strong> ${bookingData.variantColor}</p>` : ''}
                    <p><strong>Pickup Date:</strong> ${new Date(bookingData.rental_start_date).toLocaleDateString()}</p>
                    <p><strong>Return Date:</strong> ${new Date(bookingData.rental_end_date).toLocaleDateString()}</p>
                    <p><strong>Pickup Location:</strong> ${bookingData.pickup_location}</p>
                    <p><strong>Total Price:</strong> ₱${bookingData.total_price.toLocaleString()}</p>
                    <p><strong>Updated:</strong> ${new Date(bookingData.updated_date).toLocaleDateString()}</p>
                </div>

                ${bookingData.newStatus === 'confirmed' ? `
                <div class="highlight">
                    <p><strong>Next Steps for Confirmed Booking:</strong></p>
                    <ul>
                        <li>Please arrive 15 minutes before your pickup time</li>
                        <li>Bring your driver's license and valid ID</li>
                        <li>Our team will contact you 24 hours before pickup</li>
                        <li>Vehicle inspection will be conducted before handover</li>
                        <li><strong>Balance should be settled before you can use the car</strong></li>
                    </ul>
                </div>

                <div class="important-notes">
                    <h4>Important Rental Guidelines:</h4>
                    <ul>
                        <li><strong>Fuel Level:</strong> The fuel level must be the same when you return the vehicle as it was when you picked it up</li>
                        <li><strong>Extended Hours:</strong> Every extended hour beyond the agreed return time will incur a charge of ₱300</li>
                        <li><strong>Delivery Service:</strong> If you prefer vehicle delivery, we offer delivery within 5km from our garage for ₱250</li>
                        <li><strong>Payment:</strong> Balance should be settled before you can use the car</li>
                    </ul>
                </div>
                ` : ''}
                
                ${bookingData.newStatus === 'completed' ? `
                <div class="highlight">
                    <p><strong>Thank you for choosing us!</strong></p>
                    <ul>
                        <li>We hope you enjoyed your rental experience</li>
                        <li>Please rate your experience (link coming soon)</li>
                        <li>Look forward to serving you again!</li>
                    </ul>
                </div>

                <div class="important-notes">
                    <h4>Rental Guidelines Reminder:</h4>
                    <ul>
                        <li>We hope the fuel level was returned as per pickup condition</li>
                        <li>Thank you for adhering to the return schedule</li>
                        <li>Any additional charges for extended hours will be processed separately if applicable</li>
                    </ul>
                </div>
                ` : ''}
                
                ${bookingData.newStatus === 'cancelled' ? `
                <div class="highlight">
                    <p><strong>Cancellation Information:</strong></p>
                    <ul>
                        <li>Your booking has been successfully cancelled</li>
                        <li>Refund processing will begin within 3-5 business days</li>
                        <li>You will receive a separate email about refund status</li>
                    </ul>
                </div>
                ` : ''}

                ${bookingData.newStatus === 'declined' ? `
                <div class="highlight">
                    <p><strong>What happens next:</strong></p>
                    <ul>
                        <li>No charges will be applied to your account</li>
                        <li>You're welcome to submit a new booking request</li>
                        <li>Contact us if you'd like to discuss alternative vehicle options</li>
                        <li>We appreciate your understanding and interest in our services</li>
                    </ul>
                </div>
                ` : ''}

                ${bookingData.newStatus === 'pending' ? `
                <div class="important-notes">
                    <h4>While You Wait - Important Information:</h4>
                    <ul>
                        <li><strong>Payment:</strong> Balance should be settled before you can use the car</li>
                        <li><strong>Fuel Policy:</strong> Vehicle must be returned with the same fuel level as pickup</li>
                        <li><strong>Extended Hours:</strong> ₱300 charge applies for every hour beyond agreed return time</li>
                        <li><strong>Delivery Option:</strong> Available within 5km from garage for ₱250</li>
                    </ul>
                </div>
                ` : ''}
                
                <p>If you have any questions about this update, please don't hesitate to contact us at:</p>
                <p>Phone: +63 900 000 0000<br>
                Email: hello@rentalden.com</p>
                
                <p>Best regards,<br>The Rental Den Team</p>
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

// Status update email endpoint
app.post("/api/send-status-email", async (req, res) => {
  try {
    const bookingData = req.body;
    
    // Validate required data
    if (!bookingData.customer_email || !bookingData.customer_name || !bookingData.newStatus) {
      return res.status(400).json({ error: "Missing required booking data" });
    }

    // Validate decline reason if status is declined
    if (bookingData.newStatus === 'declined' && !bookingData.decline_reason) {
      return res.status(400).json({ error: "Decline reason is required when status is declined" });
    }

    const statusInfo = getStatusInfo(bookingData.newStatus);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: bookingData.customer_email,
      subject: `${statusInfo.title} - The Rental Den (#${bookingData.bookingId})`,
      html: createStatusUpdateEmail(bookingData),
    };

    // Send email
    await transporter.sendMail(mailOptions);
    
    res.status(200).json({ 
      success: true, 
      message: "Status update email sent successfully" 
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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Email service running on port ${PORT}`);
});