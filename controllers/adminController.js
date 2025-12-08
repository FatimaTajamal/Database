const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Admin login
const adminLogin = async (req, res) => {
  try {
    console.log('🔍 Login attempt started');
    console.log('🔍 Request body:', { username: req.body?.username, hasPassword: !!req.body?.password });
    console.log('🔍 ENV check:', { 
      hasUsername: !!process.env.ADMIN_USERNAME,
      hasPasswordHash: !!process.env.ADMIN_PASSWORD_HASH,
      hasJWT: !!process.env.JWT_SECRET,
      passwordHashLength: process.env.ADMIN_PASSWORD_HASH?.length,
      passwordHashStart: process.env.ADMIN_PASSWORD_HASH?.substring(0, 4)
    });

    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      console.log('❌ Missing username or password');
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Check if env variables exist
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD_HASH || !process.env.JWT_SECRET) {
      console.error('❌ Missing environment variables');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    // Check username
    if (username !== process.env.ADMIN_USERNAME) {
      console.log('❌ Username mismatch');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('✅ Username matched, checking password...');

    // Verify password hash format
    if (!process.env.ADMIN_PASSWORD_HASH.startsWith('$2a$') && 
        !process.env.ADMIN_PASSWORD_HASH.startsWith('$2b$')) {
      console.error('❌ ADMIN_PASSWORD_HASH is not a valid bcrypt hash!');
      return res.status(500).json({ message: 'Server configuration error - invalid password hash' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(
      password, 
      process.env.ADMIN_PASSWORD_HASH
    );

    console.log('🔍 Password check result:', isValidPassword);

    if (!isValidPassword) {
      console.log('❌ Password incorrect');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('✅ Password matched, generating token...');

    // Generate JWT token
    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Login successful');

    res.json({
      message: 'Login successful',
      token,
      user: { username, role: 'admin' }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Verify token
const verifyToken = (req, res) => {
  res.json({ valid: true, user: req.user });
};

module.exports = { adminLogin, verifyToken };