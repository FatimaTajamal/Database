const express = require('express');
const router = express.Router();
const {
  getAllHacks,
  getDailyHack,
  getHackById,
  addHack,
  updateHack,
  deleteHack
} = require('../controllers/cookingHackController');

// Public routes
router.get('/', getAllHacks);
router.get('/daily', getDailyHack);
router.get('/:id', getHackById);

// Admin routes (add authentication middleware if needed)
router.post('/', addHack);
router.put('/:id', updateHack);
router.delete('/:id', deleteHack);

module.exports = router;