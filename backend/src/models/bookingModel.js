const pool = require('../config/database');

async function create({ slot_id, user_name, user_email, start_time, end_time, total_price, razorpay_payment_id = null }) {
  const result = await pool.query(
    `INSERT INTO bookings (slot_id, user_name, user_email, start_time, end_time, total_price, status, razorpay_payment_id)
     VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7) RETURNING *`,
    [slot_id, user_name, user_email, start_time, end_time, total_price, razorpay_payment_id]);
  return result.rows[0];
}
async function findByPaymentId(paymentId) {
  const result = await pool.query('SELECT * FROM bookings WHERE razorpay_payment_id = $1', [paymentId]);
  return result.rows[0] || null;
}
async function findById(id) {
  const result = await pool.query('SELECT * FROM bookings WHERE id = $1', [id]);
  return result.rows[0] || null;
}
async function cancel(id) {
  const result = await pool.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING *", [id]);
  return result.rows[0] || null;
}
module.exports = { create, findById, findByPaymentId, cancel };
