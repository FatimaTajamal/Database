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

const Recipe = require('../models/Recipe');
const axios = require('axios');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ==================== EXISTING WEB PORTAL ROUTES ====================

// PAGINATED RECIPES (for web portal)
const getPagedRecipes = async (req, res) => {
    try {
        console.log('=== getPagedRecipes called ===');
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const category = req.query.category || 'all';

        const skip = (page - 1) * limit;
        let query = {};

        if (category !== 'all') query.category = category;

        if (search) {
            const regex = new RegExp(search, 'i');
            query.$or = [
                { title: { $regex: regex } },
                { name: { $regex: regex } },
                { category: { $regex: regex } },
                { ingredients: { $regex: regex } }
            ];
        }

        const totalCount = await Recipe.countDocuments(query);
        const recipes = await Recipe.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select('title name category difficulty prepTime cookTime source');

        res.status(200).json({
            recipes,
            totalCount,
            currentPage: page,
            recipesPerPage: limit,
            totalPages: Math.ceil(totalCount / limit),
        });
    } catch (error) {
        console.error('Error fetching paginated recipes:', error);
        res.status(500).json({ message: 'Server error fetching recipes', error: error.message });
    }
};

// ALL RECIPES (for stats/dashboard)
const getAllRecipes = async (req, res) => {
    try {
        const recipes = await Recipe.find()
            .sort({ lastViewed: -1, createdAt: -1 })
            .limit(20);
        res.json(recipes);
    } catch (error) {
        console.error('Error fetching all recipes:', error);
        res.status(500).json({ message: 'Error fetching recipes', error: error.message });
    }
};

// GET SINGLE RECIPE BY ID
const getRecipeById = async (req, res) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) return res.status(404).json({ message: 'Recipe not found' });
        res.json(recipe);
    } catch (error) {
        console.error('Error fetching recipe by ID:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// CREATE NEW RECIPE
const createRecipe = async (req, res) => {
    try {
        const newRecipe = new Recipe(req.body);
        const saved = await newRecipe.save();
        res.status(201).json(saved);
    } catch (error) {
        console.error('Error creating recipe:', error);
        res.status(500).json({ message: 'Error creating recipe', error: error.message });
    }
};

// UPDATE LAST VIEWED TIMESTAMP
const updateLastViewed = async (req, res, next) => {
    try {
        const recipeId = req.params.id;
        await Recipe.findByIdAndUpdate(recipeId, { lastViewed: new Date() });
        next();
    } catch (error) {
        console.error(error);
        next(error);
    }
};

// UPDATE RECIPE
const updateRecipe = async (req, res) => {
    try {
        const updated = await Recipe.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ message: 'Recipe not found' });
        res.json(updated);
    } catch (error) {
        console.error('Error updating recipe:', error);
        res.status(500).json({ message: 'Error updating recipe', error: error.message });
    }
};

// DELETE RECIPE
const deleteRecipe = async (req, res) => {
    try {
        const deleted = await Recipe.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: 'Recipe not found' });
        res.json({ message: 'Recipe deleted successfully' });
    } catch (error) {
        console.error('Error deleting recipe:', error);
        res.status(500).json({ message: 'Error deleting recipe', error: error.message });
    }
};

// ==================== NEW FLUTTER APP ROUTES (with Gemini) ====================

// Helper: Fetch image from Pixabay
async function fetchImageUrl(query) {
    try {
        const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || "51392156-8eaa4d6a677c8e44156c40208";
        let simplifiedQuery = query.split(":")[0].trim().replace(/[&:(),]/g, '');
        const words = simplifiedQuery.split(" ");
        if (words.length > 4) simplifiedQuery = words.slice(0, 4).join(" ");
        simplifiedQuery = `${simplifiedQuery} food`;

        const response = await axios.get('https://pixabay.com/api/', {
            params: {
                key: PIXABAY_API_KEY,
                q: simplifiedQuery,
                image_type: 'photo',
                category: 'food',
                safesearch: true
            }
        });

        if (response.data.hits && response.data.hits.length > 0) {
            return response.data.hits[0].webformatURL;
        }
    } catch (error) {
        console.error('Error fetching image:', error.message);
    }
    return '';
}

// Helper: Call Gemini API
async function callGeminiAPI(prompt) {
    try {
        console.log("🚀 Sending request to Gemini...");
        const response = await axios.post(GEMINI_URL, {
            contents: [{
                parts: [{ text: prompt }]
            }]
        }, {
            headers: { "Content-Type": "application/json" }
        });

        if (!response.data.candidates || response.data.candidates.length === 0) {
            throw new Error("No candidates returned from Gemini");
        }

        let content = response.data.candidates[0].content.parts[0].text;
        
        // Robust JSON cleaning: Remove markdown code blocks if present
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            content = jsonMatch[0];
        }

        return JSON.parse(content);
    } catch (error) {
        console.error('Detailed Gemini Error:', error.response?.data || error.message);
        throw new Error('Gemini API failed to generate valid recipe JSON');
    }
}

