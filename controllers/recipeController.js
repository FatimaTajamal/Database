// 1. GENERATE SINGLE RECIPE (LangGraph: DB → Gemini)
const generateRecipe = async (req, res) => {
    try {
        const { query, dietaryPreferences = [], allergies = [] } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        // 🔥 Node 1: Check MongoDB first
        const normalizedQuery = query.toLowerCase().trim();
        console.log('🔍 Searching MongoDB for:', normalizedQuery);
        
        // Try exact match first, then partial match
        let recipe = await Recipe.findOne({ 
            $or: [
                { title: { $regex: new RegExp(`^${normalizedQuery}// 1. GENERATE SINGLE RECIPE (LangGraph: DB → Gemini)
const generateRecipe = async (req, res) => {
    try {
        const { query, dietaryPreferences = [], allergies = [] } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

, 'i') } },
                { name: { $regex: new RegExp(`^${normalizedQuery}// 1. GENERATE SINGLE RECIPE (LangGraph: DB → Gemini)
const generateRecipe = async (req, res) => {
    try {
        const { query, dietaryPreferences = [], allergies = [] } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

, 'i') } }
            ]
        });

        // If no exact match, try partial match
        if (!recipe) {
            recipe = await Recipe.findOne({ 
                $or: [
                    { title: { $regex: new RegExp(normalizedQuery, 'i') } },
                    { name: { $regex: new RegExp(normalizedQuery, 'i') } }
                ]
            });
        }

        if (recipe) {
            console.log('✅ Recipe found in MongoDB:', recipe.title || recipe.name);
            
            // Normalize ingredients format
            const normalizedIngredients = recipe.ingredients.map(ing => {
                if (typeof ing === 'string') {
                    return { name: ing, quantity: '' };
                }
                return {
                    name: ing.name || ing.ingredient || '',
                    quantity: ing.quantity || ing.amount || ''
                };
            });

            return res.json({
                name: recipe.title || recipe.name,
                image_url: recipe.image_url || '',
                ingredients: normalizedIngredients,
                instructions: Array.isArray(recipe.instructions) ? recipe.instructions : [recipe.instructions],
                dietaryTags: recipe.dietaryTags || [],
                allergens: recipe.allergens || [],
                source: recipe.source || 'database'
            });
        }

        // 🔥 Node 2: Not found - Call Gemini
        console.log('⚡ Recipe not in DB, calling Gemini for:', query);
        
        const dietaryNote = dietaryPreferences.length > 0
            ? `Make sure the recipe is suitable for someone with these dietary preferences: ${dietaryPreferences.join(', ')}.`
            : '';

        const allergyNote = allergies.length > 0
            ? `Avoid these allergens: ${allergies.join(', ')}.`
            : '';

        const prompt = `Give me a **standard and traditional** recipe for '${query}' in JSON format **without any code block markers or markdown**. 
${dietaryNote} ${allergyNote}

Use this exact structure:
{
  "name": "Recipe Name",
  "image_url": "",
  "ingredients": [
    {"name": "ingredient1", "quantity": "amount"},
    {"name": "ingredient2", "quantity": "amount"}
  ],
  "instructions": ["Step 1", "Step 2", "Step 3"],
  "dietaryTags": ["vegetarian", "gluten-free"],
  "allergens": ["nuts", "dairy"]
}

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, no explanations.`;

        console.log('📡 Calling Gemini API...');
        const geminiRecipe = await callGeminiAPI(prompt);
        console.log('✅ Received response from Gemini');
        
        // Fetch image
        console.log('🖼️ Fetching image from Pixabay...');
        const imageUrl = await fetchImageUrl(query);
        geminiRecipe.image_url = imageUrl;
        geminiRecipe.name = geminiRecipe.name || query;

        // Validate ingredients structure
        if (!geminiRecipe.ingredients || !Array.isArray(geminiRecipe.ingredients)) {
            console.warn('⚠️ Invalid ingredients structure from Gemini, fixing...');
            geminiRecipe.ingredients = [];
        }

        // 💾 Save to MongoDB for future use
        try {
            const newRecipe = new Recipe({
                title: geminiRecipe.name,
                name: geminiRecipe.name,
                image_url: geminiRecipe.image_url,
                ingredients: geminiRecipe.ingredients,
                instructions: geminiRecipe.instructions || [],
                dietaryTags: geminiRecipe.dietaryTags || dietaryPreferences,
                allergens: geminiRecipe.allergens || [],
                source: 'gemini',
                createdAt: new Date()
            });

            await newRecipe.save();
            console.log('💾 Saved new recipe to MongoDB:', newRecipe.title);
        } catch (saveError) {
            console.error('⚠️ Error saving to MongoDB (non-critical):', saveError.message);
            // Continue anyway - we can still return the recipe
        }

        // Return the Gemini-generated recipe
        res.json({
            ...geminiRecipe,
            source: 'gemini'
        });

    } catch (error) {
        console.error('❌ Error in generateRecipe:', error);
        
        // Better error response
        if (error.message.includes('Gemini')) {
            return res.status(503).json({ 
                error: 'Recipe generation service unavailable',
                details: error.message 
            });
        }
        
        res.status(500).json({ 
            error: 'Failed to generate recipe',
            details: error.message 
        });
    }
};

// Helper: Call Gemini API (with better error handling)
async function callGeminiAPI(prompt) {
    try {
        console.log('📤 Sending request to Gemini...');
        
        if (!GEMINI_API_KEY) {
            throw new Error('Gemini API key is not configured');
        }

        const response = await axios.post(
            GEMINI_URL,
            {
                contents: [{
                    role: "user",
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            },
            {
                headers: { 
                    "Content-Type": "application/json"
                },
                timeout: 30000 // 30 second timeout
            }
        );

        if (!response.data || !response.data.candidates || response.data.candidates.length === 0) {
            throw new Error('No response from Gemini API');
        }

        let content = response.data.candidates[0].content.parts[0].text;
        console.log('📥 Raw Gemini response:', content.substring(0, 200) + '...');
        
        // Clean up the response
        content = content
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .replace(/^[\s\n]+/, '')
            .replace(/[\s\n]+$/, '')
            .trim();

        // Parse JSON
        const parsedContent = JSON.parse(content);
        console.log('✅ Successfully parsed Gemini response');
        
        return parsedContent;

    } catch (error) {
        console.error('❌ Gemini API Error:', error.message);
        
        if (error.response) {
            console.error('API Response Status:', error.response.status);
            console.error('API Response Data:', error.response.data);
        }
        
        if (error.code === 'ECONNABORTED') {
            throw new Error('Gemini API request timed out');
        }
        
        throw new Error(`Failed to generate recipe from Gemini: ${error.message}`);
    }
}

// Helper: Fetch image from Pixabay (with better error handling)
async function fetchImageUrl(query) {
    try {
        const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY || "51392156-8eaa4d6a677c8e44156c40208";
        
        // Clean and simplify the query
        let simplifiedQuery = query
            .split(":")[0]
            .trim()
            .replace(/[&:(),]/g, '')
            .toLowerCase();
        
        const words = simplifiedQuery.split(" ");
        if (words.length > 4) {
            simplifiedQuery = words.slice(0, 4).join(" ");
        }
        simplifiedQuery = `${simplifiedQuery} food`;

        console.log('🖼️ Searching Pixabay for:', simplifiedQuery);

        const response = await axios.get('https://pixabay.com/api/', {
            params: {
                key: PIXABAY_API_KEY,
                q: simplifiedQuery,
                image_type: 'photo',
                category: 'food',
                safesearch: true,
                per_page: 3
            },
            timeout: 10000
        });

        if (response.data.hits && response.data.hits.length > 0) {
            console.log('✅ Found image from Pixabay');
            return response.data.hits[0].webformatURL;
        } else {
            console.log('⚠️ No images found on Pixabay');
        }
    } catch (error) {
        console.error('⚠️ Error fetching image from Pixabay:', error.message);
    }
    
    // Return empty string if no image found (non-critical)
    return '';
}