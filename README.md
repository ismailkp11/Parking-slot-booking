# ParkEase — Parking Slot Booking System

A modular parking booking web application using HTML, CSS, JavaScript, Node.js, Express, PostgreSQL and optional AWS SNS notifications.

## Features
- Public parking slot availability, booking, price calculation, booking lookup and cancellation.
- Admin Login is opened only when the user clicks **Admin Login**; it does not block the public website.
- Signed, expiring admin session token and protected `/admin/*` management APIs.
- Admin dashboard statistics and recent bookings.
- Parking slot create, edit, rate management, active/maintenance/inactive states and safe deletion rules.
- Booking search, status management, check-in, check-out and cancellation.
- Customer directory derived from booking history.
- Reports for daily bookings, slot performance and recorded revenue, with CSV export.
- Settings view for per-slot pricing and AWS SNS configuration status.
- Database-level protection against overlapping confirmed or checked-in reservations.

## Project structure
- `frontend/` — public website and admin console
- `backend/src/controllers/` — request handling
- `backend/src/models/` — database access
- `backend/src/routes/` — API routes
- `backend/src/middleware/` — error handling and admin authentication
- `backend/src/services/` — pricing and AWS SNS notifications
- `backend/database/schema.sql` — PostgreSQL schema and safe migrations
- `docs/ARCHITECTURE.md` — architecture overview

## Setup
1. Install Node.js 18+ and PostgreSQL.
2. Create a database, for example `parking_db`.
3. Run `backend/database/schema.sql` against that database. The SQL includes `ALTER TABLE` migrations for the updated admin fields and booking statuses. Back up any existing database before applying schema changes.
4. In a terminal, run `cd backend` and `npm install`.
5. Copy `backend/.env.example` to `backend/.env`, then enter your PostgreSQL details and a strong admin email/password. Set a long random `ADMIN_SESSION_SECRET`; never commit `.env`.
6. Optional SNS notifications: configure `AWS_REGION`, `SNS_TOPIC_ARN`, and AWS credentials using an IAM role or secure environment credentials.
7. Start the API from `backend/` with `npm run dev`.
8. Serve the `frontend/` folder using a static web server, e.g. `npx serve . -l 5173` from `frontend/`, then open `http://localhost:5173`.

## Admin access
Click **Admin Login** in the website header. Credentials are checked by the backend against `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The API issues a signed session that expires after eight hours. Admin endpoints require `Authorization: Bearer <token>`.

Admin routes include:
- `POST /admin/login`
- `GET /admin/dashboard`
- `GET/POST /admin/slots`, `PUT/DELETE /admin/slots/:id`
- `GET /admin/bookings`, `PATCH /admin/bookings/:id/status`
- `GET /admin/users`, `GET /admin/reports`, `GET /admin/settings`
- `POST /admin/notifications/test` (checks configuration; deliberately does not send a test message to real SNS subscribers)

## AWS deployment notes
- Deploy the backend on EC2, Elastic Beanstalk, or another Node.js host; use RDS PostgreSQL for the database.
- Keep the database private and restrict security groups to the backend host.
- Set `FRONTEND_ORIGIN` to the actual frontend origin instead of `*` for deployment.
- Before serving the frontend in production, set `window.PARKEASE_API_URL` to the deployed backend API base URL before `js/app.js` is loaded, or update `API_BASE_URL` in `frontend/js/app.js`.
- Use HTTPS, a strong unique admin password and secret, least-privilege IAM permissions, and do not expose database credentials in frontend code.

## Important scope notes
- Customer records are summarized from booking details because this project does not currently have customer registration/accounts.
- Revenue is calculated from booking totals, not verified payment transactions.
- Admin login and API modules are implemented, but live end-to-end testing requires a configured PostgreSQL database and (optionally) an AWS SNS topic.

## Razorpay test-mode setup

1. In the Razorpay Dashboard, switch to **Test Mode** and generate/copy the Test Key ID and Test Key Secret.
2. Copy `backend/.env.example` to `backend/.env` (or edit your existing `backend/.env`) and set `RAZORPAY_KEY_ID=rzp_test_...` and `RAZORPAY_KEY_SECRET=...`. Keep the secret only on the backend; do not commit `.env`.
3. Apply `backend/database/razorpay-migration.sql` to the PostgreSQL database used by this app. The `bookings` table needs the `razorpay_payment_id` column and unique index for safe payment retries.
4. From `backend/`, run `npm install`, then `npm start`. The backend runs at `http://localhost:3000` by default.
5. Serve the `frontend/` directory using VS Code Live Server (or another static web server). Do not open `index.html` as a `file://` URL. By default the frontend API URL is `http://localhost:3000`.
6. Visit `http://localhost:3000/api/payments/config`. It should report `configured: true` and `mode: "test"` when test keys are configured.
7. Test with Razorpay's test checkout details shown in its official test-mode documentation/dashboard. No real money is charged in test mode.

The backend calculates the price, creates a Razorpay order, verifies the checkout signature, checks that the payment is captured, and only then creates the booking. If payment succeeds but the slot is booked by another customer before confirmation, the app reports that situation; the payment must be reviewed/refunded by the administrator. Use HTTPS, webhook reconciliation, and operational refund handling before deploying live payments.
