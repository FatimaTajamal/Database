// // controllers/recipeController.js
// const Recipe = require('../models/Recipe');

// // ================== PAGINATED RECIPES ==================
// const getPagedRecipes = async (req, res) => {
//     try {
//         console.log('=== getPagedRecipes called ===');
//         const page = parseInt(req.query.page) || 1;
//         const limit = parseInt(req.query.limit) || 20;
//         const search = req.query.search || '';
//         const category = req.query.category || 'all';

//         const skip = (page - 1) * limit;
//         let query = {};

//         if (category !== 'all') query.category = category;

//         if (search) {
//             const regex = new RegExp(search, 'i');
//             query.$or = [
//                 { title: { $regex: regex } },
//                 { name: { $regex: regex } },
//                 { category: { $regex: regex } },
//                 { ingredients: { $regex: regex } }
//             ];
//         }

//         const totalCount = await Recipe.countDocuments(query);
//         const recipes = await Recipe.find(query)
//             .sort({ createdAt: -1 })
//             .skip(skip)
//             .limit(limit)
//             .select('title name category difficulty prepTime cookTime source');

//         res.status(200).json({
//             recipes,
//             totalCount,
//             currentPage: page,
//             recipesPerPage: limit,
//             totalPages: Math.ceil(totalCount / limit),
//         });

//     } catch (error) {
//         console.error('Error fetching paginated recipes:', error);
//         res.status(500).json({ message: 'Server error fetching recipes', error: error.message });
//     }
// };

// // ================== ALL RECIPES (for stats/dashboard) ==================
// const getAllRecipes = async (req, res) => {
//     try {
//         const recipes = await Recipe.find()
//             .sort({ lastViewed: -1, createdAt: -1 })  // 🔥 Most recently viewed first
//             .limit(20);  // dashboard needs only a few

//         res.json(recipes);
//     } catch (error) {
//         console.error('Error fetching all recipes:', error);
//         res.status(500).json({ message: 'Error fetching recipes', error: error.message });
//     }
// };


// // ================== GET SINGLE RECIPE ==================
// const getRecipeById = async (req, res) => {
//     try {
//         const recipe = await Recipe.findById(req.params.id);
//         if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
//         res.json(recipe);
//     } catch (error) {
//         console.error('Error fetching recipe by ID:', error);
//         res.status(500).json({ message: 'Server error', error: error.message });
//     }
// };

// // ================== CREATE NEW RECIPE ==================
// const createRecipe = async (req, res) => {
//     try {
//         const newRecipe = new Recipe(req.body);
//         const saved = await newRecipe.save();
//         res.status(201).json(saved);
//     } catch (error) {
//         console.error('Error creating recipe:', error);
//         res.status(500).json({ message: 'Error creating recipe', error: error.message });
//     }
// };

// const updateLastViewed = async (req, res, next) => {
//   try {
//     const recipeId = req.params.id;
//     // Update lastViewed timestamp in DB
//     await Recipe.findByIdAndUpdate(recipeId, { lastViewed: new Date() });
    
//     // 🔥 Important: pass control to next middleware
//     next();
//   } catch (error) {
//     console.error(error);
//     // Forward error to Express error handler
//     next(error);
//   }
// };

// // ================== UPDATE RECIPE ==================
// const updateRecipe = async (req, res) => {
//     try {
//         const updated = await Recipe.findByIdAndUpdate(req.params.id, req.body, { new: true });
//         if (!updated) return res.status(404).json({ message: 'Recipe not found' });
//         res.json(updated);
//     } catch (error) {
//         console.error('Error updating recipe:', error);
//         res.status(500).json({ message: 'Error updating recipe', error: error.message });
//     }
// };

// // ================== DELETE RECIPE ==================
// const deleteRecipe = async (req, res) => {
//     try {
//         const deleted = await Recipe.findByIdAndDelete(req.params.id);
//         if (!deleted) return res.status(404).json({ message: 'Recipe not found' });
//         res.json({ message: 'Recipe deleted successfully' });
//     } catch (error) {
//         console.error('Error deleting recipe:', error);
//         res.status(500).json({ message: 'Error deleting recipe', error: error.message });
//     }
// };

