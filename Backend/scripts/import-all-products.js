require("dotenv").config();
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const Product = require("../models/Product");

async function confirmAction(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function importProducts() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || "karupatti_coffee",
  });
  console.log("Connected to MongoDB");

  // Load items.json
  const jsonPath = path.join(__dirname, "../../Frontend/public/items.json");
  const raw = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  const itemsObj = raw.data || raw;
  const items = typeof itemsObj === "object" && !Array.isArray(itemsObj)
    ? Object.values(itemsObj)
    : itemsObj;

  console.log(`Found ${items.length} products in items.json`);

  // Get list of local images for matching
  const imgDir = path.join(__dirname, "../../Frontend/public/product");
  const localImages = fs.existsSync(imgDir) ? fs.readdirSync(imgDir) : [];
  console.log(`Found ${localImages.length} local images`);

  // Build a lowercase lookup map for image matching
  const imgMap = {};
  localImages.forEach(f => {
    imgMap[f.toLowerCase().replace(/\.[^.]+$/, "")] = `/product/${f}`;
  });

  // Confirm before destructive operation
  const existingCount = await Product.countDocuments();
  if (existingCount > 0) {
    const confirmed = await confirmAction(
      `WARNING: This will delete all ${existingCount} existing products. Continue? (y/N) `
    );
    if (!confirmed) {
      console.log("Aborted.");
      await mongoose.disconnect();
      return;
    }
  }

  // Clear existing products
  const deleted = await Product.deleteMany({});
  console.log(`Cleared ${deleted.deletedCount} existing products`);

  // Prepare products for import
  const products = items.map(item => {
    // Try to match a local image
    let imageUrl = item.imageUrl || "";
    if (!imageUrl) {
      const nameLower = (item.name || "").toLowerCase().replace(/\s+/g, "");
      for (const [key, imgPath] of Object.entries(imgMap)) {
        const keyClean = key.replace(/\s+/g, "");
        if (keyClean === nameLower || nameLower.includes(keyClean) || keyClean.includes(nameLower)) {
          imageUrl = imgPath;
          break;
        }
      }
    }

    return {
      name: item.name,
      price: item.price || 0,
      mrp: item.mrp || 0,
      purchaseRate: item.purchaseRate || 0,
      type: item.type || 1,
      description: item.description || "",
      imageUrl: imageUrl,
      favorite: item.favorite || false,
      isAvailable: true,
      stock: 0,
    };
  });

  // Insert all
  const result = await Product.insertMany(products);
  console.log(`Imported ${result.length} products`);

  // Stats
  const withImages = result.filter(p => p.imageUrl).length;
  const withoutImages = result.filter(p => !p.imageUrl).length;
  console.log(`  With images: ${withImages}`);
  console.log(`  Without images: ${withoutImages}`);

  // Per type counts
  const typeCounts = {};
  result.forEach(p => {
    typeCounts[p.type] = (typeCounts[p.type] || 0) + 1;
  });
  console.log("\nBy category:");
  Object.keys(typeCounts).sort((a, b) => a - b).forEach(t => {
    console.log(`  Type ${t}: ${typeCounts[t]} items`);
  });

  await mongoose.disconnect();
  console.log("\nDone!");
}

importProducts().catch(err => {
  console.error("Import failed:", err);
  process.exit(1);
});
