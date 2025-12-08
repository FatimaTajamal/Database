require('dotenv').config();


console.log('🔍 Environment check on startup:', {
  hasAdminUsername: !!process.env.ADMIN_USERNAME,
  hasAdminPasswordHash: !!process.env.ADMIN_PASSWORD_HASH,
  hasJWT: !!process.env.JWT_SECRET,
  hasMongoURI: !!process.env.MONGODB_URI
});

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


//Handle CORS
// ---- FIX: Handle preflight on Vercel ----
app.options(/.*/, (req, res) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://admin-portal-rosy-six.vercel.app'
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  return res.status(200).end();
});



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

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

