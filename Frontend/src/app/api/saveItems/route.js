import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const ITEMS_FILE_PATH = path.join(process.cwd(), 'public', 'items.json');

export async function POST(request) {
  try {
    const itemsData = await request.json();
    
    // Write the data to the items.json file
    await fs.writeFile(ITEMS_FILE_PATH, JSON.stringify(itemsData, null, 2), 'utf8');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving items:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}