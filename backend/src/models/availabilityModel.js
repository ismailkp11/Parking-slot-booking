const pool = require('../config/database');

async function findBookingsForSlot(slotId, start, end) {
  const result = await pool.query(
    `SELECT start_time, end_time FROM bookings
     WHERE slot_id = $1 AND status IN ('confirmed','checked_in')
       AND start_time < $3 AND end_time > $2
     ORDER BY start_time`, [slotId, start, end]);
  return result.rows;
}
module.exports = { findBookingsForSlot };
