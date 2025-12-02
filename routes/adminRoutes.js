const express = require('express');
const router = express.Router();
const { adminLogin, verifyToken } = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/login', adminLogin);       // POST /api/admin/login

// Protected routes
router.get('/verify', authenticateToken, verifyToken); // GET /api/admin/verify

module.exports = router;
