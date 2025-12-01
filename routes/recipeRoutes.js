// const express = require('express');
// const router = express.Router();
// const {
//   // Import the fast Paged controller for lists
//   getPagedRecipes, 
//   // Import the slow getAllRecipes for the stats dashboard (to be optimized)
//   getAllRecipes, 
//   getRecipeById,
//   createRecipe,
//   updateRecipe,
//   deleteRecipe,
// // Note: searchRecipes is no longer needed/exported
// } = require('../controllers/recipeController');
// const { authenticateToken } = require('../middleware/auth');

// // Public routes

// // 1. New High-Performance Endpoint: Used by the React table for pagination/search/filter
// router.get('/recipes/paged', getPagedRecipes);

// // 2. Default List Endpoint: Redirects to the slow endpoint, which is used by your 
// // fetchRecipesForStats function to populate the dashboard.
// router.get('/recipes', getAllRecipes); 

// // The dedicated search route is removed, as /recipes/paged handles search
// // router.get('/recipes/search', searchRecipes); // REMOVED

// router.get('/recipes/:id', getRecipeById);

// // Protected routes (require authentication)
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
  deleteRecipe
} = require('../controllers/recipeController');
const { authenticateToken } = require('../middleware/auth');

// ================== PUBLIC ROUTES ==================
// Stats endpoint (used for dashboard)
router.get('/recipes/stats', getAllRecipes);

// Main paginated recipes endpoint
router.get('/recipes', getPagedRecipes);

// Single recipe by ID
router.get('/recipes/:id', getRecipeById);

// ================== PROTECTED ROUTES ==================
router.post('/recipes', authenticateToken, createRecipe);
router.put('/recipes/:id', authenticateToken, updateRecipe);
router.delete('/recipes/:id', authenticateToken, deleteRecipe);

module.exports = router;
