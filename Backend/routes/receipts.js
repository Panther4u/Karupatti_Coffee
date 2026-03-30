const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Settings = require("../models/Settings");
const asyncHandler = require("../middleware/asyncHandler");

// GET /:orderId/public - Get receipt (NO auth required)
router.get(
  "/:orderId/public",
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, error: "Order not found" });
    }

    const settings = await Settings.getSettings();

    // Map order items using the actual Order schema fields
    const receipt = {
      orderNumber: order.orderNumber,
      billNo: order.billNo,
      date: order.date || order.createdAt,
      time: order.time,
      items: order.order.map((item) => ({
        name: item.name,
        amount: item.amount,
        price: item.price,
        total: item.price * item.amount,
        notes: item.notes,
      })),
      total: order.total,
      discount: order.discount,
      grandTotal: order.grandTotal,
      paymentMethod: order.paymentMethod,
      tableNo: order.tableNo,
      status: order.status,
      settings: {
        shopName: settings.shopName,
        shopTagline: settings.shopTagline,
        shopAddress: settings.shopAddress,
        shopCity: settings.shopCity,
        shopPhone: settings.shopPhone,
        shopEmail: settings.shopEmail,
        gstNumber: settings.gstNumber,
        fssaiNumber: settings.fssaiNumber,
        invoicePrefix: settings.invoicePrefix,
        receiptHeader: settings.receiptHeader,
        receiptFooter: settings.receiptFooter,
      },
    };

    res.json({ success: true, data: receipt });
  })
);

module.exports = router;
