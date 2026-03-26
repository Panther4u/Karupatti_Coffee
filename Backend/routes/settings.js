const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const Settings = require("../models/Settings");
const asyncHandler = require("../middleware/asyncHandler");

// GET / - Get settings
router.get(
  "/",
  verifyToken,
  asyncHandler(async (req, res) => {
    const settings = await Settings.getSettings();
    res.json({ success: true, data: settings });
  })
);

// PUT / - Update settings
router.put(
  "/",
  verifyToken,
  roleCheck("admin", "manager"),
  asyncHandler(async (req, res) => {
    const {
      shopName,
      shopAddress,
      shopPhone,
      shopEmail,
      gstNumber,
      fssaiNumber,
      logoUrl,
      taxEnabled,
      cgstRate,
      sgstRate,
      inclusiveTax,
      invoicePrefix,
      roundOff,
      receiptWidth,
      receiptHeader,
      receiptFooter,
      autoPrintBill,
      autoPrintKOT,
      soundEnabled,
    } = req.body;

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    if (shopName !== undefined) settings.shopName = shopName;
    if (shopAddress !== undefined) settings.shopAddress = shopAddress;
    if (shopPhone !== undefined) settings.shopPhone = shopPhone;
    if (shopEmail !== undefined) settings.shopEmail = shopEmail;
    if (gstNumber !== undefined) settings.gstNumber = gstNumber;
    if (fssaiNumber !== undefined) settings.fssaiNumber = fssaiNumber;
    if (logoUrl !== undefined) settings.logoUrl = logoUrl;
    if (taxEnabled !== undefined) settings.taxEnabled = taxEnabled;
    if (cgstRate !== undefined) settings.cgstRate = cgstRate;
    if (sgstRate !== undefined) settings.sgstRate = sgstRate;
    if (inclusiveTax !== undefined) settings.inclusiveTax = inclusiveTax;
    if (invoicePrefix !== undefined) settings.invoicePrefix = invoicePrefix;
    if (roundOff !== undefined) settings.roundOff = roundOff;
    if (receiptWidth !== undefined) settings.receiptWidth = receiptWidth;
    if (receiptHeader !== undefined) settings.receiptHeader = receiptHeader;
    if (receiptFooter !== undefined) settings.receiptFooter = receiptFooter;
    if (autoPrintBill !== undefined) settings.autoPrintBill = autoPrintBill;
    if (autoPrintKOT !== undefined) settings.autoPrintKOT = autoPrintKOT;
    if (soundEnabled !== undefined) settings.soundEnabled = soundEnabled;

    await settings.save();
    res.json({ success: true, data: settings });
  })
);

module.exports = router;
