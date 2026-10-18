const slotModel = require('../models/slotModel');
const bookingModel = require('../models/bookingModel');
const { calculatePrice } = require('../services/pricingService');
const { publishBookingConfirmation } = require('../services/notificationService');

async function createBooking(req, res, next) {
  const { slot_id, user_name, user_email, start_time, end_time } = req.body || {};
  if (!slot_id || !user_name || !user_email || !start_time || !end_time) return res.status(400).json({ error: 'slot_id, user_name, user_email, start_time, end_time are all required' });
  if (!Number.isInteger(Number(slot_id)) || Number(slot_id) < 1) return res.status(400).json({ error: 'slot_id must be a positive integer' });
  if (!/^\S+@\S+\.\S+$/.test(user_email)) return res.status(400).json({ error: 'A valid email address is required' });
  if (Number.isNaN(Date.parse(start_time)) || Number.isNaN(Date.parse(end_time)) || new Date(end_time) <= new Date(start_time)) return res.status(400).json({ error: 'Valid start_time and end_time are required; end_time must be after start_time' });
  try {
    const slot = await slotModel.findById(Number(slot_id));
    if (!slot) return res.status(404).json({ error: 'Parking slot not found' });
    const total_price = calculatePrice(start_time, end_time, Number(slot.hourly_rate), Number(slot.daily_rate));
    const booking = await bookingModel.create({ slot_id: Number(slot_id), user_name: user_name.trim(), user_email: user_email.trim(), start_time, end_time, total_price });
    try { await publishBookingConfirmation(booking, slot); } catch (notificationError) { console.error('SNS publish failed:', notificationError.message); }
    res.status(201).json({ booking, message: 'Booking confirmed' });
  } catch (err) { if (err.code === '23P01') return res.status(409).json({ error: 'This slot is already booked for the requested time range' }); next(err); }
}
async function getBooking(req, res, next) {
  try { const booking = await bookingModel.findById(req.params.id); if (!booking) return res.status(404).json({ error: 'Booking not found' }); res.json(booking); } catch (err) { next(err); }
}
async function cancelBooking(req, res, next) {
  try { const booking = await bookingModel.cancel(req.params.id); if (!booking) return res.status(404).json({ error: 'Booking not found' }); res.json({ message: 'Booking cancelled', booking }); } catch (err) { next(err); }
}
module.exports = { createBooking, getBooking, cancelBooking };
