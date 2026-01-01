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

// ---------------------------------------------------------
// 1. LANGGRAPH STATE DEFINITION
// ---------------------------------------------------------
// This defines how the data flows and updates between nodes
const recipeStateSchema = {
  query: { value: (x, y) => y ?? x, default: () => "" },
  recipes: { value: (x, y) => y ?? x, default: () => [] },
  source: { value: (x, y) => y ?? x, default: () => "" },
  error: { value: (x, y) => y ?? x, default: () => null },
};

// ---------------------------------------------------------
// 2. NODES (The logic steps)
// ---------------------------------------------------------

/**
 * Node 1: Search Database
 * Checks if the recipe exists locally before bothering the API.
 */
async function searchDatabase(state) {
  console.log(`[Database Node] Searching for: ${state.query}`);
  try {
    const escapedQuery = state.query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // Tier 1: Strict match (Best for deciding if we need Gemini)
    const localRecipes = await Recipe.find({
      title: { $regex: `^${escapedQuery}$`, $options: "i" }
    }).limit(5);

    if (localRecipes.length > 0) {
      console.log(`[Database Node] Found match in DB.`);
      return { recipes: localRecipes, source: "database" };
    }

    console.log("[Database Node] No match found. Proceeding...");
    return { source: "none", recipes: [] };
  } catch (err) {
    console.error("[Database Node] Error:", err);
    return { error: "Database search failed" };
  }
}

/**
 * Node 2: Gemini API
 * Generates a recipe if the database came up empty.
 */
async function callGeminiAPI(state) {
  console.log(`[Gemini Node] Generating recipe for: ${state.query}`);
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

  try {
    const response = await axios.post(
      geminiUrl,
      {
        contents: [{
          parts: [{
            text: `Generate a detailed recipe for "${state.query}". 
            Return ONLY a pure JSON object, NO markdown, NO backticks:
            {
              "title": "recipe name",
              "ingredients": ["ingredient 1", "ingredient 2"],
              "instructions": ["step 1", "step 2"],
              "dietType": "vegetarian/non-vegetarian/vegan",
              "cuisine": "cuisine type",
              "calories": 500
            }`
          }]
        }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
      },
      { headers: { "Content-Type": "application/json" } }
    );

    let aiText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Clean potential markdown formatting
    aiText = aiText.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsedRecipe = JSON.parse(aiText);

    // Save the AI result to your Database for future use
    const savedRecipe = await Recipe.create({
      title: parsedRecipe.title || state.query,
      ingredients: parsedRecipe.ingredients || [],
      instructions: parsedRecipe.instructions || [],
      dietType: parsedRecipe.dietType || "",
      cuisine: parsedRecipe.cuisine || "",
      calories: parsedRecipe.calories || 0,
      source: "gemini",
    });

    console.log("[Gemini Node] Recipe saved to DB successfully.");
    return { recipes: [savedRecipe], source: "gemini" };

  } catch (err) {
    console.error("[Gemini Node] Error:", err.response?.data || err.message);
    return { error: "Gemini API failed to generate recipe" };
  }
}

// ---------------------------------------------------------
// 3. ROUTER & GRAPH COMPILATION
// ---------------------------------------------------------

function routeDecision(state) {
  if (state.error) return END;
  // If we found something in the DB, stop here.
  if (state.source === "database") return END;
  // Otherwise, go to Gemini.
  return "gemini";
}

const workflow = new StateGraph({ channels: recipeStateSchema });

workflow.addNode("database", searchDatabase);
workflow.addNode("gemini", callGeminiAPI);

workflow.setEntryPoint("database");
workflow.addConditionalEdges("database", routeDecision);
workflow.addEdge("gemini", END);

const recipeGraph = workflow.compile();

// ---------------------------------------------------------
// 4. EXPORTED CONTROLLER FUNCTION
// ---------------------------------------------------------

/**
 * This is the function your Express router will call.
 * POST /api/recipes/generate
 */
const generateRecipeWithGraph = async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    // Execute the LangGraph
    const finalState = await recipeGraph.invoke({
      query: query,
      recipes: [],
      source: "",
      error: null
    });

    if (finalState.error) {
      return res.status(500).json({ error: finalState.error });
    }

    res.status(200).json({
      success: true,
      source: finalState.source,
      data: finalState.recipes
    });

  } catch (error) {
    console.error("Graph Execution Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  generateRecipeWithGraph
};