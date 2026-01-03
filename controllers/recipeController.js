const Recipe = require('../models/Recipe');
const axios = require('axios');

// Validate environment variable on load
if (!process.env.GEMINI_API_KEY) {
    console.error('❌ CRITICAL: GEMINI_API_KEY is not set in environment variables!');
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Try multiple Gemini models as fallback
const GEMINI_MODELS = [
    'gemini-1.5-flash',
    'gemini-1.5-pro', 
    'gemini-pro'
];

function getGeminiUrl(modelIndex = 0) {
    const model = GEMINI_MODELS[modelIndex] || GEMINI_MODELS[0];
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
}

// ==================== EXISTING WEB PORTAL ROUTES ====================

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
                { 'ingredients.name': { $regex: regex } },
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
        const recipeId = req.params.id;
        await Recipe.findByIdAndUpdate(recipeId, { lastViewed: new Date() });
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
        console.error('⚠️ Pixabay API Error (non-critical):', error.message);
    }
    return '';
}

async function callGeminiAPI(prompt, modelIndex = 0) {
    try {
        // Check if API key exists
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'undefined') {
            throw new Error('GEMINI_API_KEY is not configured');
        }

        const GEMINI_URL = getGeminiUrl(modelIndex);
        const model = GEMINI_MODELS[modelIndex] || GEMINI_MODELS[0];

        console.log('🔹 Calling Gemini API...');
        console.log('🔹 Model:', model);
        console.log('🔹 Prompt length:', prompt.length);
        console.log('🔹 API Key (first 10 chars):', GEMINI_API_KEY.substring(0, 10) + '...');

        // Correct Gemini API request format
        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        };

        console.log('🔹 Request body:', JSON.stringify(requestBody, null, 2));

        const response = await axios.post(
            GEMINI_URL,
            requestBody,
            {
                headers: { 
                    "Content-Type": "application/json"
                },
                timeout: 30000,
                validateStatus: function (status) {
                    return status < 500; // Don't throw on 4xx errors
                }
            }
        );

        console.log('✅ Gemini API Response Status:', response.status);

        // Handle API errors
        if (response.status !== 200) {
            console.error('❌ Gemini API Error Response:', JSON.stringify(response.data, null, 2));
            
            // If this model failed and we have more to try, recurse
            if (modelIndex < GEMINI_MODELS.length - 1) {
                console.log(`⚠️ Trying next model: ${GEMINI_MODELS[modelIndex + 1]}`);
                return callGeminiAPI(prompt, modelIndex + 1);
            }
            
            throw new Error(`Gemini API error: ${response.status} - ${JSON.stringify(response.data)}`);
        }

        // Extract content
        if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error('❌ Invalid response structure:', JSON.stringify(response.data, null, 2));
            throw new Error('Invalid response structure from Gemini API');
        }

        let content = response.data.candidates[0].content.parts[0].text;
        
        // Clean markdown formatting
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        console.log('🔹 Cleaned response (first 200 chars):', content.substring(0, 200) + '...');

        // Parse JSON
        const parsed = JSON.parse(content);
        console.log('✅ Successfully parsed JSON response');
        
        return parsed;

    } catch (error) {
        console.error('❌ Gemini API Error Details:');
        console.error('- Error type:', error.constructor.name);
        console.error('- Message:', error.message);
        
        if (error.response) {
            console.error('- Status:', error.response.status);
            console.error('- Status Text:', error.response.statusText);
            console.error('- Data:', JSON.stringify(error.response.data, null, 2));
            console.error('- Headers:', JSON.stringify(error.response.headers, null, 2));
        }
        
        if (error.code === 'ECONNABORTED') {
            throw new Error('Gemini API request timed out after 30 seconds');
        }
        
        if (error.message.includes('JSON')) {
            throw new Error(`Failed to parse Gemini response: ${error.message}`);
        }
        
        throw new Error(`Gemini API failed: ${error.message}`);
    }
}

// ==================== FLUTTER APP ROUTES ====================

