/**
 * Calculate the price of a booking.
 *
 * Rule:
 *  - total duration < 24h  -> billed hourly, rounded UP to the next hour
 *  - total duration >= 24h -> billed as (full days * daily_rate)
 *                             + (remaining hours, rounded up * hourly_rate)
 *
 * @param {Date|string} startTime
 * @param {Date|string} endTime
 * @param {number} hourlyRate
 * @param {number} dailyRate
 * @returns {number} total price, rounded to 2 decimal places
 */
function calculatePrice(startTime, endTime, hourlyRate, dailyRate) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end - start;

  if (durationMs <= 0) {
    throw new Error('end_time must be after start_time');
  }

  const durationHours = durationMs / (1000 * 60 * 60);

  let price;
  if (durationHours < 24) {
    const billedHours = Math.ceil(durationHours);
    price = billedHours * hourlyRate;
  } else {
    const fullDays = Math.floor(durationHours / 24);
    const remainderHours = Math.ceil(durationHours - fullDays * 24);
    price = fullDays * dailyRate + remainderHours * hourlyRate;
  }

  return Math.round(price * 100) / 100;
}

module.exports = { calculatePrice };
