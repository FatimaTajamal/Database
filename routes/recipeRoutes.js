const express = require("express");
const { searchRecipe } = require("../controllers/recipeController");
const router = express.Router();

router.get("/search", searchRecipe);

module.exports = router;
