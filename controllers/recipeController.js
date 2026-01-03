// const Recipe = require('../models/Recipe');
// const axios = require('axios');

// const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// // ==================== EXISTING WEB PORTAL ROUTES ====================

// // PAGINATED RECIPES (for web portal)
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

// // ALL RECIPES (for stats/dashboard)
// const getAllRecipes = async (req, res) => {
//     try {
//         const recipes = await Recipe.find()
//             .sort({ lastViewed: -1, createdAt: -1 })
//             .limit(20);
//         res.json(recipes);
//     } catch (error) {
//         console.error('Error fetching all recipes:', error);
//         res.status(500).json({ message: 'Error fetching recipes', error: error.message });
//     }
// };

// // GET SINGLE RECIPE BY ID
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

// // CREATE NEW RECIPE
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

// // UPDATE LAST VIEWED TIMESTAMP
// const updateLastViewed = async (req, res, next) => {
//     try {
//         const recipeId = req.params.id;
//         await Recipe.findByIdAndUpdate(recipeId, { lastViewed: new Date() });
//         next();
//     } catch (error) {
//         console.error(error);
//         next(error);
//     }
// };

// // UPDATE RECIPE
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

// // DELETE RECIPE
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

// // ==================== NEW FLUTTER APP ROUTES (with Gemini) ====================

// // Helper: Fetch image from Pixabay
// async function fetchImageUrl(query) {
//     try {
//         const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || "51392156-8eaa4d6a677c8e44156c40208";
//         let simplifiedQuery = query.split(":")[0].trim().replace(/[&:(),]/g, '');
//         const words = simplifiedQuery.split(" ");
//         if (words.length > 4) simplifiedQuery = words.slice(0, 4).join(" ");
//         simplifiedQuery = `${simplifiedQuery} food`;

//         const response = await axios.get('https://pixabay.com/api/', {
//             params: {
//                 key: PIXABAY_API_KEY,
//                 q: simplifiedQuery,
//                 image_type: 'photo',
//                 category: 'food',
//                 safesearch: true
//             }
//         });

//         if (response.data.hits && response.data.hits.length > 0) {
//             return response.data.hits[0].webformatURL;
//         }
//     } catch (error) {
//         console.error('Error fetching image:', error.message);
//     }
//     return '';
// }

// // Helper: Call Gemini API
// async function callGeminiAPI(prompt) {
//     try {
//         const response = await axios.post(GEMINI_URL, {
//             contents: [{
//                 role: "user",
//                 parts: [{ text: prompt }]
//             }]
//         }, {
//             headers: { "Content-Type": "application/json" }
//         });

//         let content = response.data.candidates[0].content.parts[0].text;
//         content = content.replace(/```json/g, '').replace(/```/g, '').trim();
//         return JSON.parse(content);
//     } catch (error) {
//         console.error('Gemini API Error:', error.message);
//         throw new Error('Failed to generate recipe from Gemini');
//     }
// }

// // 1. GENERATE SINGLE RECIPE (LangGraph: DB → Gemini)
// const generateRecipe = async (req, res) => {
//     try {
//         const { query, dietaryPreferences = [], allergies = [] } = req.body;

//         if (!query) {
//             return res.status(400).json({ error: 'Query is required' });
//         }

//         // 🔥 Node 1: Check MongoDB first
//         const normalizedQuery = query.toLowerCase().trim();
//         let recipe = await Recipe.findOne({ 
//             $or: [
//                 { title: { $regex: new RegExp(`^${normalizedQuery}$`, 'i') } },
//                 { name: { $regex: new RegExp(`^${normalizedQuery}$`, 'i') } }
//             ]
//         });

//         if (recipe) {
//             console.log('✅ Recipe found in MongoDB:', recipe.title || recipe.name);
//             return res.json({
//                 name: recipe.title || recipe.name,
//                 image_url: recipe.image_url || '',
//                 ingredients: recipe.ingredients.map(ing => 
//                     typeof ing === 'string' ? { name: ing, quantity: '' } : ing
//                 ),
//                 instructions: recipe.instructions || [],
//                 dietaryTags: recipe.dietaryTags || [],
//                 allergens: recipe.allergens || []
//             });
//         }

