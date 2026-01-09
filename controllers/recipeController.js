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
// async function callGeminiAPI(prompt) {
//     try {
//         if (!GEMINI_API_KEY || GEMINI_API_KEY === 'undefined') {
//             throw new Error('GEMINI_API_KEY is not configured');
//         }

//         console.log('🔹 Calling Gemini API...');
//         console.log('🔹 Prompt length:', prompt.length);

//         // ✅ CORRECT REQUEST FORMAT - No "role" field!
//         const requestBody = {
//             contents: [{
//                 parts: [{
//                     text: prompt
//                 }]
//             }]
//         };

//         console.log('🔹 Request structure:', JSON.stringify({ 
//             contentsCount: requestBody.contents.length,
//             partsCount: requestBody.contents[0].parts.length 
//         }));

//         const response = await axios.post(
//             GEMINI_URL,
//             requestBody,
//             {
//                 headers: { "Content-Type": "application/json" },
//                 timeout: 30000,
//                 validateStatus: (status) => status < 500
//             }
//         );

//         console.log('✅ Gemini Response Status:', response.status);

//         if (response.status !== 200) {
//             console.error('❌ Gemini Error Response:', JSON.stringify(response.data, null, 2));
//             throw new Error(`Gemini API returned status ${response.status}: ${JSON.stringify(response.data)}`);
//         }

//         if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
//             console.error('❌ Invalid response structure:', JSON.stringify(response.data, null, 2));
//             throw new Error('Invalid response structure from Gemini API');
//         }

//         let content = response.data.candidates[0].content.parts[0].text;
        
//         // Clean markdown formatting
//         content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
//         console.log('🔹 Cleaned response (first 200 chars):', content.substring(0, 200));

//         // Parse JSON
//         const parsed = JSON.parse(content);
//         console.log('✅ Successfully parsed JSON response');
        
//         return parsed;

//     } catch (error) {
//         console.error('❌ Gemini API Error Details:');
//         console.error('- Type:', error.constructor.name);
//         console.error('- Message:', error.message);
        
//         if (error.response) {
//             console.error('- Status:', error.response.status);
//             console.error('- Status Text:', error.response.statusText);
//             console.error('- Response Data:', JSON.stringify(error.response.data, null, 2));
//         }
        
//         if (error.code === 'ECONNABORTED') {
//             throw new Error('Gemini API request timed out after 30 seconds');
//         }
        
//         if (error.message.includes('JSON')) {
//             throw new Error(`Failed to parse Gemini response as JSON: ${error.message}`);
//         }
        
//         throw new Error(`Gemini API failed: ${error.message}`);
//     }
// }

