// // const mongoose = require("mongoose");

// // const RecipeSchema = new mongoose.Schema({
// //   title: { type: String, required: true },
// //   ingredients: { type: [String], default: [] },
// //   instructions: { type: [String], default: [] },
// //   dietType: { type: String, default: "" },   // <-- you already had this
// //   cuisine: { type: String, default: "" },
// //   calories: { type: Number, default: 0 },
// //   source: { type: String, enum: ["cookbook", "gemini"], default: "cookbook" },
// // });

// // module.exports = mongoose.model("Recipe", RecipeSchema);


// const mongoose = require("mongoose");

// const RecipeSchema = new mongoose.Schema({
//   title: { type: String, required: true },
//   ingredients: { type: [String], default: [] },
//   instructions: { type: [String], default: [] },
//   dietType: { type: String, default: "" },
//   cuisine: { type: String, default: "" },
//   calories: { type: Number, default: 0 },
//   source: { type: String, enum: ["cookbook", "gemini"], default: "cookbook" },

//   // 🔥 New field: last viewed timestamp
//   lastViewed: { type: Date, default: null }
// }, { timestamps: true });   // enables createdAt, updatedAt

// module.exports = mongoose.model("Recipe", RecipeSchema);

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
  
  // New fields for Flutter app
  dietaryTags: [{
    type: String,
    enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo', 'halal', 'kosher', ''],
    default: []
  }],
  allergens: [{
    type: String,
    enum: ['nuts', 'dairy', 'eggs', 'soy', 'wheat', 'fish', 'shellfish', 'peanuts', ''],
    default: []
  }],
  
  // Track source and usage
  source: {
    type: String,
    enum: ['cookbook', 'gemini'],
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

module.exports = mongoose.model('Recipe', recipeSchema);