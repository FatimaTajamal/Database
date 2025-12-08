const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Admin login
const adminLogin = async (req, res) => {
  console.log('🔍 === LOGIN ATTEMPT STARTED ===');
  
  try {
    // Log environment variables status FIRST
    console.log('🔍 ENV Variables:', { 
      hasUsername: !!process.env.ADMIN_USERNAME,
      usernameValue: process.env.ADMIN_USERNAME,
      hasPasswordHash: !!process.env.ADMIN_PASSWORD_HASH,
      passwordHashLength: process.env.ADMIN_PASSWORD_HASH?.length,
      passwordHashStart: process.env.ADMIN_PASSWORD_HASH?.substring(0, 7),
      hasJWT: !!process.env.JWT_SECRET
    });

    const { username, password } = req.body;
    
    console.log('🔍 Request body:', { 
      username, 
      hasPassword: !!password,
      passwordLength: password?.length 
    });

    // Validate input
    if (!username || !password) {
      console.log('❌ Missing credentials in request');
      return res.status(400).json({ message: 'Username and password required' });
    }

    // Check if env variables exist
    if (!process.env.ADMIN_USERNAME) {
      console.error('❌ ADMIN_USERNAME not set!');
      return res.status(500).json({ message: 'Server configuration error: ADMIN_USERNAME missing' });
    }

    if (!process.env.ADMIN_PASSWORD_HASH) {
      console.error('❌ ADMIN_PASSWORD_HASH not set!');
      return res.status(500).json({ message: 'Server configuration error: ADMIN_PASSWORD_HASH missing' });
    }

    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET not set!');
      return res.status(500).json({ message: 'Server configuration error: JWT_SECRET missing' });
    }

    // Check username
    console.log('🔍 Comparing usernames:', {
      provided: username,
      expected: process.env.ADMIN_USERNAME,
      match: username === process.env.ADMIN_USERNAME
    });

    if (username !== process.env.ADMIN_USERNAME) {
      console.log('❌ Username mismatch');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log('✅ Username matched');

    // Verify password hash format
    const hashFormat = process.env.ADMIN_PASSWORD_HASH.substring(0, 4);
    console.log('🔍 Password hash format:', hashFormat);

    if (!process.env.ADMIN_PASSWORD_HASH.startsWith('$2a$') && 
        !process.env.ADMIN_PASSWORD_HASH.startsWith('$2b$')) {
      console.error('❌ ADMIN_PASSWORD_HASH is not a valid bcrypt hash!');
      console.error('Hash starts with:', process.env.ADMIN_PASSWORD_HASH.substring(0, 10));
      return res.status(500).json({ 
        message: 'Server configuration error',
        detail: 'Password hash format invalid'
      });
    }

    console.log('🔍 Starting password comparison...');

    // Check password
    const isValidPassword = await bcrypt.compare(
      password, 
      process.env.ADMIN_PASSWORD_HASH
    );

    console.log('🔍 Password comparison result:', isValidPassword);

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

    console.log('✅ Token generated successfully');
    console.log('✅ === LOGIN SUCCESSFUL ===');

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: { username, role: 'admin' }
    });

  } catch (error) {
    console.error('❌ === LOGIN ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Verify token
const verifyToken = (req, res) => {
  res.json({ valid: true, user: req.user });
};

module.exports = { adminLogin, verifyToken };