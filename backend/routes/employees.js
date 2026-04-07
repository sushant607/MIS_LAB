const express = require("express");
const router = express.Router();
const User = require("../models/User"); 
const protect = require("../middleware/auth"); // make sure this matches how you export

// GET employees by department
router.get("/employees", protect, async (req, res) => {
  try {
    const { department } = req.query;

    if (!department) {
      return res.status(400).json({ message: "Department is required" });
    }

    const employees = await User.find({ department, role: "employee" });
    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
