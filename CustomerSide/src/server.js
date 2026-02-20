const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Create Nodemailer transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail', // or your preferred email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Use app password for Gmail
  },
});

// Test the transporter
transporter.verify((error, success) => {
  if (error) {
    console.log('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Email templates
const createCustomerEmailTemplate = (bookingData) => {
  const { 
    customer_name, 
    vehicle_info, 
    rental_start_date, 
    rental_end_date, 
    pickup_location, 
    total_price,
    booking_id 
  } = bookingData;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation - The Rental Den</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          background-color: #f8f9fa;
        }
        .container {
          background-color: #ffffff;
          padding: 0;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
        }
        .header p {
          margin: 10px 0 0 0;
          font-size: 16px;
          opacity: 0.9;
        }
        .content {
          padding: 30px;
        }
        .greeting {
          font-size: 18px;
          margin-bottom: 20px;
          color: #1f2937;
        }
        .booking-details {
          background-color: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          padding: 25px;
          margin: 25px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
          width: 40%;
        }
        .detail-value {
          color: #1f2937;
          width: 60%;
          text-align: right;
          font-weight: 500;
        }
        .total-price {
          background-color: #dcfce7;
          border: 2px solid #16a34a;
          border-radius: 8px;
          padding: 15px;
          text-align: center;
          margin: 20px 0;
        }
        .total-price .amount {
          font-size: 24px;
          font-weight: 700;
          color: #15803d;
        }
        .status-badge {
          display: inline-block;
          background-color: #fef3c7;
          color: #d97706;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .important-notes {
          background-color: #fef7ff;
          border-left: 4px solid #a855f7;
          padding: 20px;
          margin: 25px 0;
          border-radius: 0 8px 8px 0;
        }
        .important-notes h3 {
          color: #7c3aed;
          margin-top: 0;
          font-size: 16px;
        }
        .important-notes ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        .important-notes li {
          margin-bottom: 8px;
          color: #374151;
        }
        .contact-info {
          background-color: #f1f5f9;
          padding: 20px;
          border-radius: 8px;
          margin: 25px 0;
          text-align: center;
        }
        .contact-info h3 {
          color: #1e293b;
          margin-top: 0;
        }
        .footer {
          background-color: #1f2937;
          color: white;
          padding: 25px;
          text-align: center;
          font-size: 14px;
        }
        .footer a {
          color: #60a5fa;
          text-decoration: none;
        }
        .button {
          display: inline-block;
          background-color: #1f2937;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin: 15px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚗 The Rental Den</h1>
          <p>Your Booking Confirmation</p>
        </div>
        
        <div class="content">
          <div class="greeting">
            Dear <strong>${customer_name}</strong>,
          </div>
          
          <p>Thank you for choosing The Rental Den! We're excited to confirm your vehicle rental booking. Your reservation has been successfully submitted and is currently being processed.</p>
          
          <div class="booking-details">
            <h3 style="margin-top: 0; color: #1f2937; font-size: 20px;">📋 Booking Details</h3>
            
            <div class="detail-row">
              <span class="detail-label">Booking ID:</span>
              <span class="detail-value"><strong>#${booking_id}</strong></span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="detail-value"><span class="status-badge">Pending Confirmation</span></span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Vehicle:</span>
              <span class="detail-value"><strong>${vehicle_info}</strong></span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Pickup Date:</span>
              <span class="detail-value">${new Date(rental_start_date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Return Date:</span>
              <span class="detail-value">${new Date(rental_end_date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Pickup Location:</span>
              <span class="detail-value">${pickup_location}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Rental Duration:</span>
              <span class="detail-value">${Math.ceil((new Date(rental_end_date) - new Date(rental_start_date)) / (1000 * 60 * 60 * 24))} day(s)</span>
            </div>
          </div>
          
          <div class="total-price">
            <div style="color: #374151; margin-bottom: 5px;">Total Amount</div>
            <div class="amount">₱${total_price.toLocaleString()}</div>
          </div>
          
          <div class="important-notes">
            <h3>📌 Important Information</h3>
            <ul>
              <li><strong>Confirmation:</strong> Our team will contact you within 24 hours to confirm your booking and provide pickup instructions.</li>
              <li><strong>Documentation:</strong> Please bring a valid driver's license and a government-issued ID on pickup day.</li>
              <li><strong>Payment:</strong> Payment can be made upon pickup. We accept cash and major credit cards.</li>
              <li><strong>Cancellation:</strong> Free cancellation up to 24 hours before your pickup date.</li>
              <li><strong>Contact:</strong> For any questions or changes, please contact us immediately using the information below.</li>
            </ul>
          </div>
          
          <div class="contact-info">
            <h3>📞 Need Help?</h3>
            <p><strong>Phone:</strong> <a href="tel:+639123456789" style="color: #1f2937;">+63 912 345 6789</a></p>
            <p><strong>Email:</strong> <a href="mailto:info@therentalden.com" style="color: #1f2937;">info@therentalden.com</a></p>
            <p><strong>Business Hours:</strong> Monday - Sunday, 8:00 AM - 8:00 PM</p>
          </div>
          
          <p style="text-align: center; margin-top: 30px;">
            We look forward to serving you and making your journey memorable!
          </p>
        </div>
        
        <div class="footer">
          <p><strong>The Rental Den</strong><br>
          Your Premier Car Rental Service in Cebu<br>
          <a href="mailto:info@therentalden.com">info@therentalden.com</a> | <a href="tel:+639123456789">+63 912 345 6789</a></p>
          
          <p style="margin-top: 15px; font-size: 12px; opacity: 0.8;">
            This is an automated message. Please do not reply directly to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const createAdminEmailTemplate = (bookingData) => {
  const { 
    customer_name, 
    customer_email, 
    customer_phone, 
    vehicle_info, 
    rental_start_date, 
    rental_end_date, 
    pickup_location, 
    license_number,
    total_price,
    booking_id 
  } = bookingData;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Booking Alert - The Rental Den</title>
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          background-color: #f8f9fa;
        }
        .container {
          background-color: #ffffff;
          padding: 0;
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
          color: white;
          padding: 30px;
          text-align: center;
        }
        .content {
          padding: 30px;
        }
        .booking-details {
          background-color: #f8fafc;
          border: 2px solid #e2e8f0;
          border-radius: 10px;
          padding: 25px;
          margin: 25px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
        }
        .detail-label {
          font-weight: 600;
          color: #374151;
          width: 40%;
        }
        .detail-value {
          color: #1f2937;
          width: 60%;
          text-align: right;
          font-weight: 500;
        }
        .urgent {
          background-color: #fef2f2;
          border: 2px solid #dc2626;
          border-radius: 8px;
          padding: 15px;
          margin: 20px 0;
          text-align: center;
        }
        .footer {
          background-color: #374151;
          color: white;
          padding: 25px;
          text-align: center;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 New Booking Alert</h1>
          <p>The Rental Den - Admin Notification</p>
        </div>
        
        <div class="content">
          <div class="urgent">
            <strong>⚡ Action Required:</strong> New rental booking received and requires confirmation!
          </div>
          
          <div class="booking-details">
            <h3 style="margin-top: 0; color: #1f2937;">Customer Information</h3>
            
            <div class="detail-row">
              <span class="detail-label">Booking ID:</span>
              <span class="detail-value"><strong>#${booking_id}</strong></span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Customer Name:</span>
              <span class="detail-value">${customer_name}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span class="detail-value">${customer_email}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Phone:</span>
              <span class="detail-value">${customer_phone}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">License Number:</span>
              <span class="detail-value">${license_number}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Vehicle:</span>
              <span class="detail-value"><strong>${vehicle_info}</strong></span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Pickup Date:</span>
              <span class="detail-value">${new Date(rental_start_date).toLocaleDateString()}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Return Date:</span>
              <span class="detail-value">${new Date(rental_end_date).toLocaleDateString()}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Pickup Location:</span>
              <span class="detail-value">${pickup_location}</span>
            </div>
            
            <div class="detail-row">
              <span class="detail-label">Total Amount:</span>
              <span class="detail-value"><strong>₱${total_price.toLocaleString()}</strong></span>
            </div>
          </div>
          
          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>Contact the customer within 24 hours to confirm booking</li>
            <li>Verify vehicle availability for the requested dates</li>
            <li>Update booking status in the admin system</li>
            <li>Prepare vehicle for pickup if confirmed</li>
          </ul>
        </div>
        
        <div class="footer">
          <p>The Rental Den Admin System<br>
          <small>This is an automated notification from your booking system.</small></p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Send booking confirmation emails
app.post('/api/send-booking-emails', async (req, res) => {
  try {
    const bookingData = req.body;
    
    // Validate required fields
    const requiredFields = [
      'customer_name', 'customer_email', 'customer_phone', 
      'vehicle_info', 'rental_start_date', 'rental_end_date', 
      'pickup_location', 'license_number', 'total_price', 'booking_id'
    ];
    
    for (const field of requiredFields) {
      if (!bookingData[field]) {
        return res.status(400).json({ 
          success: false, 
          error: `Missing required field: ${field}` 
        });
      }
    }

    // Email to customer
    const customerMailOptions = {
      from: {
        name: 'The Rental Den',
        address: process.env.EMAIL_USER,
      },
      to: bookingData.customer_email,
      subject: `Booking Confirmation #${bookingData.booking_id} - The Rental Den`,
      html: createCustomerEmailTemplate(bookingData),
    };

    // Email to admin
    const adminMailOptions = {
      from: {
        name: 'The Rental Den System',
        address: process.env.EMAIL_USER,
      },
      to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER,
      subject: `🚨 New Booking Alert #${bookingData.booking_id} - Action Required`,
      html: createAdminEmailTemplate(bookingData),
    };

    // Send emails
    const customerEmailResult = await transporter.sendMail(customerMailOptions);
    const adminEmailResult = await transporter.sendMail(adminMailOptions);

    console.log('Customer email sent:', customerEmailResult.messageId);
    console.log('Admin email sent:', adminEmailResult.messageId);

    res.json({ 
      success: true, 
      message: 'Booking confirmation emails sent successfully',
      customerEmailId: customerEmailResult.messageId,
      adminEmailId: adminEmailResult.messageId
    });

  } catch (error) {
    console.error('Error sending emails:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send emails',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Email server is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Email server running on port ${PORT}`);
});