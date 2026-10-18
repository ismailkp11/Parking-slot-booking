
const express = require('express');

const slotsRoutes = require('./routes/slotsRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const bookingsRoutes = require('./routes/bookingsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const errorHandler = require('./middleware/errorHandler');

const app = express();

// CORS configuration
app.use((req, res, next) => {
  res.header(
    'Access-Control-Allow-Origin',
    process.env.FRONTEND_ORIGIN || '*'
  );

  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// Parse JSON request bodies
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Existing application routes
app.use('/admin', adminRoutes);
app.use('/slots', slotsRoutes);
app.use('/availability', availabilityRoutes);
app.use('/bookings', bookingsRoutes);

// Razorpay payment routes
app.use('/api/payments', paymentRoutes);

// 404 handler — must come after all routes
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not found'
  });
});

// Error handler — keep last
app.use(errorHandler);

module.exports = app;
