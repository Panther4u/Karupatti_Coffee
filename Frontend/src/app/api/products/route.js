import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ITEMS_FILE_PATH = path.join(process.cwd(), 'public', 'items.json');

async function readItemsFile() {
  try {
    const data = await fs.readFile(ITEMS_FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading items file:', error);
    // Return default structure if file doesn't exist
    return {
      meta: {
        format: "JSON",
        version: "1.1.0",
        creationTime: Date.now(),
        app: "coffee-shop"
      },
      data: {}
    };
  }
}

async function writeItemsFile(itemsData) {
  try {
    await fs.writeFile(ITEMS_FILE_PATH, JSON.stringify(itemsData, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing items file:', error);
    return false;
  }
}

export async function GET() {
  const items = await readItemsFile();
  return NextResponse.json(Object.values(items.data));
}

export async function POST(request) {
  try {
    const product = await request.json();
    const items = await readItemsFile();

    const existingIds = Object.keys(items.data).map((id) => parseInt(id, 10));
    const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

    const newProduct = {
      ...product,
      id: newId,
      __collections__: {}
    };

    items.data[newId] = newProduct;
    items.meta.creationTime = Date.now();

    const success = await writeItemsFile(items);

    if (success) {
      return NextResponse.json({ success: true, item: newProduct });
    } else {
      return NextResponse.json({ success: false, error: "Failed to save item" }, { status: 500 });
    }
  } catch (error) {
    console.error('Error adding product:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const product = await request.json();
    const items = await readItemsFile();

    if (!product.id || !items.data[product.id]) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }

    items.data[product.id] = {
      ...product,
      __collections__: items.data[product.id].__collections__ || {}
    };

    items.meta.creationTime = Date.now();

    const success = await writeItemsFile(items);

    if (success) {
      return NextResponse.json({ success: true, item: items.data[product.id] });
    } else {
      return NextResponse.json({ success: false, error: "Failed to update item" }, { status: 500 });
    }
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: "No ID provided" }, { status: 400 });
    }
    
    const items = await readItemsFile();
    
    if (!items.data[id]) {
      return NextResponse.json({ success: false, error: "Product not found" }, { status: 404 });
    }
    
    // Delete the product
    delete items.data[id];
    
    // Update metadata
    items.meta.creationTime = Date.now();
    
    // Save the file
    const success = await writeItemsFile(items);
    
    if (success) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: "Failed to delete item" }, { status: 500 });
    }
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}