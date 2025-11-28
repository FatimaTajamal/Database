const { StateGraph, END } = require("@langchain/langgraph");
const Recipe = require("../models/Recipe");
const axios = require("axios");

// -------------------------
// State Structure
// -------------------------
class RecipeState {
  constructor() {
    this.query = "";
    this.recipes = [];
    this.source = "";
    this.error = null;
  }
}

// -------------------------
// Node 1 — Search Database
// -------------------------
async function searchDatabase(state) {
  console.log(`[Database Node] Searching for: ${state.query}`);

  try {
    const escapedQuery = state.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Tier 1 — exact match
    let localRecipes = await Recipe.find({
      title: { $regex: `^${escapedQuery}$`, $options: "i" }
    }).limit(5);

    // Tier 2 — starts with
    if (localRecipes.length === 0) {
      localRecipes = await Recipe.find({
        title: { $regex: `^${escapedQuery}`, $options: "i" }
      }).limit(10);
    }

    // Tier 3 — contains word
    if (localRecipes.length === 0) {
      localRecipes = await Recipe.find({
        title: { $regex: `\\b${escapedQuery}`, $options: "i" }
      }).limit(10);
    }

    // Tier 4 — contains anywhere
    if (localRecipes.length === 0) {
      localRecipes = await Recipe.find({
        title: { $regex: escapedQuery, $options: "i" }
      }).limit(10);
    }

    if (localRecipes.length > 0) {
      console.log(`[Database Node] Found ${localRecipes.length} recipe(s)`);
      return {
        ...state,
        recipes: localRecipes,
        source: "database",
      };
    }

    console.log("[Database Node] No recipes found");
    return { ...state, source: "none", recipes: [] };

  } catch (err) {
    console.error("[Database Node] Error:", err);
    return { ...state, error: "Database search failed" };
  }
}

// -------------------------
// Node 2 — Gemini API
// -------------------------
async function callGeminiAPI(state) {
  console.log(`[Gemini Node] Generating recipe for: ${state.query}`);

  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`;

    const response = await axios.post(
      geminiUrl,
      {
        contents: [
          {
            parts: [
              {
                text: `Generate a detailed recipe for "${state.query}". 
Return ONLY a pure JSON object, NO markdown:

{
  "title": "recipe name",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "instructions": ["step 1", "step 2"],
  "dietType": "vegetarian/non-vegetarian/vegan",
  "cuisine": "cuisine type",
  "calories": 500
}`
              }
            ]
          }
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    let aiText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();

    let recipe;
    try {
      recipe = JSON.parse(aiText);
    } catch (err) {
      console.error("[Gemini Node] JSON parse error:", err);
      return { ...state, error: "Failed to parse Gemini JSON" };
    }

    // Save to DB
    const savedRecipe = await Recipe.create({
      title: recipe.title || state.query,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      dietType: recipe.dietType || "",
      cuisine: recipe.cuisine || "",
      calories: recipe.calories || 0,
      source: "gemini",
    });

    console.log("[Gemini Node] Recipe saved");
    return {
      ...state,
      recipes: [savedRecipe],
      source: "gemini",
    };

  } catch (err) {
    console.error("[Gemini Node] Error:", err.response?.data || err.message);
    return { ...state, error: "Gemini API call failed" };
  }
}

// -------------------------
// Router — Decides Workflow
// -------------------------
function routeDecision(state) {
  if (state.error) return END;

  if (state.source === "database") return END;

  if (state.source === "none") return "gemini";

  return END;
}

// -------------------------
// Build Graph
// -------------------------
function createRecipeGraph() {
  const workflow = new StateGraph({
    channels: {
      query: null,
      recipes: null,
      source: null,
      error: null,
    },
  });

  workflow.addNode("database", searchDatabase);
  workflow.addNode("gemini", callGeminiAPI);

  workflow.setEntryPoint("database");

  workflow.addConditionalEdges("database", routeDecision, {
    gemini: "gemini",
    [END]: END,
  });

  workflow.addEdge("gemini", END);

  return workflow.compile();
}

const recipeGraph = createRecipeGraph();
module.exports = { recipeGraph };