//         // 🔥 Node 2: Not found - Call Gemini
//         console.log('⚡ Recipe not in DB, calling Gemini...');
        
//         const dietaryNote = dietaryPreferences.length > 0
//             ? `Make sure the recipe is suitable for someone with these dietary preferences: ${dietaryPreferences.join(', ')}.`
//             : 'No specific dietary restrictions.';

//         const allergyNote = allergies.length > 0
//             ? `Avoid these allergens: ${allergies.join(', ')}.`
//             : '';

//         const prompt = `Give me a **standard and traditional** recipe for '${query}' in JSON format **without any code block markers or markdown**. 
// ${dietaryNote} ${allergyNote}
// Use this structure:
// {
//   "name": "Recipe Name",
//   "image_url": "",
//   "ingredients": [
//     {"name": "ingredient1", "quantity": "amount"},
//     {"name": "ingredient2", "quantity": "amount"}
//   ],
//   "instructions": ["Step 1", "Step 2"],
//   "dietaryTags": ["vegetarian", "gluten-free"],
//   "allergens": ["nuts", "dairy"]
// }
// Return valid JSON only.`;

//         const geminiRecipe = await callGeminiAPI(prompt);
//         const imageUrl = await fetchImageUrl(query);
//         geminiRecipe.image_url = imageUrl;
//         geminiRecipe.name = geminiRecipe.name || query;

//         // 💾 Save to MongoDB
//         const newRecipe = new Recipe({
//             title: geminiRecipe.name,
//             name: geminiRecipe.name,
//             image_url: geminiRecipe.image_url,
//             ingredients: geminiRecipe.ingredients || [],
//             instructions: geminiRecipe.instructions || [],
//             dietaryTags: geminiRecipe.dietaryTags || dietaryPreferences,
//             allergens: geminiRecipe.allergens || [],
//             source: 'gemini'
//         });

//         await newRecipe.save();
//         console.log('💾 Saved new recipe to MongoDB:', newRecipe.title);

//         res.json(geminiRecipe);
//     } catch (error) {
//         console.error('Error in generateRecipe:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // 2. GET RECIPES BY INGREDIENTS
// const getRecipesByIngredients = async (req, res) => {
//     try {
//         const { ingredients = [], dietaryPreferences = [], allergies = [] } = req.body;

//         if (!ingredients || ingredients.length === 0) {
//             return res.status(400).json({ error: 'Ingredients are required' });
//         }

//         // Check MongoDB first
//         const dbRecipes = await Recipe.find({
//             'ingredients.name': { $all: ingredients.map(i => new RegExp(i, 'i')) }
//         }).limit(5);

//         if (dbRecipes.length >= 3) {
//             console.log('✅ Found recipes in MongoDB by ingredients');
//             return res.json(dbRecipes.map(r => ({
//                 name: r.title || r.name,
//                 image_url: r.image_url || '',
//                 ingredients: r.ingredients,
//                 instructions: r.instructions
//             })));
//         }

//         // Call Gemini
//         const dietaryPart = dietaryPreferences.length > 0 ? `suitable for ${dietaryPreferences.join(', ')} diet` : '';
//         const allergyPart = allergies.length > 0 ? `excluding ${allergies.join(', ')}` : '';

//         const prompt = `Suggest 5 traditional recipes using only these ingredients: ${ingredients.join(', ')} ${dietaryPart} ${allergyPart}. 
// Return a JSON array without markdown:
// [{
//   "name": "Recipe Name",
//   "image_url": "",
//   "ingredients": [{"name": "ingredient", "quantity": "amount"}],
//   "instructions": ["Step 1"],
//   "dietaryTags": [],
//   "allergens": []
// }]`;