async function callGeminiAPI(prompt) {
    try {
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'undefined') {
            throw new Error('GEMINI_API_KEY is not configured');
        }

        console.log('🔹 Calling Gemini API...');
        console.log('🔹 Prompt length:', prompt.length);

        const requestBody = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        };

        console.log('🔹 Request structure:', JSON.stringify({ 
            contentsCount: requestBody.contents.length,
            partsCount: requestBody.contents[0].parts.length 
        }));

        const response = await axios.post(
            GEMINI_URL,
            requestBody,
            {
                headers: { "Content-Type": "application/json" },
                timeout: 60000, // ✅ CHANGED: Increased from 30000 to 60000 (60 seconds)
                validateStatus: (status) => status < 500
            }
        );

        console.log('✅ Gemini Response Status:', response.status);

        if (response.status !== 200) {
            console.error('❌ Gemini Error Response:', JSON.stringify(response.data, null, 2));
            throw new Error(`Gemini API returned status ${response.status}: ${JSON.stringify(response.data)}`);
        }

        if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error('❌ Invalid response structure:', JSON.stringify(response.data, null, 2));
            throw new Error('Invalid response structure from Gemini API');
        }

        let content = response.data.candidates[0].content.parts[0].text;
        
        // Clean markdown formatting
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        console.log('🔹 Cleaned response (first 200 chars):', content.substring(0, 200));

        // Parse JSON
        const parsed = JSON.parse(content);
        console.log('✅ Successfully parsed JSON response');
        
        return parsed;

    } catch (error) {
        console.error('❌ Gemini API Error Details:');
        console.error('- Type:', error.constructor.name);
        console.error('- Message:', error.message);
        
        if (error.response) {
            console.error('- Status:', error.response.status);
            console.error('- Status Text:', error.response.statusText);
            console.error('- Response Data:', JSON.stringify(error.response.data, null, 2));
        }
        
        if (error.code === 'ECONNABORTED') {
            throw new Error('Gemini API request timed out after 60 seconds'); // ✅ CHANGED: Updated error message
        }
        
        if (error.message.includes('JSON')) {
            throw new Error(`Failed to parse Gemini response as JSON: ${error.message}`);
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
        console.log('🥗 Dietary Preferences:', dietaryPreferences);
        console.log('⚠️ Allergies:', allergies);

        if (!query || query.trim() === '') {
            return res.status(400).json({ error: 'Query is required and cannot be empty' });
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

        console.log('❌ NOT FOUND IN DATABASE');

        // STEP 2: Call Gemini API
        console.log('STEP 2: 🤖 Calling Gemini API...');

        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'undefined') {
            return res.status(503).json({ 
                error: 'Recipe generation service is unavailable',
                hint: 'GEMINI_API_KEY is not configured'
            });
        }

        const dietaryNote = dietaryPreferences.length > 0
            ? `This recipe must be suitable for: ${dietaryPreferences.join(', ')}.`
            : '';
        const allergyNote = allergies.length > 0
            ? `IMPORTANT: Avoid these allergens: ${allergies.join(', ')}.`
            : '';

        const prompt = `Create a detailed traditional recipe for "${query}". ${dietaryNote} ${allergyNote}

Return ONLY valid JSON without any markdown, code blocks, or extra text:
{
  "name": "Recipe Name",
  "ingredients": [{"name": "ingredient name", "quantity": "amount with unit"}],
  "instructions": ["Step 1 description", "Step 2 description"],
  "dietaryTags": ["vegetarian", "gluten-free"],
  "allergens": ["nuts", "dairy"]
}`;

        let geminiRecipe;
        try {
            geminiRecipe = await callGeminiAPI(prompt);
            console.log('✅ Gemini API call successful');
        } catch (geminiError) {
            console.error('❌ Gemini API call failed:', geminiError.message);
            return res.status(500).json({ 
                error: 'Failed to generate recipe from AI',
                details: geminiError.message,
                step: 'gemini_api_call'
            });
        }

        // STEP 3: Normalize and validate response
        console.log('STEP 3: 📋 Normalizing response...');
        geminiRecipe.name = geminiRecipe.name || query;
        geminiRecipe.ingredients = Array.isArray(geminiRecipe.ingredients) 
            ? geminiRecipe.ingredients 
            : [];
        geminiRecipe.instructions = Array.isArray(geminiRecipe.instructions) 
            ? geminiRecipe.instructions 
            : [];
        geminiRecipe.dietaryTags = Array.isArray(geminiRecipe.dietaryTags)
            ? geminiRecipe.dietaryTags
            : dietaryPreferences;
        geminiRecipe.allergens = Array.isArray(geminiRecipe.allergens)
            ? geminiRecipe.allergens
            : [];

        // STEP 4: Fetch image
        console.log('STEP 4: 🖼️ Fetching image...');
        try {
            geminiRecipe.image_url = await fetchImageUrl(query);
            console.log('✅ Image fetched:', !!geminiRecipe.image_url);
        } catch (imgError) {
            console.error('⚠️ Image fetch failed (non-critical):', imgError.message);
            geminiRecipe.image_url = '';
        }

        // STEP 5: Save to MongoDB
        console.log('STEP 5: 💾 Saving to MongoDB...');
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
            console.log('✅ Successfully saved to MongoDB');
        } catch (saveError) {
            console.error('⚠️ MongoDB save error (non-critical):', saveError.message);
        }

        // STEP 6: Return response
        console.log('✅ Returning generated recipe to client');
        res.json({ 
            ...geminiRecipe, 
            source: 'gemini' 
        });

    } catch (error) {
        console.error('❌ CRITICAL ERROR in generateRecipe:');
        console.error('- Type:', error.constructor.name);
        console.error('- Message:', error.message);
        console.error('- Stack:', error.stack);
        
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message,
            type: error.constructor.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

const getRecipesByIngredients = async (req, res) => {
  try {
    const { ingredients = [], dietaryPreferences = [] } = req.body;

    if (!ingredients || ingredients.length === 0) {
      return res.status(400).json({ error: 'At least one ingredient is required' });
    }

    // Normalize ingredients: trim and lowercase
    const normalizedIngredients = ingredients.map(i => i.trim().toLowerCase());

    // =========================
    // STEP 1: Search in MongoDB
    // Match recipes that contain all user ingredients (allow extra ingredients)
    // =========================
    let dbRecipes = await Recipe.find({
      'ingredients.name': {
        $all: normalizedIngredients.map(i => new RegExp(`^${i}$`, 'i'))
      }
    }).limit(10);

    if (dbRecipes.length > 0) {
      // Map DB recipes to clean response
      const response = dbRecipes.map(r => ({
        name: r.title || r.name,
        image_url: r.image_url || '',
        ingredients: r.ingredients,
        instructions: r.instructions || [],
        dietaryTags: r.dietaryTags || []
      }));
      return res.json(response);
    }

    // =========================
    // STEP 2: No DB recipes, call Gemini
    // =========================
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Recipe generation service unavailable' });
    }

    const dietaryPart = dietaryPreferences.length > 0 
      ? `suitable for ${dietaryPreferences.join(', ')}`
      : '';

    const prompt = `Suggest 5 recipes using ONLY these ingredients: ${normalizedIngredients.join(', ')}. ${dietaryPart}. 
Return JSON array without markdown:
[{"name":"Recipe Name","ingredients":[{"name":"ingredient","quantity":"amount"}],"instructions":["Step 1"],"dietaryTags":[]}]`;

    let geminiRecipes = await callGeminiAPI(prompt);

    // Filter to strictly match ingredients
    geminiRecipes = geminiRecipes.filter(recipe =>
      Array.isArray(recipe.ingredients) &&
      recipe.ingredients.every(ing => normalizedIngredients.includes(ing.name.toLowerCase()))
    );

    // Save generated recipes to DB and fetch images
    const recipesWithImages = await Promise.all(
      geminiRecipes.map(async (recipe) => {
        recipe.image_url = await fetchImageUrl(recipe.name);
        const newRecipe = new Recipe({
          title: recipe.name,
          name: recipe.name,
          image_url: recipe.image_url,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions || [],
          dietaryTags: recipe.dietaryTags || [],
          source: 'gemini'
        });
        await newRecipe.save().catch(() => {});
        return recipe;
      })
    );

    return res.json(recipesWithImages);

  } catch (error) {
    console.error('Error in getRecipesByIngredients:', error);
    return res.status(500).json({ error: error.message });
  }
};

