// const mongoose = require("mongoose");

// const connectDB = async () => {
//   try {
//     console.log("Connecting to MongoDB URI:", process.env.MONGODB_URI);

//     await mongoose.connect(process.env.MONGODB_URI);

//     console.log("MongoDB connected");
//   } catch (error) {
//     console.error("MongoDB connection error:", error.message);
//     process.exit(1);
//   }
// };

// module.exports = connectDB;
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Note: The log below may not appear if the function crashes before logging.
    // The previous logs from earlier steps are more reliable.
    console.log("Connecting to MongoDB URI:", process.env.MONGODB_URI ? 'URI set' : 'URI MISSING');

    // Use connection options suitable for serverless environment
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s if connection is slow
    });

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    // ⚠️ CRITICAL FIX: Removed process.exit(1) to prevent Vercel crash.
    // The function will now finish gracefully if the connection fails.
    // Subsequent DB operations will throw an error, which the Express error handler will catch.
  }
};

module.exports = connectDB;