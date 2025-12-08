require("dotenv").config({ path: '../.env' });
const mongoose = require("mongoose");
const fs = require("fs");
const Recipe = require("../models/Recipe");

const importRecipes = async () => {
  try {
    // 💡 Add this line for debugging!
    console.log("Attempting to connect with URI:", process.env.MONGODB_URI); 

    // If the output is "undefined", the .env file is not loading correctly.
    await mongoose.connect(process.env.MONGODB_URI);

    const data = fs.readFileSync("../cookbook/recipes.json", "utf-8");
    const recipes = JSON.parse(data);

    // Clear existing recipes to avoid duplicates
    await Recipe.deleteMany();

    // Insert all recipes
    const inserted = await Recipe.insertMany(recipes);

    console.log(`${inserted.length} recipes imported successfully!`);
    process.exit();
  } catch (error) {
    console.error("Failed to import recipes:", error);
    process.exit(1);
  }
};

importRecipes();