const generateRecipe = async (req, res) => {
    // Add response timeout protection
    let responded = false;
    const sendResponse = (statusCode, data) => {
        if (!responded) {
            responded = true;
            res.status(statusCode).json(data);
        }
    };

    try {
        console.log('=== generateRecipe called ===');
        console.log('📦 Request body:', JSON.stringify(req.body));
        console.log('🔑 Has GEMINI_API_KEY:', !!GEMINI_API_KEY);
        
        const { query, dietaryPreferences = [], allergies = [] } = req.body;

        console.log('📝 Query:', query);
        console.log('🥗 Dietary Preferences:', dietaryPreferences);
        console.log('⚠️ Allergies:', allergies);

        // Validate input
        if (!query || query.trim() === '') {
            return sendResponse(400, { error: 'Query is required and cannot be empty' });
        }

        // STEP 1: Search MongoDB
        console.log('STEP 1: 🔍 Searching MongoDB...');
        console.log('MongoDB connection state:', require('mongoose').connection.readyState);
        
        const normalizedQuery = query.toLowerCase().trim();
        console.log('Normalized query:', normalizedQuery);
        
        let recipe = null;
        try {
            recipe = await Recipe.findOne({ 
                $or: [
                    { title: { $regex: new RegExp(`^${normalizedQuery}const Recipe = require('../models/Recipe');
const axios = require('axios');

// Validate environment variable on load
if (!process.env.GEMINI_API_KEY) {
    console.error('❌ CRITICAL: GEMINI_API_KEY is not set in environment variables!');
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

// ==================== EXISTING WEB PORTAL ROUTES ====================

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
                { 'ingredients.name': { $regex: regex } },
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
        const recipeId = req.params.id;
        await Recipe.findByIdAndUpdate(recipeId, { lastViewed: new Date() });
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
        console.error('⚠️ Pixabay API Error (non-critical):', error.message);
    }
    return '';
}

async function callGeminiAPI(prompt) {
    try {
        // Check if API key exists
        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not configured');
        }

        console.log('🔹 Calling Gemini API...');
        console.log('🔹 Prompt length:', prompt.length);

        const response = await axios.post(
            GEMINI_URL,
            {
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }]
                }]
            },
            {
                headers: { "Content-Type": "application/json" },
                timeout: 30000 // 30 second timeout
            }
        );

        console.log('✅ Gemini API responded successfully');

        // Extract content
        if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response structure from Gemini API');
        }

        let content = response.data.candidates[0].content.parts[0].text;
        
        // Clean markdown formatting
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        console.log('🔹 Cleaned response:', content.substring(0, 200) + '...');

        // Parse JSON
        const parsed = JSON.parse(content);
        console.log('✅ Successfully parsed JSON response');
        
        return parsed;

    } catch (error) {
        console.error('❌ Gemini API Error Details:');
        console.error('- Message:', error.message);
        
        if (error.response) {
            console.error('- Status:', error.response.status);
            console.error('- Data:', JSON.stringify(error.response.data, null, 2));
        }
        
        if (error.code === 'ECONNABORTED') {
            throw new Error('Gemini API request timed out');
        }
        
        throw new Error(`Gemini API failed: ${error.message}`);
    }
}

// ==================== FLUTTER APP ROUTES ====================

const generateRecipe = async (req, res) => {
    // Add response timeout protection
    let responded = false;
    const sendResponse = (statusCode, data) => {
        if (!responded) {
            responded = true;
            res.status(statusCode).json(data);
        }
    };

    try {
        console.log('=== generateRecipe called ===');
        console.log('📦 Request body:', JSON.stringify(req.body));
        console.log('🔑 Has GEMINI_API_KEY:', !!GEMINI_API_KEY);
        
        const { query, dietaryPreferences = [], allergies = [] } = req.body;

        console.log('📝 Query:', query);
        console.log('🥗 Dietary Preferences:', dietaryPreferences);
        console.log('⚠️ Allergies:', allergies);

        // Validate input
        if (!query || query.trim() === '') {
            return sendResponse(400, { error: 'Query is required and cannot be empty' });
        }

, 'i') } },
                    { name: { $regex: new RegExp(`^${normalizedQuery}const Recipe = require('../models/Recipe');
const axios = require('axios');

// Validate environment variable on load
if (!process.env.GEMINI_API_KEY) {
    console.error('❌ CRITICAL: GEMINI_API_KEY is not set in environment variables!');
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;

// ==================== EXISTING WEB PORTAL ROUTES ====================

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
                { 'ingredients.name': { $regex: regex } },
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
        const recipeId = req.params.id;
        await Recipe.findByIdAndUpdate(recipeId, { lastViewed: new Date() });
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
        console.error('⚠️ Pixabay API Error (non-critical):', error.message);
    }
    return '';
}

async function callGeminiAPI(prompt) {
    try {
        // Check if API key exists
        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY is not configured');
        }

        console.log('🔹 Calling Gemini API...');
        console.log('🔹 Prompt length:', prompt.length);

        const response = await axios.post(
            GEMINI_URL,
            {
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }]
                }]
            },
            {
                headers: { "Content-Type": "application/json" },
                timeout: 30000 // 30 second timeout
            }
        );

        console.log('✅ Gemini API responded successfully');

        // Extract content
        if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid response structure from Gemini API');
        }

        let content = response.data.candidates[0].content.parts[0].text;
        
        // Clean markdown formatting
        content = content.replace(/```json/g, '').replace(/```/g, '').trim();
        
        console.log('🔹 Cleaned response:', content.substring(0, 200) + '...');

        // Parse JSON
        const parsed = JSON.parse(content);
        console.log('✅ Successfully parsed JSON response');
        
        return parsed;

    } catch (error) {
        console.error('❌ Gemini API Error Details:');
        console.error('- Message:', error.message);
        
        if (error.response) {
            console.error('- Status:', error.response.status);
            console.error('- Data:', JSON.stringify(error.response.data, null, 2));
        }
        
        if (error.code === 'ECONNABORTED') {
            throw new Error('Gemini API request timed out');
        }
        
        throw new Error(`Gemini API failed: ${error.message}`);
    }
}

// ==================== FLUTTER APP ROUTES ====================

const generateRecipe = async (req, res) => {
    // Add response timeout protection
    let responded = false;
    const sendResponse = (statusCode, data) => {
        if (!responded) {
            responded = true;
            res.status(statusCode).json(data);
        }
    };

    try {
        console.log('=== generateRecipe called ===');
        console.log('📦 Request body:', JSON.stringify(req.body));
        console.log('🔑 Has GEMINI_API_KEY:', !!GEMINI_API_KEY);
        
        const { query, dietaryPreferences = [], allergies = [] } = req.body;

        console.log('📝 Query:', query);
        console.log('🥗 Dietary Preferences:', dietaryPreferences);
        console.log('⚠️ Allergies:', allergies);

        // Validate input
        if (!query || query.trim() === '') {
            return sendResponse(400, { error: 'Query is required and cannot be empty' });
        }

, 'i') } }
                ]
            });
            console.log('MongoDB query completed. Found:', !!recipe);
        } catch (dbError) {
            console.error('❌ MongoDB query error:', dbError.message);
            // Continue to Gemini even if DB fails
        }

        if (recipe) {
            console.log('✅ FOUND IN DATABASE:', recipe.title || recipe.name);
            
            return sendResponse(200, {
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

        console.log('❌ NOT FOUND IN DATABASE');

        // STEP 2: Call Gemini API
        console.log('STEP 2: 🤖 Calling Gemini API...');

        // Check if Gemini is available
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'undefined') {
            console.error('❌ GEMINI_API_KEY is missing or invalid');
            return sendResponse(503, { 
                error: 'Recipe generation service is not configured',
                hint: 'Please check GEMINI_API_KEY environment variable' 
            });
        }

        console.log('✅ GEMINI_API_KEY is set');

        const dietaryNote = dietaryPreferences.length > 0
            ? `This recipe must be suitable for: ${dietaryPreferences.join(', ')}.`
            : '';

        const allergyNote = allergies.length > 0
            ? `IMPORTANT: This recipe MUST NOT contain: ${allergies.join(', ')}.`
            : '';

        const prompt = `Create a detailed recipe for "${query}". ${dietaryNote} ${allergyNote}

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "name": "Recipe Name",
  "image_url": "",
  "ingredients": [
    {"name": "ingredient name", "quantity": "amount with unit"}
  ],
  "instructions": ["Step 1 with details", "Step 2 with details"],
  "dietaryTags": ["vegetarian", "gluten-free"],
  "allergens": ["nuts", "dairy"]
}`;

        console.log('📤 Sending request to Gemini...');
        let geminiRecipe;
        try {
            geminiRecipe = await callGeminiAPI(prompt);
            console.log('✅ Gemini responded with:', Object.keys(geminiRecipe));
        } catch (geminiError) {
            console.error('❌ Gemini API failed:', geminiError.message);
            return sendResponse(500, { 
                error: 'Failed to generate recipe',
                details: geminiError.message,
                step: 'gemini_api_call'
            });
        }

        // STEP 3: Fetch image
        console.log('STEP 3: 🖼️ Fetching image...');
        try {
            const imageUrl = await fetchImageUrl(query);
            geminiRecipe.image_url = imageUrl;
            console.log('✅ Image URL fetched:', !!imageUrl);
        } catch (imgError) {
            console.error('⚠️ Image fetch failed (non-critical):', imgError.message);
            geminiRecipe.image_url = '';
        }
        
        geminiRecipe.name = geminiRecipe.name || query;

        // STEP 4: Save to MongoDB
        console.log('STEP 4: 💾 Saving to MongoDB...');
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
            console.log('✅ Successfully saved to MongoDB');
        } catch (saveError) {
            console.error('⚠️ MongoDB save error (non-critical):', saveError.message);
        }

        // Return recipe
        console.log('✅ Returning generated recipe');
        return sendResponse(200, {
            ...geminiRecipe,
            source: 'gemini'
        });

    } catch (error) {
        console.error('❌ CRITICAL ERROR in generateRecipe:');
        console.error('- Error type:', error.constructor.name);
        console.error('- Error message:', error.message);
        console.error('- Stack trace:', error.stack);
        
        // Send appropriate error response
        return sendResponse(500, { 
            error: 'Internal server error',
            message: error.message,
            type: error.constructor.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

const getRecipesByIngredients = async (req, res) => {
    try {
        const { ingredients = [], dietaryPreferences = [], allergies = [] } = req.body;

        console.log('=== getRecipesByIngredients called ===');
        console.log('Ingredients:', ingredients);

        if (!ingredients || ingredients.length === 0) {
            return res.status(400).json({ error: 'At least one ingredient is required' });
        }

        // Search MongoDB
        const ingredientRegexes = ingredients.map(i => new RegExp(i, 'i'));
        const dbRecipes = await Recipe.find({
            $or: [
                { 'ingredients.name': { $in: ingredientRegexes } },
                { ingredients: { $in: ingredientRegexes } }
            ]
        }).limit(5);

        if (dbRecipes.length >= 3) {
            console.log('✅ Found sufficient recipes in MongoDB');
            return res.json(dbRecipes.map(r => ({
                name: r.title || r.name,
                image_url: r.image_url || '',
                ingredients: r.ingredients,
                instructions: r.instructions,
                dietaryTags: r.dietaryTags || [],
                allergens: r.allergens || []
            })));
        }

        // Call Gemini
        console.log('🤖 Calling Gemini for recipe suggestions...');
        
        const dietaryPart = dietaryPreferences.length > 0 
            ? `suitable for ${dietaryPreferences.join(', ')} diet` 
            : '';
        const allergyPart = allergies.length > 0 
            ? `avoiding ${allergies.join(', ')}` 
            : '';

        const prompt = `Suggest 5 recipes using these ingredients: ${ingredients.join(', ')}. ${dietaryPart} ${allergyPart}

Return ONLY a JSON array (no markdown):
[{
  "name": "Recipe Name",
  "image_url": "",
  "ingredients": [{"name": "ingredient", "quantity": "amount"}],
  "instructions": ["Step 1"],
  "dietaryTags": [],
  "allergens": []
}]`;

        const geminiRecipes = await callGeminiAPI(prompt);

        // Add images and save
        const recipesWithImages = await Promise.all(
            geminiRecipes.map(async (recipe) => {
                recipe.image_url = await fetchImageUrl(recipe.name);
                
                try {
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
                } catch (err) {
                    console.error('⚠️ Error saving recipe:', err.message);
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

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const dietaryPart = dietaryPreferences.length > 0
            ? `suitable for ${dietaryPreferences.join(', ')}`
            : '';

        const prompt = `Suggest 4 popular recipes related to "${query}" ${dietaryPart}. 
Return ONLY a JSON array of recipe names: ["Recipe 1", "Recipe 2", "Recipe 3", "Recipe 4"]`;

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

        if (!category) {
            return res.status(400).json({ error: 'Category is required' });
        }

        const now = new Date();
        const hour = now.getHours();
        const timeOfDay = hour < 12 ? 'morning' : (hour < 18 ? 'afternoon' : 'evening');
        const seed = now.getMilliseconds();

        const dietaryPart = dietaryPreferences.length > 0
            ? `suitable for ${dietaryPreferences.join(', ')}`
            : '';

        const prompt = `Suggest 10 unique ${category} recipes ${dietaryPart} ideal for ${timeOfDay}. Seed: ${seed}. 
Return ONLY a JSON array: ["Recipe 1", "Recipe 2", ...]`;

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
            return res.status(400).json({ error: 'Recipe names are required' });
        }

        const recipes = await Promise.all(
            recipeNames.map(async (name) => {
                let recipe = await Recipe.findOne({ 
                    $or: [
                        { title: { $regex: new RegExp(`^${name}$`, 'i') } },
                        { name: { $regex: new RegExp(`^${name}$`, 'i') } }
                    ]
                });

                if (!recipe) {
                    const prompt = `Create a recipe for "${name}". Return valid JSON only.`;
                    const geminiRecipe = await callGeminiAPI(prompt);
                    geminiRecipe.image_url = await fetchImageUrl(name);
                    
                    recipe = new Recipe({
                        title: geminiRecipe.name || name,
                        name: geminiRecipe.name || name,
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