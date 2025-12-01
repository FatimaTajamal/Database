const express = require('express');
const router = express.Router();
const { adminLogin, verifyToken } = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/login', adminLogin);

// Protected routes
router.get('/verify', authenticateToken, verifyToken);

module.exports = router;