// const { StateGraph, END } = require("@langchain/langgraph");
// const Recipe = require("../models/Recipe");
// const axios = require("axios");

// // -------------------------
// // State Structure
// // -------------------------
// class RecipeState {
//   constructor() {
//     this.query = "";
//     this.recipes = [];
//     this.source = "";
//     this.error = null;
//   }
// }

// // -------------------------
// // Node 1 — Search Database
// // -------------------------
// async function searchDatabase(state) {
//   console.log(`[Database Node] Searching for: ${state.query}`);

//   try {
//     const escapedQuery = state.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

//     // Tier 1 — exact match
//     let localRecipes = await Recipe.find({
//       title: { $regex: `^${escapedQuery}$`, $options: "i" }
//     }).limit(5);

//     // Tier 2 — starts with
//     if (localRecipes.length === 0) {
//       localRecipes = await Recipe.find({
//         title: { $regex: `^${escapedQuery}`, $options: "i" }
//       }).limit(10);
//     }

//     // Tier 3 — contains word
//     if (localRecipes.length === 0) {
//       localRecipes = await Recipe.find({
//         title: { $regex: `\\b${escapedQuery}`, $options: "i" }
//       }).limit(10);
//     }

//     // Tier 4 — contains anywhere
//     if (localRecipes.length === 0) {
//       localRecipes = await Recipe.find({
//         title: { $regex: escapedQuery, $options: "i" }
//       }).limit(10);
//     }

//     if (localRecipes.length > 0) {
//       console.log(`[Database Node] Found ${localRecipes.length} recipe(s)`);
//       return {
//         ...state,
//         recipes: localRecipes,
//         source: "database",
//       };
//     }

//     console.log("[Database Node] No recipes found");
//     return { ...state, source: "none", recipes: [] };

//   } catch (err) {
//     console.error("[Database Node] Error:", err);
//     return { ...state, error: "Database search failed" };
//   }
// }

// // -------------------------
// // Node 2 — Gemini API
// // -------------------------
// async function callGeminiAPI(state) {
//   console.log(`[Gemini Node] Generating recipe for: ${state.query}`);

//   try {
//     const geminiApiKey = process.env.GEMINI_API_KEY;
//     const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

//     const response = await axios.post(
//       geminiUrl,
//       {
//         contents: [
//           {
//             parts: [
//               {
//                 text: `Generate a detailed recipe for "${state.query}". 
// Return ONLY a pure JSON object, NO markdown:

// {
//   "title": "recipe name",
//   "ingredients": ["ingredient 1", "ingredient 2"],
//   "instructions": ["step 1", "step 2"],
//   "dietType": "vegetarian/non-vegetarian/vegan",
//   "cuisine": "cuisine type",
//   "calories": 500
// }`
//               }
//             ]
//           }
//         ],
//         generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
//       },
//       {
//         headers: { "Content-Type": "application/json" },
//       }
//     );

//     let aiText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

//     aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();

//     let recipe;
//     try {
//       recipe = JSON.parse(aiText);
//     } catch (err) {
//       console.error("[Gemini Node] JSON parse error:", err);
//       return { ...state, error: "Failed to parse Gemini JSON" };
//     }

//     // Save to DB
//     const savedRecipe = await Recipe.create({
//       title: recipe.title || state.query,
//       ingredients: recipe.ingredients || [],
//       instructions: recipe.instructions || [],
//       dietType: recipe.dietType || "",
//       cuisine: recipe.cuisine || "",
//       calories: recipe.calories || 0,
//       source: "gemini",
//     });

//     console.log("[Gemini Node] Recipe saved");
//     return {
//       ...state,
//       recipes: [savedRecipe],
//       source: "gemini",
//     };

//   } catch (err) {
//     console.error("[Gemini Node] Error:", err.response?.data || err.message);
//     return { ...state, error: "Gemini API call failed" };
//   }
// }

// // -------------------------
// // Router — Decides Workflow
// // -------------------------
// function routeDecision(state) {
//   if (state.error) return END;

//   if (state.source === "database") return END;

//   if (state.source === "none") return "gemini";

//   return END;
// }

// // -------------------------
// // Build Graph
// // -------------------------
// function createRecipeGraph() {
//   const workflow = new StateGraph({
//     channels: {
//       query: null,
//       recipes: null,
//       source: null,
//       error: null,
//     },
//   });

//   workflow.addNode("database", searchDatabase);
//   workflow.addNode("gemini", callGeminiAPI);

//   workflow.setEntryPoint("database");

//   workflow.addConditionalEdges("database", routeDecision, {
//     gemini: "gemini",
//     [END]: END,
//   });

//   workflow.addEdge("gemini", END);

//   return workflow.compile();
// }

// const recipeGraph = createRecipeGraph();
// module.exports = { recipeGraph };



const { StateGraph, END } = require("@langchain/langgraph");
const Recipe = require("../models/Recipe");
const axios = require("axios");

// Logic Nodes
async function searchDatabase(state) {
    console.log(`--- STEP 1: DB SEARCH [${state.query}] ---`);
    try {
        // Use a strict search. If it's not EXACTLY this, we want Gemini to help.
        const recipe = await Recipe.findOne({ 
            title: { $regex: `^${state.query}$`, $options: "i" } 
        });

        if (recipe) {
            console.log("✅ Match found in Database. Skipping AI.");
            return { ...state, recipes: [recipe], source: "database" };
        }

        console.log("❌ No exact match in DB. Moving to AI node...");
        return { ...state, source: "none" };
    } catch (err) {
        console.error("DB Error:", err);
        return { ...state, error: "Database search failed" };
    }
}

async function callGeminiAPI(state) {
    console.log(`--- STEP 2: GEMINI API CALL [${state.query}] ---`);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("Critial Error: GEMINI_API_KEY is missing from .env!");
        return { ...state, error: "API Key Missing" };
    }

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: `Provide a recipe for ${state.query} in JSON format: {"title": "...", "ingredients": [], "instructions": []}` }] }]
        });

        let aiText = response.data.candidates[0].content.parts[0].text;
        aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
        const data = JSON.parse(aiText);

        const saved = await Recipe.create({ ...data, source: "gemini" });
        console.log("✅ Gemini Success. Recipe saved.");
        
        return { ...state, recipes: [saved], source: "gemini" };
    } catch (err) {
        console.error("--- GEMINI API FAILED ---");
        console.error("Reason:", err.response?.data || err.message);
        return { ...state, error: "AI Generation failed" };
    }
}

// Graph Setup
const workflow = new StateGraph({
    channels: { query: null, recipes: null, source: null, error: null }
});

workflow.addNode("database", searchDatabase);
workflow.addNode("gemini", callGeminiAPI);
workflow.setEntryPoint("database");
workflow.addConditionalEdges("database", (s) => (s.source === "none" ? "gemini" : END));
workflow.addEdge("gemini", END);

const recipeGraph = workflow.compile();

// Exported Controller
exports.generateRecipe = async (req, res) => {
    console.log("🚀 Request received for:", req.body.query);
    const result = await recipeGraph.invoke({ 
        query: req.body.query, 
        recipes: [], 
        source: "none" 
    });

    if (result.error) return res.status(500).json({ error: result.error });
    res.json(result.recipes);
};