const express = require('express');
const { getBooking, cancelBooking } = require('../controllers/bookingsController');
const router = express.Router();

// Prevent creating a confirmed reservation without verified payment.
// Paid bookings are created by the server only after Razorpay signature and
// captured-payment verification in /api/payments/verify-payment.
router.post('/', (_req, res) => res.status(403).json({ error: 'Bookings must be created through Razorpay checkout. Use POST /api/payments/create-order.' }));
router.get('/:id', getBooking);
router.delete('/:id', cancelBooking);
module.exports = router;
