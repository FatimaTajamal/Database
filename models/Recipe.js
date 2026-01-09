
// const mongoose = require('mongoose');

// const recipeSchema = new mongoose.Schema({
//   // Basic fields (existing)
//   title: {
//     type: String,
//     required: true,
//     trim: true
//   },
//   name: {
//     type: String,
//     trim: true
//   },
//   image_url: {
//     type: String,
//     default: ''
//   },
  
//   // Ingredients - flexible format for both systems
//   ingredients: [{
//     type: mongoose.Schema.Types.Mixed,  // Can be string or { name, quantity }
//     required: true
//   }],
  
//   instructions: [{
//     type: String,
//     required: true
//   }],
  
//   // Optional metadata
//   category: {
//     type: String,
//     default: ''
//   },
//   difficulty: {
//     type: String,
//     enum: ['easy', 'medium', 'hard', ''],
//     default: ''
//   },
//   prepTime: {
//     type: String,
//     default: ''
//   },
//   cookTime: {
//     type: String,
//     default: ''
//   },
//   dietType: {
//     type: String,
//     default: ''
//   },
//   cuisine: {
//     type: String,
//     default: ''
//   },
//   calories: {
//     type: Number,
//     default: 0
//   },
  
//   // New fields for Flutter app
//   dietaryTags: [{
//     type: String,
//     enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo', 'halal', 'kosher', ''],
//     default: []
//   }],
//   allergens: [{
//     type: String,
//     enum: ['nuts', 'dairy', 'eggs', 'soy', 'wheat', 'fish', 'shellfish', 'peanuts', ''],
//     default: []
//   }],
  
//   // Track source and usage
//   source: {
//     type: String,
//     enum: ['cookbook', 'gemini'],
//     default: 'cookbook'
//   },
//   lastViewed: {
//     type: Date,
//     default: null
//   }
// }, {
//   timestamps: true  // Adds createdAt and updatedAt
// });

// // Indexes for faster searches
// recipeSchema.index({ title: 'text', name: 'text' });
// recipeSchema.index({ 'ingredients.name': 1 });
// recipeSchema.index({ dietaryTags: 1 });
// recipeSchema.index({ category: 1 });
// recipeSchema.index({ lastViewed: -1 });

// module.exports = mongoose.model('Recipe', recipeSchema);


const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
  // Basic fields (existing)
  title: {
    type: String,
    required: true,
    trim: true
  },
  name: {
    type: String,
    trim: true
  },
  image_url: {
    type: String,
    default: ''
  },
  
  // Ingredients - flexible format for both systems
  ingredients: [{
    type: mongoose.Schema.Types.Mixed,  // Can be string or { name, quantity }
    required: true
  }],
  
  instructions: [{
    type: String,
    required: true
  }],
  
  // Optional metadata
  category: {
    type: String,
    default: ''
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard', ''],
    default: ''
  },
  prepTime: {
    type: String,
    default: ''
  },
  cookTime: {
    type: String,
    default: ''
  },
  dietType: {
    type: String,
    default: ''
  },
  cuisine: {
    type: String,
    default: ''
  },
  calories: {
    type: Number,
    default: 0
  },
  
  // New fields for Flutter app - REMOVED ENUM RESTRICTIONS
  dietaryTags: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  allergens: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Track source and usage
  source: {
    type: String,
    enum: ['cookbook', 'gemini', 'database'],
    default: 'cookbook'
  },
  lastViewed: {
    type: Date,
    default: null
  }
}, {
  timestamps: true  // Adds createdAt and updatedAt
});

// Indexes for faster searches
recipeSchema.index({ title: 'text', name: 'text' });
recipeSchema.index({ 'ingredients.name': 1 });
recipeSchema.index({ dietaryTags: 1 });
recipeSchema.index({ category: 1 });
recipeSchema.index({ lastViewed: -1 });

// Pre-save middleware to validate and filter dietary tags
recipeSchema.pre('save', function(next) {
  const validDietaryTags = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo', 'halal', 'kosher'];
  const validAllergens = ['nuts', 'dairy', 'eggs', 'soy', 'wheat', 'fish', 'shellfish', 'peanuts'];
  
  // Filter dietary tags to only valid ones
  if (this.dietaryTags && Array.isArray(this.dietaryTags)) {
    this.dietaryTags = this.dietaryTags
      .map(tag => tag.toLowerCase().trim())
      .filter(tag => validDietaryTags.includes(tag));
  }
  
  // Filter allergens to only valid ones
  if (this.allergens && Array.isArray(this.allergens)) {
    this.allergens = this.allergens
      .map(allergen => allergen.toLowerCase().trim())
      .filter(allergen => validAllergens.includes(allergen));
  }
  
  next();
});

module.exports = mongoose.model('Recipe', recipeSchema);