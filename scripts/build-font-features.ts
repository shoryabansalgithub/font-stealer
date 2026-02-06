/**
 * Build Font Features Database
 * 
 * Downloads all ~1,700 Google Fonts, extracts 15-dimension visual feature vectors,
 * and saves them to public/data/font-features.json for runtime similarity matching.
 * 
 * Usage:
 *   1. Get a free Google Fonts API key from https://console.cloud.google.com
 *   2. Run:  GOOGLE_FONTS_API_KEY=your_key npx tsx scripts/build-font-features.ts
 *      Or on Windows PowerShell:
 *        $env:GOOGLE_FONTS_API_KEY="your_key"; npx tsx scripts/build-font-features.ts
 * 
 * This takes ~30-60 minutes (downloads each font sequentially with delays).
 * Output: public/data/font-features.json (~250KB)
 */

import opentype from 'opentype.js';
import { extractFeatures, FontFeatureEntry } from '../app/lib/font-features';
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = process.env.GOOGLE_FONTS_API_KEY;
if (!API_KEY) {
  console.error('Error: Set GOOGLE_FONTS_API_KEY environment variable');
  console.error('Get a free key at: https://console.cloud.google.com');
  console.error('Then run: $env:GOOGLE_FONTS_API_KEY="your_key"; npx tsx scripts/build-font-features.ts');
  process.exit(1);
}

const API_URL = `https://www.googleapis.com/webfonts/v1/webfonts?key=${API_KEY}&sort=popularity`;
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'font-features.json');
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'font-features-progress.json');
const DELAY_MS = 80; // Delay between font downloads to be respectful

interface GoogleFont {
  family: string;
  variants: string[];
  subsets: string[];
  category: string;
  files: Record<string, string>;
}

interface GoogleFontsResponse {
  items: GoogleFont[];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFontList(): Promise<GoogleFont[]> {
  console.log('Fetching Google Fonts list...');
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`Google Fonts API error: ${response.status} ${response.statusText}`);
  }
  const data: GoogleFontsResponse = await response.json();
  console.log(`Found ${data.items.length} fonts`);
  return data.items;
}

async function downloadFont(url: string): Promise<ArrayBuffer | null> {
  try {
    // Google Fonts API returns http:// URLs, convert to https://
    const secureUrl = url.replace('http://', 'https://');
    const response = await fetch(secureUrl, {
      headers: { 'User-Agent': 'FontFeatureBuilder/1.0' },
    });
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

function extractFeaturesFromFont(buffer: ArrayBuffer): ReturnType<typeof extractFeatures> | null {
  try {
    const font = opentype.parse(buffer);
    return extractFeatures(font);
  } catch {
    return null;
  }
}

async function main() {
  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Fetch the font list
  const fonts = await fetchFontList();

  // Load progress if resuming
  let results: FontFeatureEntry[] = [];
  const processed = new Set<string>();
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      results = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
      for (const r of results) processed.add(r.family);
      console.log(`Resuming from progress file: ${results.length} fonts already processed`);
    } catch {
      console.log('Could not load progress file, starting fresh');
    }
  }

  const total = fonts.length;
  let succeeded = results.length;
  let failed = 0;

  for (let i = 0; i < total; i++) {
    const font = fonts[i];

    // Skip if already processed
    if (processed.has(font.family)) continue;

    // Get the regular variant URL (preferred), or first available
    const fileUrl = font.files?.['regular'] || font.files?.['400'] || Object.values(font.files || {})[0];
    if (!fileUrl) {
      console.log(`  [${i + 1}/${total}] SKIP ${font.family} — no file URL`);
      failed++;
      continue;
    }

    process.stdout.write(`  [${i + 1}/${total}] ${font.family}... `);

    const buffer = await downloadFont(fileUrl);
    if (!buffer) {
      console.log('DOWNLOAD FAILED');
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    const features = extractFeaturesFromFont(buffer);
    if (!features) {
      console.log('PARSE FAILED');
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    results.push({
      family: font.family,
      category: font.category,
      features,
    });
    succeeded++;
    console.log('OK');

    // Save progress every 50 fonts
    if (succeeded % 50 === 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify(results));
      console.log(`  --- Progress saved: ${succeeded} fonts ---`);
    }

    await sleep(DELAY_MS);
  }

  // Write final output (compact JSON)
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results));

  // Clean up progress file
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }

  const sizeKB = Math.round(fs.statSync(OUTPUT_FILE).size / 1024);
  console.log(`\nDone!`);
  console.log(`  Succeeded: ${succeeded}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Output: ${OUTPUT_FILE} (${sizeKB} KB)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
