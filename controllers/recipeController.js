const Recipe = require('../models/Recipe');
const axios = require('axios');

// Validate API key
if (!process.env.GEMINI_API_KEY) {
    console.error('❌ CRITICAL: GEMINI_API_KEY is not set!');
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// ==================== WEB PORTAL ROUTES ====================

const getPagedRecipes = async (req, res) => {
    try {
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
                { 'ingredients.name': { $regex: regex } }
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
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

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

const updateLastViewed = async (req, res, next) => {
    try {
        await Recipe.findByIdAndUpdate(req.params.id, { lastViewed: new Date() });
        next();
    } catch (error) {
        console.error(error);
        next(error);
    }
};

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
            },
            timeout: 5000
        });

        if (response.data.hits && response.data.hits.length > 0) {
            return response.data.hits[0].webformatURL;
        }
    } catch (error) {
        console.error('⚠️ Image fetch error (non-critical):', error.message);
    }
    return '';
}

// ✅ FIXED: Gemini API call without "role" field
async function callGeminiAPI(prompt) {
    try {
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'undefined') {
            throw new Error('GEMINI_API_KEY is not configured');
        }

        console.log('🔹 Calling Gemini API...');
        console.log('🔹 Model:', GEMINI_MODEL);
        console.log('🔹 Prompt length:', prompt.length);

        // ✅ CORRECT REQUEST FORMAT - No "role" field!
        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        };

        const response = await axios.post(
            GEMINI_URL,
            requestBody,
            {
                headers: { "Content-Type": "application/json" },
                timeout: 30000,
                validateStatus: (status) => status < 500
            }
        );

        console.log('✅ Gemini Response Status:', response.status);

        if (response.status !== 200) {
            console.error('❌ Gemini Error:', JSON.stringify(response.data, null, 2));
            throw new Error(`Gemini API error: ${response.status}`);
        }

        if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error('❌ Invalid response structure:', JSON.stringify(response.data));
            throw new Error('Invalid response structure from Gemini');
        }

        let content = response.data.candidates[0].content.parts[0].text;
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        console.log('🔹 Raw response (first 200 chars):', content.substring(0, 200));

        const parsed = JSON.parse(content);
        console.log('✅ Successfully parsed JSON');
        
        return parsed;

    } catch (error) {
        console.error('❌ Gemini API Error:');
        console.error('- Type:', error.constructor.name);
        console.error('- Message:', error.message);
        
        if (error.response) {
            console.error('- Status:', error.response.status);
            console.error('- Data:', JSON.stringify(error.response.data));
        }
        
        throw new Error(`Gemini API failed: ${error.message}`);
    }
}

// ==================== FLUTTER APP ROUTES ====================

