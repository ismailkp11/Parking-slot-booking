# Architecture

```text
Public visitor / Admin
        |
        v
Frontend (HTML + CSS + JavaScript)
        |
        | HTTP/JSON; admin endpoints require a signed bearer token
        v
Node.js + Express API
  |       |          |
  |       |          +--> Admin controllers and protected admin routes
  |       +-------------> Booking, availability and slot controllers
  +---------------------> Pricing and notification services
        |
        v
PostgreSQL (parking_slots, bookings; exclusion constraint prevents overlapping active bookings)
        |
        +--> Aggregated admin dashboard, user directory and reports

Optional: AWS SNS booking-confirmation notifications
Deployment option: static frontend + Node.js on EC2/Elastic Beanstalk + PostgreSQL on RDS
```

## Admin modules
- **Overview:** real aggregate slot/booking/revenue figures and latest reservations.
- **Parking slots:** create/update slots, configure rates, mark maintenance/inactive, safely delete slots without booking history.
- **Bookings:** search booking records and transition confirmed bookings to checked-in, checked-out or cancelled.
- **Users:** customer directory derived from names and emails entered during booking.
- **Reports:** daily activity and per-slot performance, exportable as CSV.
- **Settings:** per-slot rates and SNS environment configuration status.

The admin login is initiated only by clicking the website's Admin Login button. Admin APIs validate the signed token on every protected request; frontend-only hiding is not treated as authorization.
