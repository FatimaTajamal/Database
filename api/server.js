require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('../config/db');

const app = express();

// Connect to MongoDB
connectDB();

// ================= Middleware =================
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

app.use(express.json()); // Parse JSON
app.use(express.urlencoded({ extended: true })); // Parse form data

// ================= Routes =================

// 🔹 Admin routes must come BEFORE recipe routes
app.use('/api/admin', require('../routes/adminRoutes'));

// Recipe routes
app.use('/api', require('../routes/recipeRoutes'));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'Server running on Vercel!' });
});




// ================= Debug route (optional, for testing) =================
// Uncomment to test admin route reachability
// app.get('/api/admin/debug', (req, res) => {
//   res.json({ ok: true, message: 'Admin routes reachable' });
// });

// ================= 404 Handler =================
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found', path: req.originalUrl });
});

// ================= Global Error Handler =================
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// ❗ EXPORT app for Vercel serverless
module.exports = app;

