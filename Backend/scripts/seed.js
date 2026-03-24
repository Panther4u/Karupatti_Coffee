require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Voucher = require("../models/Voucher");
const Admin = require("../models/Admin");

const products = [
  { name: "Karupatti Tea", price: 20, purchaseRate: 8, type: 1, imageUrl: "" },
  { name: "Lemon Tea", price: 25, purchaseRate: 10, type: 1, imageUrl: "" },
  { name: "Green Tea", price: 30, purchaseRate: 12, type: 1, imageUrl: "" },
  { name: "Normal Coffee", price: 20, purchaseRate: 8, type: 2, imageUrl: "" },
  { name: "Espresso", price: 40, purchaseRate: 15, type: 2, imageUrl: "" },
  { name: "Hot Americano", price: 50, purchaseRate: 18, type: 2, imageUrl: "" },
  { name: "Macchiato", price: 60, purchaseRate: 20, type: 2, imageUrl: "" },
  { name: "V60 Pour Over", price: 80, purchaseRate: 25, type: 2, imageUrl: "" },
  { name: "Paruthi Paal", price: 30, purchaseRate: 12, type: 3, imageUrl: "" },
  { name: "Panakarkandu Paal", price: 30, purchaseRate: 12, type: 3, imageUrl: "" },
  { name: "Sukku Paal", price: 30, purchaseRate: 12, type: 3, imageUrl: "" },
  { name: "Ice Chocolate", price: 60, purchaseRate: 22, type: 7, imageUrl: "" },
  { name: "Matcha Latte", price: 70, purchaseRate: 25, type: 7, imageUrl: "" },
  { name: "Butter Croissant", price: 50, purchaseRate: 20, type: 4, imageUrl: "" },
  { name: "Almond Croissant", price: 60, purchaseRate: 25, type: 4, imageUrl: "" },
  { name: "Japanese Cheesecake", price: 80, purchaseRate: 30, type: 4, imageUrl: "" },
  { name: "Mineral Water", price: 20, purchaseRate: 10, type: 7, imageUrl: "" },
  { name: "Lychee Tea", price: 40, purchaseRate: 15, type: 1, imageUrl: "" },
];

const vouchers = [
  {
    code: "WELCOME10",
    discountType: "percentage",
    discountValue: 10,
    minOrderAmount: 100,
    maxDiscount: 50,
    usageLimit: 100,
  },
  {
    code: "FLAT50",
    discountType: "flat",
    discountValue: 50,
    minOrderAmount: 200,
    usageLimit: 50,
  },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB_NAME || "karupatti_coffee",
    });
    console.log("Connected to MongoDB");

    // Seed products
    const existingProducts = await Product.countDocuments();
    if (existingProducts === 0) {
      await Product.insertMany(products);
      console.log(`Seeded ${products.length} products`);
    } else {
      console.log(`Skipping products — ${existingProducts} already exist`);
    }

    // Seed vouchers
    const existingVouchers = await Voucher.countDocuments();
    if (existingVouchers === 0) {
      await Voucher.insertMany(vouchers);
      console.log(`Seeded ${vouchers.length} vouchers`);
    } else {
      console.log(`Skipping vouchers — ${existingVouchers} already exist`);
    }

    // Seed default admin
    const existingAdmins = await Admin.countDocuments();
    if (existingAdmins === 0) {
      const defaultPassword = process.env.ADMIN_PASSWORD || "Change_Me_123!";
      await Admin.create({
        username: "admin",
        passwordHash: defaultPassword,
        role: "admin",
      });
      console.log(`Seeded default admin (username: admin). CHANGE PASSWORD IMMEDIATELY after first login.`);
    } else {
      console.log(`Skipping admin — ${existingAdmins} already exist`);
    }

    console.log("Seed complete!");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
}

seed();
