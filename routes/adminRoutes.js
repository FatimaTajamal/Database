const express = require('express');
const router = express.Router();
const { adminLogin, verifyToken } = require('../controllers/adminController');
const { authenticateToken } = require('../middleware/auth');


router.post('/test-post', (req, res) => { 
  res.json({ debug: 'POST test received!' });
});
// Public routes
router.post('/login', adminLogin);


// Protected routes
router.get('/verify', authenticateToken, verifyToken);

module.exports = router;