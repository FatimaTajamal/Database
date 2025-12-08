// importHacks.js
require("dotenv").config({ path: '../.env' });
const mongoose = require("mongoose");
const fs = require("fs");
// IMPORTANT: Change the model being imported
const CookingHack = require("../models/CookingHack"); 

const importHacks = async () => {
  try {
    // 💡 Debugging check for the URI
    console.log("Attempting to connect with URI:", process.env.MONGODB_URI); 

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    
    // IMPORTANT: Change the file path to the cooking hacks data
    const data = fs.readFileSync("../CookBook/cooking-hacks.json", "utf-8");
    const hacks = JSON.parse(data);

    // Clear existing hacks to avoid duplicates
    await CookingHack.deleteMany();

    // Insert all cooking hacks
    const inserted = await CookingHack.insertMany(hacks);

    console.log(`${inserted.length} cooking hacks imported successfully!`);
    process.exit();
  } catch (error) {
    console.error("Failed to import cooking hacks:", error);
    process.exit(1);
  }
};

importHacks();