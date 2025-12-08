const express = require('express');
const router = express.Router();
const { adminLogin, verifyToken } = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');

// Public routes (POST)
router.post('/login', adminLogin);

// Protected routes (GET)
router.get('/verify', authenticateToken, verifyToken);

// MOVE the working GET debug route here:
router.get('/debug', (req, res) => { 
    res.json({ ok: true, message: 'Admin routes reachable via imported router' });
});

// TEMP DEBUG POST ROUTE (KEEP it here for final verification)
router.post('/test-post', (req, res) => {
    res.json({ debug: 'POST request received successfully!' });
}); 



module.exports = router;