const generateRecipe = async (req, res) => {
    try {
        console.log('=== generateRecipe called ===');
        const { query, dietaryPreferences = [], allergies = [] } = req.body;
        
        console.log('📝 Query:', query);
        console.log('🥗 Dietary:', dietaryPreferences);
        console.log('⚠️ Allergies:', allergies);

        if (!query || query.trim() === '') {
            return res.status(400).json({ error: 'Query is required' });
        }

        // STEP 1: Search MongoDB
        console.log('STEP 1: 🔍 Searching MongoDB...');
        const normalizedQuery = query.trim().toLowerCase();
        
        let recipe = null;
        try {
            recipe = await Recipe.findOne({ 
                $or: [
                    { title: { $regex: new RegExp(normalizedQuery, 'i') } },
                    { name: { $regex: new RegExp(normalizedQuery, 'i') } }
                ]
            });
        } catch (dbError) {
            console.error('⚠️ MongoDB search error:', dbError.message);
        }

        if (recipe) {
            console.log('✅ FOUND IN DATABASE:', recipe.title || recipe.name);
            return res.json({
                name: recipe.title || recipe.name,
                image_url: recipe.image_url || '',
                ingredients: (recipe.ingredients || []).map(ing => 
                    typeof ing === 'string' ? { name: ing, quantity: '' } : ing
                ),
                instructions: recipe.instructions || [],
                dietaryTags: recipe.dietaryTags || [],
                allergens: recipe.allergens || [],
                source: 'database'
            });
        }

        console.log('❌ NOT IN DATABASE');

        // STEP 2: Call Gemini
        console.log('STEP 2: 🤖 Calling Gemini...');

        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'undefined') {
            return res.status(503).json({ 
                error: 'Recipe generation service unavailable',
                hint: 'GEMINI_API_KEY not configured'
            });
        }

        const dietaryNote = dietaryPreferences.length > 0
            ? `Suitable for: ${dietaryPreferences.join(', ')}.`
            : '';
        const allergyNote = allergies.length > 0
            ? `Avoid: ${allergies.join(', ')}.`
            : '';

        const prompt = `Create a recipe for "${query}". ${dietaryNote} ${allergyNote}

Return ONLY valid JSON (no markdown):
{
  "name": "Recipe Name",
  "ingredients": [{"name": "ingredient", "quantity": "amount"}],
  "instructions": ["Step 1", "Step 2"],
  "dietaryTags": ["vegetarian"],
  "allergens": ["nuts"]
}`;

        let geminiRecipe;
        try {
            geminiRecipe = await callGeminiAPI(prompt);
        } catch (geminiError) {
            console.error('❌ Gemini call failed:', geminiError.message);
            return res.status(500).json({ 
                error: 'Failed to generate recipe',
                details: geminiError.message
            });
        }

        // STEP 3: Normalize response
        geminiRecipe.name = geminiRecipe.name || query;
        geminiRecipe.ingredients = Array.isArray(geminiRecipe.ingredients) 
            ? geminiRecipe.ingredients 
            : [];
        geminiRecipe.instructions = Array.isArray(geminiRecipe.instructions) 
            ? geminiRecipe.instructions 
            : [];
        geminiRecipe.dietaryTags = geminiRecipe.dietaryTags || dietaryPreferences;
        geminiRecipe.allergens = geminiRecipe.allergens || [];

        // STEP 4: Fetch image
        console.log('STEP 3: 🖼️ Fetching image...');
        try {
            geminiRecipe.image_url = await fetchImageUrl(query);
        } catch {
            geminiRecipe.image_url = '';
        }

        // STEP 5: Save to MongoDB
        console.log('STEP 4: 💾 Saving to MongoDB...');
        try {
            const newRecipe = new Recipe({
                title: geminiRecipe.name,
                name: geminiRecipe.name,
                image_url: geminiRecipe.image_url,
                ingredients: geminiRecipe.ingredients,
                instructions: geminiRecipe.instructions,
                dietaryTags: geminiRecipe.dietaryTags,
                allergens: geminiRecipe.allergens,
                source: 'gemini'
            });
            await newRecipe.save();
            console.log('✅ Saved to MongoDB');
        } catch (saveError) {
            console.error('⚠️ Save error (non-critical):', saveError.message);
        }

        console.log('✅ Returning recipe');
        res.json({ ...geminiRecipe, source: 'gemini' });

    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

const getRecipesByIngredients = async (req, res) => {
    try {
        const { ingredients = [], dietaryPreferences = [], allergies = [] } = req.body;

        if (!ingredients || ingredients.length === 0) {
            return res.status(400).json({ error: 'Ingredients required' });
        }

        const dbRecipes = await Recipe.find({
            'ingredients.name': { $in: ingredients.map(i => new RegExp(i, 'i')) }
        }).limit(5);

        if (dbRecipes.length >= 3) {
            return res.json(dbRecipes.map(r => ({
                name: r.title || r.name,
                image_url: r.image_url || '',
                ingredients: r.ingredients,
                instructions: r.instructions
            })));
        }

        const dietaryPart = dietaryPreferences.length > 0 
            ? `for ${dietaryPreferences.join(', ')}` 
            : '';
        const allergyPart = allergies.length > 0 
            ? `avoiding ${allergies.join(', ')}` 
            : '';

        const prompt = `5 recipes using: ${ingredients.join(', ')} ${dietaryPart} ${allergyPart}. 
Return JSON array:
[{"name":"Recipe","ingredients":[{"name":"x","quantity":"y"}],"instructions":["Step 1"],"dietaryTags":[],"allergens":[]}]`;

        const geminiRecipes = await callGeminiAPI(prompt);
        const recipesWithImages = await Promise.all(
            geminiRecipes.map(async (recipe) => {
                recipe.image_url = await fetchImageUrl(recipe.name);
                try {
                    await new Recipe({ ...recipe, source: 'gemini' }).save();
                } catch (e) {
                    console.error('Save error:', e.message);
                }
                return recipe;
            })
        );

        res.json(recipesWithImages);
    } catch (error) {
        console.error('Error in getRecipesByIngredients:', error);
        res.status(500).json({ error: error.message });
    }
};

const getRecipeSuggestions = async (req, res) => {
    try {
        const { query, dietaryPreferences = [] } = req.body;
        if (!query) return res.status(400).json({ error: 'Query required' });

        const dietaryPart = dietaryPreferences.length > 0
            ? `for ${dietaryPreferences.join(', ')}`
            : '';

        const prompt = `Suggest 4 recipes with "${query}" ${dietaryPart}. Return JSON array: ["Recipe 1", "Recipe 2", "Recipe 3", "Recipe 4"]`;
        const suggestions = await callGeminiAPI(prompt);
        res.json(suggestions);
    } catch (error) {
        console.error('Error in getRecipeSuggestions:', error);
        res.status(500).json({ error: error.message });
    }
};

const getSuggestionsByCategory = async (req, res) => {
    try {
        const { category, dietaryPreferences = [] } = req.body;
        if (!category) return res.status(400).json({ error: 'Category required' });

        const now = new Date();
        const timeOfDay = now.getHours() < 12 ? 'morning' : (now.getHours() < 18 ? 'afternoon' : 'evening');
        const dietaryPart = dietaryPreferences.length > 0
            ? `for ${dietaryPreferences.join(', ')}`
            : '';

        const prompt = `10 ${category} recipes ${dietaryPart} for ${timeOfDay}. Return JSON: ["Recipe 1", "Recipe 2", ...]`;
        const suggestions = await callGeminiAPI(prompt);
        res.json(suggestions);
    } catch (error) {
        console.error('Error in getSuggestionsByCategory:', error);
        res.status(500).json({ error: error.message });
    }
};

const getMultipleRecipes = async (req, res) => {
    try {
        const { recipeNames = [] } = req.body;
        if (!recipeNames || recipeNames.length === 0) {
            return res.status(400).json({ error: 'Recipe names required' });
        }

        const recipes = await Promise.all(
            recipeNames.map(async (name) => {
                let recipe = await Recipe.findOne({ 
                    $or: [
                        { title: { $regex: new RegExp(name, 'i') } },
                        { name: { $regex: new RegExp(name, 'i') } }
                    ]
                });

                if (!recipe) {
                    const prompt = `Recipe for "${name}" in JSON format.`;
                    const geminiRecipe = await callGeminiAPI(prompt);
                    geminiRecipe.image_url = await fetchImageUrl(name);
                    recipe = await new Recipe({ ...geminiRecipe, source: 'gemini' }).save();
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
    getPagedRecipes,
    getAllRecipes,
    getRecipeById,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    updateLastViewed,
    generateRecipe,
    getRecipesByIngredients,
    getRecipeSuggestions,
    getSuggestionsByCategory,
    getMultipleRecipes
};