//         const geminiRecipes = await callGeminiAPI(prompt);

//         const recipesWithImages = await Promise.all(
//             geminiRecipes.map(async (recipe) => {
//                 recipe.image_url = await fetchImageUrl(recipe.name);
                
//                 const newRecipe = new Recipe({
//                     title: recipe.name,
//                     name: recipe.name,
//                     image_url: recipe.image_url,
//                     ingredients: recipe.ingredients || [],
//                     instructions: recipe.instructions || [],
//                     dietaryTags: recipe.dietaryTags || [],
//                     allergens: recipe.allergens || [],
//                     source: 'gemini'
//                 });

//                 await newRecipe.save();
//                 return recipe;
//             })
//         );

//         res.json(recipesWithImages);
//     } catch (error) {
//         console.error('Error in getRecipesByIngredients:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // 3. GET RECIPE SUGGESTIONS (for voice search)
// const getRecipeSuggestions = async (req, res) => {
//     try {
//         const { query, dietaryPreferences = [] } = req.body;

//         if (!query) {
//             return res.status(400).json({ error: 'Query is required' });
//         }

//         const dietaryPart = dietaryPreferences.length > 0
//             ? `suitable for someone with: ${dietaryPreferences.join(', ')}`
//             : '';

//         const prompt = `The user said '${query}'. Suggest 4 specific, popular recipes containing '${query}' ${dietaryPart}. 
// Return ONLY a JSON array: ["Recipe 1", "Recipe 2", "Recipe 3", "Recipe 4"]`;

//         const suggestions = await callGeminiAPI(prompt);
//         res.json(suggestions);
//     } catch (error) {
//         console.error('Error in getRecipeSuggestions:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // 4. GET SUGGESTIONS BY CATEGORY
// const getSuggestionsByCategory = async (req, res) => {
//     try {
//         const { category, dietaryPreferences = [] } = req.body;

//         if (!category) {
//             return res.status(400).json({ error: 'Category is required' });
//         }

//         const now = new Date();
//         const timeOfDay = now.getHours() < 12 ? 'morning' : (now.getHours() < 18 ? 'afternoon' : 'evening');
//         const seed = now.getMilliseconds();

//         const dietaryPart = dietaryPreferences.length > 0
//             ? `suitable for ${dietaryPreferences.join(', ')}`
//             : '';

//         const prompt = `Suggest 10 unique ${category} recipes ${dietaryPart} ideal for ${timeOfDay}. Variety seed: ${seed}. Return JSON array: ["Recipe 1", "Recipe 2"]`;

//         const suggestions = await callGeminiAPI(prompt);
//         res.json(suggestions);
//     } catch (error) {
//         console.error('Error in getSuggestionsByCategory:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // 5. GET MULTIPLE RECIPES
// const getMultipleRecipes = async (req, res) => {
//     try {
//         const { recipeNames = [] } = req.body;

//         if (!recipeNames || recipeNames.length === 0) {
//             return res.status(400).json({ error: 'Recipe names are required' });
//         }

//         const recipes = await Promise.all(
//             recipeNames.map(async (name) => {
//                 let recipe = await Recipe.findOne({ 
//                     title: { $regex: new RegExp(`^${name}$`, 'i') }
//                 });

//                 if (!recipe) {
//                     const prompt = `Give me a recipe for '${name}' in JSON format.`;
//                     const geminiRecipe = await callGeminiAPI(prompt);
//                     geminiRecipe.image_url = await fetchImageUrl(name);
                    
//                     recipe = new Recipe({
//                         title: geminiRecipe.name,
//                         name: geminiRecipe.name,
//                         image_url: geminiRecipe.image_url,
//                         ingredients: geminiRecipe.ingredients || [],
//                         instructions: geminiRecipe.instructions || [],
//                         source: 'gemini'
//                     });
//                     await recipe.save();
//                 }

//                 return recipe;
//             })
//         );

//         res.json(recipes);
//     } catch (error) {
//         console.error('Error in getMultipleRecipes:', error);
//         res.status(500).json({ error: error.message });
//     }
// };

// // ==================== EXPORTS ====================
// module.exports = {
//     // Web portal routes
//     getPagedRecipes,
//     getAllRecipes,
//     getRecipeById,
//     createRecipe,
//     updateRecipe,
//     deleteRecipe,
//     updateLastViewed,
    
//     // Flutter app routes (with Gemini)
//     generateRecipe,
//     getRecipesByIngredients,
//     getRecipeSuggestions,
//     getSuggestionsByCategory,
//     getMultipleRecipes
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

// ==================== HELPER FUNCTIONS ====================

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
        const response = await axios.post(GEMINI_URL, {
            contents: [{
                role: "user",
                parts: [{ text: prompt }]
            }]
        }, {
            headers: { "Content-Type": "application/json" }
        });

        let content = response.data.candidates[0].content.parts[0].text;
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(content);
    } catch (error) {
        console.error('Gemini API Error:', error.response ? error.response.data : error.message);
        throw new Error('Failed to generate recipe from Gemini');
    }
}

// ==================== NEW FLUTTER APP ROUTES (with Gemini) ====================

// 1. GENERATE SINGLE RECIPE (DB → Gemini fallback)
const generateRecipe = async (req, res) => {
    try {
        const { query, dietaryPreferences = [], allergies = [] } = req.body;

        console.log('=== generateRecipe called ===');
        console.log('Query:', query);
        console.log('Dietary Preferences:', dietaryPreferences);
        console.log('Allergies:', allergies);

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // STEP 1: Search in MongoDB
        console.log('STEP 1: Searching MongoDB...');
        const normalizedQuery = query.toLowerCase().trim();
        
        const recipe = await Recipe.findOne({ 
            $or: [
                { title: { $regex: new RegExp(`^${normalizedQuery}$`, 'i') } },
                { name: { $regex: new RegExp(`^${normalizedQuery}$`, 'i') } }
            ]
        });

        // If found in DB, return it
        if (recipe) {
            console.log('✅ FOUND IN DATABASE:', recipe.title || recipe.name);
            
            return res.json({
                name: recipe.title || recipe.name,
                image_url: recipe.image_url || '',
                ingredients: recipe.ingredients.map(ing => 
                    typeof ing === 'string' ? { name: ing, quantity: '' } : ing
                ),
                instructions: recipe.instructions || [],
                dietaryTags: recipe.dietaryTags || [],
                allergens: recipe.allergens || [],
                source: 'database'
            });
        }

        // STEP 2: Not in DB - Call Gemini
        console.log('❌ NOT FOUND IN DATABASE');
        console.log('STEP 2: Calling Gemini API...');

        const dietaryNote = dietaryPreferences.length > 0
            ? `Make sure the recipe is suitable for someone with these dietary preferences: ${dietaryPreferences.join(', ')}.`
            : '';

        const allergyNote = allergies.length > 0
            ? `Avoid these allergens: ${allergies.join(', ')}.`
            : '';

        const prompt = `Give me a traditional recipe for '${query}' in JSON format without markdown or code blocks. 
${dietaryNote} ${allergyNote}
Structure:
{
  "name": "Recipe Name",
  "image_url": "",
  "ingredients": [{"name": "ingredient", "quantity": "amount"}],
  "instructions": ["Step 1", "Step 2"],
  "dietaryTags": ["vegetarian"],
  "allergens": ["nuts"]
}
Return only valid JSON.`;

        const geminiRecipe = await callGeminiAPI(prompt);
        console.log('✅ Gemini API response received');

        // Get image
        const imageUrl = await fetchImageUrl(query);
        geminiRecipe.image_url = imageUrl;
        geminiRecipe.name = geminiRecipe.name || query;

        // STEP 3: Save to MongoDB for future use
        console.log('STEP 3: Saving to MongoDB...');
        try {
            const newRecipe = new Recipe({
                title: geminiRecipe.name,
                name: geminiRecipe.name,
                image_url: geminiRecipe.image_url,
                ingredients: geminiRecipe.ingredients || [],
                instructions: geminiRecipe.instructions || [],
                dietaryTags: geminiRecipe.dietaryTags || dietaryPreferences,
                allergens: geminiRecipe.allergens || [],
                source: 'gemini'
            });

            await newRecipe.save();
            console.log('✅ Saved to MongoDB');
        } catch (saveError) {
            console.error('⚠️ MongoDB save error (non-critical):', saveError.message);
        }

        // Return Gemini recipe
        res.json({
            ...geminiRecipe,
            source: 'gemini'
        });

    } catch (error) {
        console.error('❌ ERROR in generateRecipe:', error);
        res.status(500).json({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// 2. GET RECIPES BY INGREDIENTS
const getRecipesByIngredients = async (req, res) => {
    try {
        const { ingredients = [], dietaryPreferences = [], allergies = [] } = req.body;

        if (!ingredients || ingredients.length === 0) {
            return res.status(400).json({ error: 'Ingredients are required' });
        }

        // Check MongoDB first
        const dbRecipes = await Recipe.find({
            'ingredients.name': { $all: ingredients.map(i => new RegExp(i, 'i')) }
        }).limit(5);

        if (dbRecipes.length >= 3) {
            console.log('✅ Found recipes in MongoDB by ingredients');
            return res.json(dbRecipes.map(r => ({
                name: r.title || r.name,
                image_url: r.image_url || '',
                ingredients: r.ingredients,
                instructions: r.instructions
            })));
        }

        // Call Gemini
        const dietaryPart = dietaryPreferences.length > 0 ? `suitable for ${dietaryPreferences.join(', ')} diet` : '';
        const allergyPart = allergies.length > 0 ? `excluding ${allergies.join(', ')}` : '';

        const prompt = `Suggest 5 traditional recipes using only these ingredients: ${ingredients.join(', ')} ${dietaryPart} ${allergyPart}. 
Return a JSON array without markdown:
[{
  "name": "Recipe Name",
  "image_url": "",
  "ingredients": [{"name": "ingredient", "quantity": "amount"}],
  "instructions": ["Step 1"],
  "dietaryTags": [],
  "allergens": []
}]`;

        const geminiRecipes = await callGeminiAPI(prompt);

        const recipesWithImages = await Promise.all(
            geminiRecipes.map(async (recipe) => {
                recipe.image_url = await fetchImageUrl(recipe.name);
                
                const newRecipe = new Recipe({
                    title: recipe.name,
                    name: recipe.name,
                    image_url: recipe.image_url,
                    ingredients: recipe.ingredients || [],
                    instructions: recipe.instructions || [],
                    dietaryTags: recipe.dietaryTags || [],
                    allergens: recipe.allergens || [],
                    source: 'gemini'
                });

                await newRecipe.save();
                return recipe;
            })
        );

        res.json(recipesWithImages);
    } catch (error) {
        console.error('Error in getRecipesByIngredients:', error);
        res.status(500).json({ error: error.message });
    }
};

// 3. GET RECIPE SUGGESTIONS (for voice search)
const getRecipeSuggestions = async (req, res) => {
    try {
        const { query, dietaryPreferences = [] } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const dietaryPart = dietaryPreferences.length > 0
            ? `suitable for someone with: ${dietaryPreferences.join(', ')}`
            : '';

        const prompt = `The user said '${query}'. Suggest 4 specific, popular recipes containing '${query}' ${dietaryPart}. 
Return ONLY a JSON array: ["Recipe 1", "Recipe 2", "Recipe 3", "Recipe 4"]`;

        const suggestions = await callGeminiAPI(prompt);
        res.json(suggestions);
    } catch (error) {
        console.error('Error in getRecipeSuggestions:', error);
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