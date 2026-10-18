-- Parking Slot Booking System — schema for RDS PostgreSQL

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS parking_slots (
    id            SERIAL PRIMARY KEY,
    slot_number   VARCHAR(20) NOT NULL UNIQUE,
    location      VARCHAR(100) NOT NULL,
    hourly_rate   NUMERIC(10,2) NOT NULL CHECK (hourly_rate >= 0),
    daily_rate    NUMERIC(10,2) NOT NULL CHECK (daily_rate >= 0),
    status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','inactive')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
    id            SERIAL PRIMARY KEY,
    slot_id       INTEGER NOT NULL REFERENCES parking_slots(id),
    user_name     VARCHAR(100) NOT NULL,
    user_email    VARCHAR(150) NOT NULL,
    start_time    TIMESTAMPTZ NOT NULL,
    end_time      TIMESTAMPTZ NOT NULL,
    total_price   NUMERIC(10,2) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed', 'cancelled', 'checked_in', 'checked_out')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CHECK (end_time > start_time)
);

-- Strict overlap prevention at the database level: no two active
-- bookings for the same slot may have overlapping time ranges.
ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS no_overlapping_bookings;

ALTER TABLE bookings
  ADD CONSTRAINT no_overlapping_bookings
  EXCLUDE USING gist (
    slot_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status IN ('confirmed','checked_in'));

CREATE INDEX IF NOT EXISTS idx_bookings_slot_time
  ON bookings (slot_id, start_time, end_time);

-- Sample seed data (remove/edit for production)
INSERT INTO parking_slots (slot_number, location, hourly_rate, daily_rate)
VALUES
  ('A1', 'Ground Floor - Zone A', 20.00, 150.00),
  ('A2', 'Ground Floor - Zone A', 20.00, 150.00),
  ('B1', 'Ground Floor - Zone B', 25.00, 180.00)
ON CONFLICT (slot_number) DO NOTHING;

-- Safe upgrades for databases created from earlier versions of this project.
ALTER TABLE parking_slots ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('confirmed','cancelled','checked_in','checked_out'));
ALTER TABLE parking_slots DROP CONSTRAINT IF EXISTS parking_slots_status_check;
ALTER TABLE parking_slots ADD CONSTRAINT parking_slots_status_check CHECK (status IN ('active','maintenance','inactive'));

-- Completed bookings must not block future reservations.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS no_overlapping_bookings;
ALTER TABLE bookings ADD CONSTRAINT no_overlapping_bookings EXCLUDE USING gist (slot_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&) WHERE (status IN ('confirmed','checked_in'));

-- Razorpay payment tracking (run this upgrade on an existing database too).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_razorpay_payment_id
  ON bookings (razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
