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

// Routes
app.use('/api', require('../routes/recipeRoutes'));
app.use('/api/admin', require('../routes/adminRoutes'));

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









// // Load environment variables first
// require('dotenv').config();

// const express = require('express');
// const cors = require('cors');
// const connectDB = require('./config/db');

// const app = express();

// // Connect to MongoDB
// connectDB();

// // ================= Middleware =================
// app.use(
//   cors({
//     origin: [
//       'http://localhost:3000',
//       'http://localhost:5173'
//     ],
//     credentials: true,
//   })
// );

// app.use(express.json()); // Parse JSON
// app.use(express.urlencoded({ extended: true })); // Parse form data

// // ================= Routes =================
// app.use('/api', require('./routes/recipeRoutes'));
// app.use('/api/admin', require('./routes/adminRoutes'));

// // Health check route
// app.get('/health', (req, res) => {
//   res.json({ status: 'Server is running' });
// });

// // Handle unknown routes (404)
// app.use((req, res) => {
//   res.status(404).json({
//     message: 'Route not found',
//     path: req.originalUrl,
//   });
// });

// // ================= Global Error Handler =================
// app.use((err, req, res, next) => {
//   console.error('🔥 Server Error:', err.stack);
//   res.status(500).json({ message: 'Something went wrong!' });
// });

// // ================= Start Server =================
// const PORT = process.env.PORT || 5000;

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });
