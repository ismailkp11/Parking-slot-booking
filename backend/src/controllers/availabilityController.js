const slotModel = require('../models/slotModel');
const availabilityModel = require('../models/availabilityModel');

function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function dayRange(dateStr) { return { start: new Date(`${dateStr}T00:00:00.000Z`), end: new Date(`${dateStr}T23:59:59.999Z`) }; }

async function getDailyAvailability(req, res, next) {
  const { date } = req.query;
  if (!validDate(date)) return res.status(400).json({ error: 'A valid date query param (YYYY-MM-DD) is required' });
  try {
    const { start, end } = dayRange(date);
    const slots = await slotModel.findAll();
    const results = await Promise.all(slots.map(async slot => {
      const bookings = await availabilityModel.findBookingsForSlot(slot.id, start, end);
      return { ...slot, fully_booked_all_day: bookings.some(b => new Date(b.start_time) <= start && new Date(b.end_time) >= end), busy_windows: bookings };
    }));
    res.json({ date, slots: results });
  } catch (err) { next(err); }
}
async function getSlotAvailability(req, res, next) {
  const { date } = req.query;
  const slotId = Number(req.params.slotId);
  if (!Number.isInteger(slotId) || slotId < 1) return res.status(400).json({ error: 'slotId must be a positive integer' });
  if (!validDate(date)) return res.status(400).json({ error: 'A valid date query param (YYYY-MM-DD) is required' });
  try {
    const { start, end } = dayRange(date);
    const busyRows = await availabilityModel.findBookingsForSlot(slotId, start, end);
    const busy = busyRows.map(b => ({ start: new Date(b.start_time) < start ? start : new Date(b.start_time), end: new Date(b.end_time) > end ? end : new Date(b.end_time) }));
    const free = []; let cursor = start;
    for (const b of busy) { if (b.start > cursor) free.push({ start: cursor, end: b.start }); if (b.end > cursor) cursor = b.end; }
    if (cursor < end) free.push({ start: cursor, end });
    res.json({ slot_id: slotId, date, busy_windows: busy, free_windows: free });
  } catch (err) { next(err); }
}
module.exports = { getDailyAvailability, getSlotAvailability };
