const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Admin login
const adminLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check credentials
    if (username !== process.env.ADMIN_USERNAME) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(
      password, 
      process.env.ADMIN_PASSWORD_HASH
    );

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { username, role: 'admin' }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Verify token
const verifyToken = (req, res) => {
  res.json({ valid: true, user: req.user });
};

module.exports = { adminLogin, verifyToken };