// ==================== FLUTTER APP ROUTES ====================

const generateRecipe = async (req, res) => {
    try {
        const { query, dietaryPreferences = [], allergies = [] } = req.body;
        if (!query) return res.status(400).json({ error: 'Query is required' });

        const normalizedQuery = query.toLowerCase().trim();

        // 1. Check Database (Exact Match)
        let recipe = await Recipe.findOne({
            $or: [
                { title: { $regex: new RegExp(`^${normalizedQuery}$`, 'i') } },
                { name: { $regex: new RegExp(`^${normalizedQuery}$`, 'i') } }
            ]
        });

        if (recipe) {
            console.log('✅ Found in DB');
            return res.json(recipe); 
        }

        // 2. Fallback to Gemini
        console.log('⚡ Calling Gemini for:', query);
        const prompt = `Provide a recipe for "${query}" as a JSON object. 
        Preferences: ${dietaryPreferences.join(', ')}. Allergies: ${allergies.join(', ')}.
        Return ONLY valid JSON using this structure:
        {
          "name": "${query}",
          "ingredients": [{"name": "item", "quantity": "amount"}],
          "instructions": ["step 1"],
          "dietaryTags": [],
          "allergens": []
        }`;

        const geminiData = await callGeminiAPI(prompt);
        
        // Fetch image for the new recipe
        const imageUrl = await fetchImageUrl(query);

        // 3. Save to MongoDB
        const newRecipe = new Recipe({
            title: geminiData.name || query,
            name: geminiData.name || query,
            image_url: imageUrl,
            ingredients: geminiData.ingredients || [],
            instructions: geminiData.instructions || [],
            dietaryTags: geminiData.dietaryTags || dietaryPreferences,
            allergens: geminiData.allergens || allergies,
            source: 'gemini'
        });

        await newRecipe.save();
        res.json(newRecipe);

    } catch (error) {
        console.error('Flow Error:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// 4. GET SUGGESTIONS BY CATEGORY
const getSuggestionsByCategory = async (req, res) => {
    try {
        const { category, dietaryPreferences = [] } = req.body;

        if (!category) {
            return res.status(400).json({ error: 'Category is required' });
        }

        const now = new Date();
        const timeOfDay = now.getHours() < 12 ? 'morning' : (now.getHours() < 18 ? 'afternoon' : 'evening');
        const seed = now.getMilliseconds();

        const dietaryPart = dietaryPreferences.length > 0
            ? `suitable for ${dietaryPreferences.join(', ')}`
            : '';

        const prompt = `Suggest 10 unique ${category} recipes ${dietaryPart} ideal for ${timeOfDay}. Variety seed: ${seed}. Return JSON array: ["Recipe 1", "Recipe 2"]`;

        const suggestions = await callGeminiAPI(prompt);
        res.json(suggestions);
    } catch (error) {
        console.error('Error in getSuggestionsByCategory:', error);
        res.status(500).json({ error: error.message });
    }
};

// 5. GET MULTIPLE RECIPES
const getMultipleRecipes = async (req, res) => {
    try {
        const { recipeNames = [] } = req.body;

        if (!recipeNames || recipeNames.length === 0) {
            return res.status(400).json({ error: 'Recipe names are required' });
        }

        const recipes = await Promise.all(
            recipeNames.map(async (name) => {
                let recipe = await Recipe.findOne({ 
                    title: { $regex: new RegExp(`^${name}$`, 'i') }
                });

                if (!recipe) {
                    const prompt = `Give me a recipe for '${name}' in JSON format.`;
                    const geminiRecipe = await callGeminiAPI(prompt);
                    geminiRecipe.image_url = await fetchImageUrl(name);
                    
                    recipe = new Recipe({
                        title: geminiRecipe.name,
                        name: geminiRecipe.name,
                        image_url: geminiRecipe.image_url,
                        ingredients: geminiRecipe.ingredients || [],
                        instructions: geminiRecipe.instructions || [],
                        source: 'gemini'
                    });
                    await recipe.save();
                }

                return recipe;
            })
        );

        res.json(recipes);
    } catch (error) {
        console.error('Error in getMultipleRecipes:', error);
        res.status(500).json({ error: error.message });
    }
};

// ==================== EXPORTS ====================
module.exports = {
    // Web portal routes
    getPagedRecipes,
    getAllRecipes,
    getRecipeById,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    updateLastViewed,
    
    // Flutter app routes (with Gemini)
    generateRecipe,
    getRecipesByIngredients,
    getRecipeSuggestions,
    getSuggestionsByCategory,
    getMultipleRecipes
};