const generateWeeklyMealPlan = async (req, res) => {
    try {
        console.log('=== generateWeeklyMealPlan called ===');
        const { diet, goal, calories } = req.body;

        console.log('📝 Diet:', diet);
        console.log('🎯 Goal:', goal);
        console.log('🔥 Calories:', calories);

        // Validate input
        if (!diet || !goal || !calories) {
            return res.status(400).json({ 
                error: 'Missing required fields: diet, goal, and calories are required' 
            });
        }

        if (calories < 1200 || calories > 4000) {
            return res.status(400).json({ 
                error: 'Calories must be between 1200 and 4000' 
            });
        }

        // Check if Gemini API key is configured
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'undefined') {
            return res.status(503).json({ 
                error: 'Meal plan generation service is unavailable',
                hint: 'GEMINI_API_KEY is not configured'
            });
        }

        console.log('🤖 Calling Gemini API for meal plan generation...');

        // Create the prompt for Gemini
        const dietInstruction = diet !== 'None' 
            ? `All meals must be ${diet}.` 
            : '';

        const goalInstruction = goal === 'Lose Weight' 
            ? 'Focus on low-calorie, filling meals.' 
            : goal === 'Gain Muscle' 
            ? 'Include high-protein meals.' 
            : goal === 'Stay Healthy' 
            ? 'Provide balanced, nutritious meals.' 
            : 'Maintain balanced portions.';

        const prompt = `Create a complete 7-day meal plan with the following requirements:
- Diet type: ${diet}
- Goal: ${goal}
- Daily calorie target: ${calories} calories
- ${dietInstruction}
- ${goalInstruction}

For each day (Monday through Sunday), provide:
- Breakfast (approximately 30% of daily calories)
- Lunch (approximately 35% of daily calories)
- Dinner (approximately 35% of daily calories)

Return ONLY valid JSON without any markdown or code blocks:
{
  "Monday": [
    {"meal": "Breakfast", "recipe": "Recipe name", "calories": 600},
    {"meal": "Lunch", "recipe": "Recipe name", "calories": 700},
    {"meal": "Dinner", "recipe": "Recipe name", "calories": 700}
  ],
  "Tuesday": [...],
  "Wednesday": [...],
  "Thursday": [...],
  "Friday": [...],
  "Saturday": [...],
  "Sunday": [...]
}`;

        let mealPlan;
        try {
            mealPlan = await callGeminiAPI(prompt);
            console.log('✅ Gemini API call successful');
        } catch (geminiError) {
            console.error('❌ Gemini API call failed:', geminiError.message);
            return res.status(500).json({ 
                error: 'Failed to generate meal plan from AI',
                details: geminiError.message
            });
        }

        // Validate the response structure
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const isValid = days.every(day => 
            mealPlan[day] && 
            Array.isArray(mealPlan[day]) && 
            mealPlan[day].length === 3
        );

        if (!isValid) {
            console.error('❌ Invalid meal plan structure received');
            return res.status(500).json({ 
                error: 'Received invalid meal plan structure from AI'
            });
        }

        // Normalize the meal plan
        const normalizedPlan = {};
        days.forEach(day => {
            normalizedPlan[day] = mealPlan[day].map(meal => ({
                meal: meal.meal || meal.type || 'Meal',
                recipe: meal.recipe || meal.name || 'Recipe',
                calories: parseInt(meal.calories) || 0
            }));
        });

        console.log('✅ Returning generated meal plan to client');
        res.json({
            mealPlan: normalizedPlan,
            summary: {
                diet,
                goal,
                dailyCalories: calories,
                generatedAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ CRITICAL ERROR in generateWeeklyMealPlan:');
        console.error('- Type:', error.constructor.name);
        console.error('- Message:', error.message);
        console.error('- Stack:', error.stack);
        
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message,
            type: error.constructor.name
        });
    }
};



