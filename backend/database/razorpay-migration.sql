-- Run once against an existing ParkEase PostgreSQL database before using Razorpay.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_razorpay_payment_id
  ON bookings (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
