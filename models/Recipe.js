const mongoose = require("mongoose");

const RecipeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  ingredients: { type: [String], default: [] },
  instructions: { type: [String], default: [] },
  dietType: { type: String, default: "" },   // <-- you already had this
  cuisine: { type: String, default: "" },
  calories: { type: Number, default: 0 },
  source: { type: String, enum: ["cookbook", "gemini"], default: "cookbook" },
});

module.exports = mongoose.model("Recipe", RecipeSchema);
