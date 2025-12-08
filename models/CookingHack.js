const mongoose = require('mongoose');

const cookingHackSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true
  },
  hack: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CookingHack', cookingHackSchema);