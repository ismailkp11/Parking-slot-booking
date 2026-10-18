const pool = require('../config/database');
async function findAll() { const result = await pool.query("SELECT id, slot_number, location, hourly_rate, daily_rate FROM parking_slots WHERE status='active' ORDER BY slot_number"); return result.rows; }
async function findById(id) { const result = await pool.query("SELECT * FROM parking_slots WHERE id = $1 AND status='active'", [id]); return result.rows[0] || null; }
module.exports = { findAll, findById };
