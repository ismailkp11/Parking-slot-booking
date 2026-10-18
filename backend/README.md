# Backend API

## Setup
1. Install Node.js 18+ and PostgreSQL (or create an AWS RDS PostgreSQL database).
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in database details. Keep `.env` private.
4. Run `database/schema.sql` against your database. It creates the tables, sample slots, and a database-level exclusion constraint to prevent overlapping active bookings.
5. Run `npm run dev` for development or `npm start` for normal execution.

API runs at `http://localhost:3000`; check `/health`.

## API routes
- `GET /slots` — list parking slots
- `GET /availability?date=YYYY-MM-DD` — daily availability
- `GET /availability/:slotId?date=YYYY-MM-DD` — busy/free windows for a slot
- `POST /bookings` — create booking (JSON: `slot_id`, `user_name`, `user_email`, `start_time`, `end_time`)
- `GET /bookings/:id` — booking lookup
- `DELETE /bookings/:id` — cancel booking

SNS notifications use the EC2 instance IAM role when deployed. Set `AWS_REGION` and `SNS_TOPIC_ARN` in `.env`. In local development, booking still succeeds if SNS is not configured; a notification error is logged.

## Razorpay payments (test mode)

See the project root `README.md` for full Razorpay test-mode setup. Apply `database/razorpay-migration.sql` to an existing database before testing payments. Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the backend `.env` only. `GET /api/payments/config` reports whether the backend is configured and whether its key ID is test mode. Direct unpaid `POST /bookings` requests are intentionally blocked; a booking is written only after Razorpay payment verification.
