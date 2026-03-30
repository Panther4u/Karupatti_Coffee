const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const { verifyToken } = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const asyncHandler = require("../middleware/asyncHandler");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../config/jwt");
const { logAudit } = require("../config/audit");

// POST /api/auth/login — authenticate with username+password and return JWT
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password are required" });
    }

    const admin = await Admin.findOne({ username: username.toLowerCase().trim() });
    if (!admin) {
      return res.status(401).json({ success: false, error: "Invalid username or password" });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid username or password" });
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await logAudit({ action: "login", entity: "Admin", entityId: admin._id, user: { id: admin._id, username: admin.username } });

    res.json({
      success: true,
      token,
      user: {
        id: admin._id,
        username: admin.username,
        displayName: admin.displayName || admin.username,
        role: admin.role,
        lastLogin: admin.lastLogin,
      },
    });
  })
);

// POST /api/auth/login-pin — authenticate with passcode (PIN) and return JWT
router.post(
  "/login-pin",
  asyncHandler(async (req, res) => {
    const { passcode } = req.body;

    if (!passcode) {
      return res.status(400).json({ success: false, error: "Passcode is required" });
    }

    const admin = await Admin.findOne({ passcode: passcode.trim() });
    if (!admin) {
      return res.status(401).json({ success: false, error: "Invalid passcode" });
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await logAudit({ action: "login-pin", entity: "Admin", entityId: admin._id, user: { id: admin._id, username: admin.username } });

    res.json({
      success: true,
      token,
      user: {
        id: admin._id,
        username: admin.username,
        displayName: admin.displayName || admin.username,
        role: admin.role,
        lastLogin: admin.lastLogin,
      },
    });
  })
);

// POST /api/auth/change-password — change password (auth required)
router.post(
  "/change-password",
  verifyToken,
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Old password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "New password must be at least 6 characters" });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const isMatch = await admin.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Old password is incorrect" });
    }

    admin.passwordHash = newPassword;
    await admin.save();

    await logAudit({ action: "change-password", entity: "Admin", entityId: admin._id, user: req.user });

    res.json({ success: true, message: "Password changed successfully" });
  })
);

// GET /api/auth/me — return current user from JWT (auth required)
router.get(
  "/me",
  verifyToken,
  asyncHandler(async (req, res) => {
    const admin = await Admin.findById(req.user.id).select("-passwordHash");
    if (!admin) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({
      success: true,
      data: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        lastLogin: admin.lastLogin,
        createdAt: admin.createdAt,
        updatedAt: admin.updatedAt,
      },
    });
  })
);

// POST /api/auth/setup — create admin if no admin exists (first-time setup only)
router.post(
  "/setup",
  asyncHandler(async (req, res) => {
    const existingAdmin = await Admin.countDocuments();
    if (existingAdmin > 0) {
      return res.status(400).json({ success: false, error: "Admin already exists. Setup is disabled." });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
    }

    const admin = await Admin.create({
      username: username.toLowerCase().trim(),
      passwordHash: password,
      role: "admin",
    });

    const token = jwt.sign(
      { id: admin._id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await logAudit({ action: "setup", entity: "Admin", entityId: admin._id, user: { id: admin._id, username: admin.username } });

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      token,
      user: { id: admin._id, username: admin.username, role: admin.role },
    });
  })
);

// Staff Management
router.get(
  "/users",
  verifyToken,
  roleCheck("admin", "manager"),
  asyncHandler(async (req, res) => {
    const users = await Admin.find().select("-passwordHash").sort({ createdAt: -1 });
    res.json({ success: true, data: users });
  })
);

router.post(
  "/users",
  verifyToken,
  roleCheck("admin", "manager"),
  asyncHandler(async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: "Password min 6 characters" });
    }

    const exists = await Admin.findOne({ username: username.toLowerCase().trim() });
    if (exists) {
      return res.status(409).json({ success: false, error: "Username already exists" });
    }

    const user = await Admin.create({
      username: username.toLowerCase().trim(),
      passwordHash: password,
      role: role || "cashier",
    });

    await logAudit({ action: "create-user", entity: "Admin", entityId: user._id, user: req.user, details: { username: user.username, role: user.role } });

    res.status(201).json({ success: true, data: { id: user._id, username: user.username, role: user.role } });
  })
);

router.put(
  "/users/:id",
  verifyToken,
  roleCheck("admin", "manager"),
  asyncHandler(async (req, res) => {
    const { username, role, password } = req.body;
    const user = await Admin.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (username) user.username = username.toLowerCase().trim();
    if (role) {
      if (req.user.role !== "admin" && role === "admin") {
        return res.status(403).json({ success: false, error: "Only admins can assign admin role" });
      }
      user.role = role;
    }
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
      }
      user.passwordHash = password;
    }
    await user.save();

    await logAudit({ action: "update-user", entity: "Admin", entityId: user._id, user: req.user });

    res.json({ success: true, data: { id: user._id, username: user.username, role: user.role } });
  })
);

router.delete(
  "/users/:id",
  verifyToken,
  roleCheck("admin"),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, error: "Cannot delete your own account" });
    }

    const user = await Admin.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    await logAudit({ action: "delete-user", entity: "Admin", entityId: req.params.id, user: req.user });

    res.json({ success: true, message: "User deleted" });
  })
);

module.exports = router;