// // ================== EXPORT ==================
// module.exports = {
//     getPagedRecipes,
//     getAllRecipes,
//     getRecipeById,
//     createRecipe,
//     updateRecipe,
//     deleteRecipe,
//     updateLastViewed  
// };
// controllers/recipeController.js

const { recipeGraph } = require('../graph/recipeGraph'); // or wherever your langraph file is
const Recipe = require('../models/Recipe');

// Get a single recipe using LangGraph workflow
exports.getRecipe = async (req, res) => {
  try {
    const { query, dietaryPreferences } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`🔍 Processing recipe request: ${query}`);

    // Execute the LangGraph workflow
    const result = await recipeGraph.invoke({
      query: query,
      recipes: [],
      source: "",
      error: null,
      dietaryPreferences: dietaryPreferences || []
    });

    // Check for errors
    if (result.error) {
      console.error(`❌ Error in workflow: ${result.error}`);
      return res.status(500).json({ error: result.error });
    }

    // Check if we got recipes
    if (!result.recipes || result.recipes.length === 0) {
      return res.status(404).json({ error: 'No recipe found' });
    }

    // Return the first recipe (or all if you prefer)
    const recipe = result.recipes[0];
    console.log(`✅ Recipe found from ${result.source}: ${recipe.title}`);
    
    return res.status(200).json({
      ...recipe.toObject ? recipe.toObject() : recipe,
      source: result.source
    });

  } catch (error) {
    console.error('❌ Error in getRecipe:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch recipe', 
      details: error.message 
    });
  }
};

// Get recipes by ingredients
exports.getRecipesByIngredients = async (req, res) => {
  try {
    const { ingredients, dietaryPreferences, allergies } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Ingredients array is required' });
    }

    console.log(`🔍 Searching recipes with ingredients: ${ingredients.join(', ')}`);

    // Search in database for recipes containing these ingredients
    const recipes = await Recipe.find({
      ingredients: { 
        $all: ingredients.map(ing => new RegExp(ing, 'i'))
      }
    }).limit(10);

    if (recipes.length > 0) {
      console.log(`✅ Found ${recipes.length} recipes with those ingredients`);
      return res.status(200).json(recipes);
    }

    // If no recipes found, generate suggestions using Gemini
    console.log('🤖 No recipes found, generating from Gemini...');
    
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    const dietaryPart = dietaryPreferences && dietaryPreferences.length > 0
      ? `suitable for ${dietaryPreferences.join(', ')} diet`
      : "";
    const allergyPart = allergies && allergies.length > 0
      ? `excluding ${allergies.join(', ')}`
      : "";

    const axios = require('axios');
    const response = await axios.post(geminiUrl, {
      contents: [{
        parts: [{
          text: `Suggest 5 recipes using these ingredients: ${ingredients.join(', ')} ${dietaryPart} ${allergyPart}.
Return ONLY a JSON array, NO markdown:
[
  {
    "title": "recipe name",
    "ingredients": ["ingredient 1", "ingredient 2"],
    "instructions": ["step 1", "step 2"],
    "dietType": "vegetarian/non-vegetarian/vegan",
    "cuisine": "cuisine type",
    "calories": 500
  }
]`
        }]
      }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 }
    });

    let aiText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const recipesData = JSON.parse(aiText);

    // Save to database
    const savedRecipes = await Recipe.insertMany(
      recipesData.map(r => ({
        ...r,
        source: 'gemini'
      }))
    );

    console.log(`💾 Saved ${savedRecipes.length} recipes to database`);
    return res.status(200).json(savedRecipes);

  } catch (error) {
    console.error('❌ Error in getRecipesByIngredients:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch recipes', 
      details: error.message 
    });
  }
};

