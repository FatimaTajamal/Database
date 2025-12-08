const CookingHack = require('../models/CookingHack');

// Get all cooking hacks
exports.getAllHacks = async (req, res) => {
  try {
    const hacks = await CookingHack.find();
    res.status(200).json({
      success: true,
      count: hacks.length,
      data: hacks
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching cooking hacks',
      error: error.message
    });
  }
};

// Get random daily hack
exports.getDailyHack = async (req, res) => {
  try {
    const count = await CookingHack.countDocuments();
    const random = Math.floor(Math.random() * count);
    const hack = await CookingHack.findOne().skip(random);
    
    if (!hack) {
      return res.status(404).json({
        success: false,
        message: 'No hacks found'
      });
    }

    res.status(200).json({
      success: true,
      data: hack
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching daily hack',
      error: error.message
    });
  }
};

// Get hack by ID
exports.getHackById = async (req, res) => {
  try {
    const hack = await CookingHack.findOne({ id: req.params.id });
    
    if (!hack) {
      return res.status(404).json({
        success: false,
        message: 'Hack not found'
      });
    }

    res.status(200).json({
      success: true,
      data: hack
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching hack',
      error: error.message
    });
  }
};

// Add new hack (optional - for admin use)
exports.addHack = async (req, res) => {
  try {
    const { id, hack } = req.body;

    if (!id || !hack) {
      return res.status(400).json({
        success: false,
        message: 'Please provide id and hack text'
      });
    }

    const newHack = await CookingHack.create({ id, hack });

    res.status(201).json({
      success: true,
      data: newHack
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding hack',
      error: error.message
    });
  }
};

// Update hack (optional - for admin use)
exports.updateHack = async (req, res) => {
  try {
    const hack = await CookingHack.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!hack) {
      return res.status(404).json({
        success: false,
        message: 'Hack not found'
      });
    }

    res.status(200).json({
      success: true,
      data: hack
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating hack',
      error: error.message
    });
  }
};

// Delete hack (optional - for admin use)
exports.deleteHack = async (req, res) => {
  try {
    const hack = await CookingHack.findOneAndDelete({ id: req.params.id });

    if (!hack) {
      return res.status(404).json({
        success: false,
        message: 'Hack not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Hack deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting hack',
      error: error.message
    });
  }
};