// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const connectDB = require('../config/db');

// const app = express();

// // Connect DB (runs on every cold start)
// connectDB();

// // Middleware
// app.use(
//   cors({
//     origin: [
//       'http://localhost:3000',
//       'http://localhost:5173',
//       'https://admin-portal-rosy-six.vercel.app'
//     ],
//     credentials: true,
//   })
// );

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // Routes
// app.use('/api', require('../routes/recipeRoutes'));
// app.use('/api/admin', require('../routes/adminRoutes'));

// app.get('/health', (req, res) => {
//   res.json({ status: 'Server running on Vercel!' });
// });

// // 404 handler
// app.use((req, res) => {
//   res.status(404).json({ message: 'Route not found', path: req.originalUrl });
// });

// // Global error handler
// app.use((err, req, res, next) => {
//   console.error('🔥 Server Error:', err.stack);
//   res.status(500).json({ message: 'Something went wrong!' });
// });

// // ❗ EXPORT instead of listen()
// module.exports = app;


// Load environment variables first
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('../config/db');

const app = express();

// Connect DB (runs on every cold start)
connectDB();

// Middleware
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://admin-portal-rosy-six.vercel.app'
    ],
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log incoming request path to help debugging
app.use((req, res, next) => {
    console.log(`Incoming request path: ${req.originalUrl}`);
    next();
});

// Routes
// 🟢 FIX 1: Change mounting point back to '/api/admin' to match the full path.
// Request: /api/admin/login -> Express matches /api/admin -> Admin Router sees /login -> SUCCESS!
app.use('/api/admin', require('../routes/adminRoutes')); 

// 🟢 FIX 2: Ensure the more general '/api' route is defined after the specific one.
app.use('/api', require('../routes/recipeRoutes'));


app.get('/health', (req, res) => {
  res.json({ status: 'Server running on Vercel!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found', path: req.originalUrl });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// ❗ EXPORT instead of listen()
module.exports = app;