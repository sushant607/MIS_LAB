const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const VALID_DEPARTMENTS = [
  "support team A",
  "software team",
  "network team",
  "infrastructure team",
  "hardware team",
  "database team",
];
const VALID_ROLES = ["employee", "manager", "admin"];
const VALID_SKILLS = [
  "troubleshooting",
  "networking",
  "operating systems",
  "hardware support",
  "software installation",
  "database basics",
  "ticketing systems",
  "customer support",
  "communication",
];

function signUserToken(user) {
  const payload = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      skills: user.skills || [],
    },
  };
  return jwt.sign(payload, process.env.JWT_SECRET || "jwt_secret_placeholder", {
    expiresIn: "7d",
  });
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = "employee",
      department,
      skills = [],
    } = req.body || {};

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ errors: [{ msg: "name, email, password required" }] });
    }
    if (!department || !VALID_DEPARTMENTS.includes(department)) {
      return res
        .status(400)
        .json({ errors: [{ msg: "Invalid or missing department" }] });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ errors: [{ msg: "Invalid role" }] });
    }
    if (
      !Array.isArray(skills) ||
      !skills.every((s) => VALID_SKILLS.includes(s))
    ) {
      return res.status(400).json({ errors: [{ msg: "Invalid skills list" }] });
    }

    let user = await User.findOne({ email });
    if (user)
      return res.status(400).json({ errors: [{ msg: "User already exists" }] });

    user = new User({ name, email, password, role, department, skills });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const token = signUserToken(user);
    return res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        skills: user.skills,
      },
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ errors: [{ msg: "Server error" }] });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ errors: [{ msg: "email and password required" }] });
    }

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ errors: [{ msg: "Invalid credentials" }] });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ errors: [{ msg: "Invalid credentials" }] });

    const token = signUserToken(user);
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        skills: user.skills,
      },
    });
  } catch (err) {
    console.error(err.message);
    return res.status(500).json({ errors: [{ msg: "Server error" }] });
  }
});
// GET all employees and their skills

module.exports = router;
