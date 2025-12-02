// const express = require('express');
// const router = express.Router();
// const {
//   getPagedRecipes,
//   getAllRecipes,
//   getRecipeById,
//   createRecipe,
//   updateRecipe,
//   deleteRecipe
// } = require('../controllers/recipeController');
// const { authenticateToken } = require('../middleware/auth');

// // ================== PUBLIC ROUTES ==================
// // Stats endpoint (used for dashboard)
// router.get('/recipes/stats', getAllRecipes);

// // Main paginated recipes endpoint
// router.get('/recipes', getPagedRecipes);

// // Single recipe by ID
// router.get('/recipes/:id', getRecipeById);

// // ================== PROTECTED ROUTES ==================
// router.post('/recipes', authenticateToken, createRecipe);
// router.put('/recipes/:id', authenticateToken, updateRecipe);
// router.delete('/recipes/:id', authenticateToken, deleteRecipe);

// module.exports = router;


const express = require('express');
const router = express.Router();

const {
  getPagedRecipes,
  getAllRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  updateLastViewed    // 🔥 New Controller
} = require('../controllers/recipeController');

const { authenticateToken } = require('../middleware/auth');

// ================== PUBLIC ROUTES ==================

// Stats endpoint — now gets recent recipes sorted by lastViewed
router.get('/recipes/stats', getAllRecipes);

// Single recipe by ID
// 🔥 Updated: first update lastViewed, then return recipe
router.get('/recipes/:id', updateLastViewed, getRecipeById);

// Main paginated recipes endpoint
router.get('/recipes', getPagedRecipes);

// ================== PROTECTED ROUTES ==================
router.post('/recipes', authenticateToken, createRecipe);
router.put('/recipes/:id', authenticateToken, updateRecipe);
router.delete('/recipes/:id', authenticateToken, deleteRecipe);

module.exports = router;