const getRecipeSuggestions = async (req, res) => {
    try {
        const { query, dietaryPreferences = [] } = req.body;
        if (!query) return res.status(400).json({ error: 'Query is required' });

        const dietaryPart = dietaryPreferences.length > 0
            ? `suitable for ${dietaryPreferences.join(', ')}`
            : '';

        const prompt = `Suggest 4 popular recipes with "${query}" ${dietaryPart}. Return ONLY a JSON array: ["Recipe 1", "Recipe 2", "Recipe 3", "Recipe 4"]`;
        const suggestions = await callGeminiAPI(prompt);
        res.json(suggestions);
    } catch (error) {
        console.error('Error in getRecipeSuggestions:', error);
        res.status(500).json({ error: error.message });
    }
};

function normalizeGeminiRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;

  const title =
    recipe.title ||
    recipe.name ||
    recipe.recipeName ||
    '';

  if (!title.trim()) return null;

  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
    : [];

  let instructions = [];
  if (Array.isArray(recipe.instructions)) {
    instructions = recipe.instructions
      .map(step => {
        if (typeof step === 'string') return step;
        if (typeof step === 'object' && step.description)
          return step.description;
        return null;
      })
      .filter(Boolean);
  }

  if (!ingredients.length || !instructions.length) return null;

  return {
    title: title.trim(),
    ingredients,
    instructions,
    dietaryTags: Array.isArray(recipe.dietaryTags)
      ? recipe.dietaryTags
      : []
  };
}

/* ===============================
   CONTROLLER
================================ */

