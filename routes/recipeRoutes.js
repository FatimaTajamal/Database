// // const express = require('express');
// // const router = express.Router();
// // const {
// //   getPagedRecipes,
// //   getAllRecipes,
// //   getRecipeById,
// //   createRecipe,
// //   updateRecipe,
// //   deleteRecipe
// // } = require('../controllers/recipeController');
// // const { authenticateToken } = require('../middleware/auth');

// // // ================== PUBLIC ROUTES ==================
// // // Stats endpoint (used for dashboard)
// // router.get('/recipes/stats', getAllRecipes);

// // // Main paginated recipes endpoint
// // router.get('/recipes', getPagedRecipes);

// // // Single recipe by ID
// // router.get('/recipes/:id', getRecipeById);

// // // ================== PROTECTED ROUTES ==================
// // router.post('/recipes', authenticateToken, createRecipe);
// // router.put('/recipes/:id', authenticateToken, updateRecipe);
// // router.delete('/recipes/:id', authenticateToken, deleteRecipe);

// // module.exports = router;


// const express = require('express');
// const router = express.Router();

// const {
//   getPagedRecipes,
//   getAllRecipes,
//   getRecipeById,
//   createRecipe,
//   updateRecipe,
//   deleteRecipe,
//   updateLastViewed    // 🔥 New Controller
// } = require('../controllers/recipeController');

// const { authenticateToken } = require('../middleware/auth');

// // ================== PUBLIC ROUTES ==================

// // Stats endpoint — now gets recent recipes sorted by lastViewed
// router.get('/recipes/stats', getAllRecipes);

// // Single recipe by ID
// // 🔥 Updated: first update lastViewed, then return recipe
// router.get('/recipes/:id', updateLastViewed, getRecipeById);

// // Main paginated recipes endpoint
// router.get('/recipes', getPagedRecipes);

// // ================== PROTECTED ROUTES ==================
// router.post('/recipes', authenticateToken, createRecipe);
// router.put('/recipes/:id', authenticateToken, updateRecipe);
// router.delete('/recipes/:id', authenticateToken, deleteRecipe);

// module.exports = router;
// 



const express = require('express');
const router = express.Router();

const {
  // Web portal routes
  getPagedRecipes,
  getAllRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  updateLastViewed,
  
  // Flutter app routes
  generateRecipe,
  getRecipesByIngredients,
  getRecipeSuggestions,
  getSuggestionsByCategory,
  getMultipleRecipes
} = require('../controllers/recipeController');

const { authenticateToken } = require('../middleware/auth');

// ================== WEB PORTAL ROUTES ==================

// Stats endpoint (recently viewed recipes)
router.get('/recipes/stats', getAllRecipes);

// Main paginated recipes
router.get('/recipes', getPagedRecipes);

// Single recipe by ID (with lastViewed update)
router.get('/recipes/:id', updateLastViewed, getRecipeById);

// Protected routes (admin only)
router.post('/recipes', authenticateToken, createRecipe);
router.put('/recipes/:id', authenticateToken, updateRecipe);
router.delete('/recipes/:id', authenticateToken, deleteRecipe);

// ================== FLUTTER APP ROUTES ==================

// Generate single recipe (LangGraph: DB → Gemini if not found)
// ================== FLUTTER APP ROUTES ==================

// Generate single recipe
router.post('/generate', generateRecipe);

// Get recipes by available ingredients
router.post('/by-ingredients', getRecipesByIngredients);

// Get recipe suggestions
router.post('/suggestions', getRecipeSuggestions);

// Get suggestions by category and time of day
router.post('/suggestions-by-category', getSuggestionsByCategory);

// Get multiple recipes
router.post('/multiple', getMultipleRecipes);

module.exports = router;