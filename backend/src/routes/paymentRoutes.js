const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const slotModel = require('../models/slotModel');
const bookingModel = require('../models/bookingModel');
const { calculatePrice } = require('../services/pricingService');
const { publishBookingConfirmation } = require('../services/notificationService');

const router = express.Router();
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const razorpay = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;

function validateBookingInput(body = {}) {
  const { slot_id, user_name, user_email, start_time, end_time } = body;
  if (!slot_id || !user_name || !user_email || !start_time || !end_time) return 'slot_id, user_name, user_email, start_time and end_time are required.';
  if (!Number.isInteger(Number(slot_id)) || Number(slot_id) < 1) return 'Select a valid parking slot.';
  if (String(user_name).trim().length > 100 || !String(user_name).trim()) return 'Enter a valid name (maximum 100 characters).';
  if (String(user_email).length > 150 || !/^\S+@\S+\.\S+$/.test(String(user_email).trim())) return 'Enter a valid email address.';
  if (Number.isNaN(Date.parse(start_time)) || Number.isNaN(Date.parse(end_time)) || new Date(end_time) <= new Date(start_time)) return 'Choose valid start and end times; the end must be after the start.';
  return null;
}

router.get('/config', (_req, res) => {
  if (!keyId || !keySecret) return res.status(503).json({ configured: false, error: 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in backend/.env.' });
  res.json({ configured: true, keyId, mode: keyId.startsWith('rzp_test_') ? 'test' : 'live' });
});

// Create an order using server-calculated pricing. Never trust the browser's amount.
router.post('/create-order', async (req, res) => {
  try {
    if (!razorpay) return res.status(503).json({ error: 'Razorpay is not configured. Add your test keys to backend/.env and restart the backend.' });
    const validationError = validateBookingInput(req.body);
    if (validationError) return res.status(400).json({ error: validationError });
    const { slot_id, user_name, user_email, start_time, end_time } = req.body;
    const slot = await slotModel.findById(Number(slot_id));
    if (!slot) return res.status(404).json({ error: 'Parking slot not found.' });
    if (slot.status && slot.status !== 'active') return res.status(409).json({ error: 'This parking slot is not active.' });
    const total = calculatePrice(start_time, end_time, Number(slot.hourly_rate), Number(slot.daily_rate));
    const amount = Math.round(total * 100);
    if (!Number.isSafeInteger(amount) || amount < 100) return res.status(400).json({ error: 'The payment amount must be at least ₹1.00.' });
    const order = await razorpay.orders.create({
      amount, currency: 'INR', receipt: `park_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      notes: {
        slot_id: String(slot.id), user_name: String(user_name).trim(), user_email: String(user_email).trim(),
        start_time: new Date(start_time).toISOString(), end_time: new Date(end_time).toISOString()
      }
    });
    res.status(201).json({ keyId, orderId: order.id, amount: order.amount, currency: order.currency, bookingAmount: total, slotNumber: slot.slot_number });
  } catch (error) {
    console.error('Razorpay create-order failed:', error.message);
    res.status(500).json({ error: 'Could not create a Razorpay order. Check backend logs and your test-mode credentials.' });
  }
});

router.post('/verify-payment', async (req, res) => {
  try {
    if (!razorpay) return res.status(503).json({ verified: false, error: 'Razorpay is not configured on the server.' });
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return res.status(400).json({ verified: false, error: 'Missing Razorpay verification fields.' });

    const order = await razorpay.orders.fetch(razorpay_order_id);
    const expectedSignature = crypto.createHmac('sha256', keySecret).update(`${order.id}|${razorpay_payment_id}`).digest();
    let receivedSignature;
    try { receivedSignature = Buffer.from(razorpay_signature, 'hex'); } catch (_) { receivedSignature = Buffer.alloc(0); }
    if (expectedSignature.length !== receivedSignature.length || !crypto.timingSafeEqual(expectedSignature, receivedSignature)) {
      return res.status(400).json({ verified: false, error: 'Payment signature is invalid.' });
    }

    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    if (payment.order_id !== order.id || payment.amount !== order.amount || payment.currency !== order.currency) {
      return res.status(400).json({ verified: false, error: 'Payment does not match the Razorpay order.' });
    }
    if (payment.status !== 'captured') return res.status(409).json({ verified: false, paymentStatus: payment.status, error: 'Payment has not been captured. If it is authorised, wait briefly and retry or check Razorpay Dashboard.' });

    const n = order.notes || {};
    const input = { slot_id: Number(n.slot_id), user_name: n.user_name, user_email: n.user_email, start_time: n.start_time, end_time: n.end_time };
    const validationError = validateBookingInput(input);
    if (validationError) return res.status(400).json({ verified: false, error: 'The order does not contain valid booking details.' });
    const slot = await slotModel.findById(input.slot_id);
    if (!slot) return res.status(404).json({ verified: false, error: 'Parking slot no longer exists. Contact support about this payment.' });
    const total = calculatePrice(input.start_time, input.end_time, Number(slot.hourly_rate), Number(slot.daily_rate));
    if (Math.round(total * 100) !== order.amount) return res.status(400).json({ verified: false, error: 'The slot price changed after the order was created. Contact support before retrying.' });

    // payment_id has a unique constraint in the supplied migration, making retries idempotent.
    let booking;
    try {
      booking = await bookingModel.findByPaymentId(razorpay_payment_id);
      if (!booking) booking = await bookingModel.create({ ...input, total_price: total, razorpay_payment_id: razorpay_payment_id });
    } catch (error) {
      if (error.code === '23P01') return res.status(409).json({ verified: false, paid: true, error: 'Payment was captured, but this slot was booked by someone else before confirmation. Contact the parking administrator for a refund.' });
      if (error.code === '23505') booking = await bookingModel.findByPaymentId(razorpay_payment_id);
      else throw error;
    }
    if (!booking) throw new Error('Could not locate the booking created for this payment.');
    try { await publishBookingConfirmation(booking, slot); } catch (e) { console.error('Booking notification failed:', e.message); }
    res.json({ verified: true, paymentId: payment.id, orderId: order.id, booking, message: 'Payment verified and parking booking confirmed.' });
  } catch (error) {
    console.error('Razorpay verification failed:', error.message);
    res.status(500).json({ verified: false, error: 'Unable to verify payment or confirm booking. Check backend logs; do not pay again until you check the Razorpay Dashboard.' });
  }
});

module.exports = router;
