const { recipeGraph } = require("../graph/recipeGraph");

exports.searchRecipe = async (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required" });
  }

  try {
    console.log(`[Controller] Starting search for: ${query}`);

    // Initialize state
    const initialState = {
      query: query,
      recipes: [],
      source: "",
      error: null,
    };

    // Run the graph
    const result = await recipeGraph.invoke(initialState);

    console.log(`[Controller] Graph completed. Source: ${result.source}`);

    // Check for errors
    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    // Return the result
    res.json({
      source: result.source,
      recipes: result.recipes,
    });
  } catch (err) {
    console.error("[Controller] Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};