// Get suggestions by category
exports.getSuggestionsByCategory = async (req, res) => {
  try {
    const { category, dietaryPreferences, timeOfDay } = req.body;

    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    console.log(`🔍 Searching ${category} recipes`);

    // First check database
    const recipesFromDB = await Recipe.find({
      cuisine: { $regex: new RegExp(category, 'i') }
    })
    .select('title')
    .limit(10);

    if (recipesFromDB.length >= 8) {
      console.log(`✅ Found ${recipesFromDB.length} ${category} recipes in database`);
      const recipeNames = recipesFromDB.map(r => r.title);
      return res.status(200).json(recipeNames);
    }

    // Not enough in DB, fetch from Gemini
    console.log('🤖 Generating suggestions from Gemini...');
    
    const axios = require('axios');
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    const seed = Date.now() % 1000;
    const dietaryPart = dietaryPreferences && dietaryPreferences.length > 0
      ? `suitable for ${dietaryPreferences.join(', ')}`
      : "";

    const response = await axios.post(geminiUrl, {
      contents: [{
        parts: [{
          text: `Suggest 10 ${category} recipes ${dietaryPart} ideal for ${timeOfDay || 'any time'}. 
Use variety seed: ${seed}
Return ONLY a JSON array of recipe names, NO markdown:
["Recipe 1", "Recipe 2", "Recipe 3"]`
        }]
      }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 512 }
    });

    let aiText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const suggestions = JSON.parse(aiText);
    return res.status(200).json(suggestions);

  } catch (error) {
    console.error('❌ Error in getSuggestionsByCategory:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch suggestions', 
      details: error.message 
    });
  }
};

// Get recipe suggestions from query
exports.getRecipeSuggestions = async (req, res) => {
  try {
    const { query, dietaryPreferences } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`🔍 Getting suggestions for: ${query}`);

    // Search database first
    const recipesFromDB = await Recipe.find({
      title: { $regex: new RegExp(query, 'i') }
    })
    .select('title')
    .limit(4);

    if (recipesFromDB.length >= 4) {
      console.log(`✅ Found ${recipesFromDB.length} matching recipes in database`);
      const recipeNames = recipesFromDB.map(r => r.title);
      return res.status(200).json(recipeNames);
    }

    // Not enough in DB, get from Gemini
    console.log('🤖 Generating suggestions from Gemini...');
    
    const axios = require('axios');
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    const dietaryPart = dietaryPreferences && dietaryPreferences.length > 0
      ? `suitable for ${dietaryPreferences.join(', ')}`
      : "";

    const response = await axios.post(geminiUrl, {
      contents: [{
        parts: [{
          text: `User searched for '${query}'. Suggest 4 popular recipes containing '${query}' ${dietaryPart}.
Return ONLY a JSON array of recipe names, NO markdown:
["Recipe 1", "Recipe 2", "Recipe 3", "Recipe 4"]`
        }]
      }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 256 }
    });

    let aiText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
    aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    const suggestions = JSON.parse(aiText);
    return res.status(200).json(suggestions);

  } catch (error) {
    console.error('❌ Error in getRecipeSuggestions:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch suggestions', 
      details: error.message 
    });
  }
};

// Get multiple recipes (used by Flutter when user selects from suggestions)
exports.getMultipleRecipes = async (req, res) => {
  try {
    const { recipeNames } = req.body;

    if (!recipeNames || !Array.isArray(recipeNames)) {
      return res.status(400).json({ error: 'Recipe names array is required' });
    }

    const recipes = [];

    for (const name of recipeNames) {
      // Use LangGraph workflow for each recipe
      const result = await recipeGraph.invoke({
        query: name,
        recipes: [],
        source: "",
        error: null
      });

      if (result.recipes && result.recipes.length > 0) {
        recipes.push(result.recipes[0]);
      }
    }

    return res.status(200).json(recipes);

  } catch (error) {
    console.error('❌ Error in getMultipleRecipes:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch recipes', 
      details: error.message 
    });
  }
};

module.exports = exports;