const getSuggestionsByCategory = async (req, res) => {
  try {
    const {
      category,
      dietaryPreferences = [],
      page = 1,
      limit = 3,
      excludeIds = [] // NEW: Track already shown recipes
    } = req.body;

    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    console.log(`📋 ${category} | Page ${page} | Limit ${limit}`);

    /* -----------------------------
       QUERY
    ----------------------------- */
    const query = {
      category: new RegExp(`^${category}$`, 'i')
    };

    if (dietaryPreferences.length > 0) {
      query.dietaryTags = { $in: dietaryPreferences };
    }

    // Exclude already shown recipes
    if (excludeIds.length > 0) {
      query._id = { $nin: excludeIds };
    }

    /* -----------------------------
       EXISTING TITLES (ANTI-DUP)
    ----------------------------- */
    const existingTitles = await Recipe.find({
      category: new RegExp(`^${category}$`, 'i'),
      ...(dietaryPreferences.length > 0 && { dietaryTags: { $in: dietaryPreferences } })
    })
      .select('title -_id')
      .lean();

    const usedTitles = existingTitles.map(r => r.title);

    let totalCount = await Recipe.countDocuments({
      category: new RegExp(`^${category}$`, 'i'),
      ...(dietaryPreferences.length > 0 && { dietaryTags: { $in: dietaryPreferences } })
    });
    
    const requiredCount = page * limit;

    /* -----------------------------
       GENERATE IF NEEDED
    ----------------------------- */
    if (totalCount < requiredCount && process.env.GEMINI_API_KEY) {
      const toGenerate = requiredCount - totalCount;

      console.log(`⚡ Generating ${toGenerate} new ${category} recipes`);

      /* ---- STEP 1: NAMES ---- */
      const namesPrompt = `
Suggest ${toGenerate} UNIQUE ${category} recipes.

DO NOT repeat or closely resemble any of these:
${usedTitles.slice(0, 30).join('\n')}

Each recipe MUST be appropriate ONLY for the category "${category}".
Lunch ≠ Dinner ≠ Breakfast.

Return ONLY a JSON array of NEW recipe names.
`;

      let names = await callGeminiAPI(namesPrompt);
      if (!Array.isArray(names)) names = [];

      if (!names.length) {
        console.warn('⚠️ Gemini returned no names');
      }

      /* ---- STEP 2: DETAILS ---- */
      const detailPrompt = `
Create detailed recipes for the following ${category} dishes.

Return ONLY valid JSON array.

Allowed dietaryTags:
vegetarian, vegan, gluten-free, dairy-free, keto, paleo, low-carb, halal, kosher

Each recipe MUST include:
- title
- ingredients (array of strings)
- instructions (array of strings)

Recipes:
${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}
`;

      let generated = await callGeminiAPI(detailPrompt);
      if (!Array.isArray(generated)) generated = [];

      /* ---- STEP 3: SAVE ---- */
      for (const raw of generated) {
        const normalized = normalizeGeminiRecipe(raw);
        if (!normalized) continue;

        const exists = await Recipe.exists({
          title: normalized.title,
          category
        });

        if (exists) {
          console.log(`⏭ Duplicate skipped: ${normalized.title}`);
          continue;
        }

        let image_url = '';
        try {
          image_url = await fetchImageUrl(normalized.title);
        } catch {
          image_url = '';
        }

        await Recipe.create({
          title: normalized.title,
          name: normalized.title,
          image_url,
          ingredients: normalized.ingredients,
          instructions: normalized.instructions,
          dietaryTags: sanitizeArray(normalized.dietaryTags, [
            'vegetarian','vegan','gluten-free','dairy-free',
            'keto','paleo','low-carb','halal','kosher'
          ]),
          category,
          source: 'gemini'
        });

        console.log(`✅ Saved: ${normalized.title}`);
      }

      totalCount = await Recipe.countDocuments({
        category: new RegExp(`^${category}$`, 'i'),
        ...(dietaryPreferences.length > 0 && { dietaryTags: { $in: dietaryPreferences } })
      });
    }

    /* -----------------------------
       FETCH (PROPER PAGINATION)
    ----------------------------- */
    const skip = (page - 1) * limit;
    
    const recipes = await Recipe.find(query)
      .sort({ createdAt: -1 }) // Or use any consistent sort
      .skip(skip)
      .limit(limit)
      .lean();

    const hasMore = totalCount > page * limit;

    return res.json({
      recipes: recipes.map(r => ({
        _id: r._id?.toString() || '', // Include ID for tracking
        name: r.name || r.title,
        title: r.title || r.name,
        image_url: r.image_url,
        ingredients: r.ingredients,
        instructions: r.instructions,
        dietaryTags: r.dietaryTags
      })),
      pagination: {
        currentPage: page,
        totalCount,
        hasMore,
        recipesPerPage: limit
      }
    });

  } catch (error) {
    console.error('❌ getSuggestionsByCategory:', error);
    return res.status(500).json({
      error: error.message,
      recipes: [],
      pagination: {
        currentPage: 1,
        totalCount: 0,
        hasMore: false,
        recipesPerPage: 3
      }
    });
  }
};

module.exports = {
  getSuggestionsByCategory
};


// Helper
function sanitizeArray(arr, allowedValues) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(
    arr.filter(v => typeof v === 'string')
       .map(v => v.toLowerCase().trim())
       .filter(v => allowedValues.includes(v))
  )];
}



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
                        { title: { $regex: new RegExp(name, 'i') } },
                        { name: { $regex: new RegExp(name, 'i') } }
                    ]
                });

                if (!recipe) {
                    const prompt = `Create a recipe for "${name}" in JSON format without markdown.`;
                    const geminiRecipe = await callGeminiAPI(prompt);
                    geminiRecipe.image_url = await fetchImageUrl(name);
                    
                    recipe = new Recipe({
                        title: geminiRecipe.name || name,
                        name: geminiRecipe.name || name,
                        image_url: geminiRecipe.image_url,
                        ingredients: geminiRecipe.ingredients || [],
                        instructions: geminiRecipe.instructions || [],
                        dietaryTags: geminiRecipe.dietaryTags || [],
                        allergens: geminiRecipe.allergens || [],
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
    getMultipleRecipes,
    generateWeeklyMealPlan
};