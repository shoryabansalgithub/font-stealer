import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  extractFeaturesFromBuffer,
  findSimilar,
  FontFeatureEntry,
  FEATURE_NAMES,
} from '../../lib/font-features';

// ============================================================================
// Font feature database — loaded once, cached in module scope
// ============================================================================

let fontDatabase: FontFeatureEntry[] | null = null;

async function getDatabase(): Promise<FontFeatureEntry[]> {
  if (fontDatabase) return fontDatabase;

  const dbPath = path.join(process.cwd(), 'public', 'data', 'font-features.json');
  try {
    const raw = await fs.readFile(dbPath, 'utf-8');
    fontDatabase = JSON.parse(raw) as FontFeatureEntry[];
    console.log(`Font feature database loaded: ${fontDatabase.length} fonts`);
    return fontDatabase;
  } catch {
    console.error('Font feature database not found at', dbPath);
    return [];
  }
}

// ============================================================================
// Well-known font name overrides (hand-curated beats algo for iconic fonts)
// ============================================================================

interface NameOverrideAlt {
  family: string;
  reason: string;
}

const NAME_OVERRIDES: Record<string, NameOverrideAlt[]> = {
  'helvetica': [
    { family: 'Inter', reason: 'Modern Helvetica successor for screens' },
    { family: 'Roboto', reason: 'Neutral grotesque, very close letterforms' },
    { family: 'Source Sans 3', reason: 'Clean neutral sans by Adobe' },
    { family: 'Public Sans', reason: 'Open-source Helvetica alternative' },
    { family: 'DM Sans', reason: 'Clean geometric-humanist hybrid' },
  ],
  'helvetica neue': [
    { family: 'Inter', reason: 'Modern Helvetica successor with optical sizing' },
    { family: 'DM Sans', reason: 'Slightly geometric, very clean' },
    { family: 'Public Sans', reason: 'Open-source Helvetica Neue alternative' },
    { family: 'Roboto', reason: 'Neutral grotesque, similar proportions' },
    { family: 'Source Sans 3', reason: 'Highly readable neutral sans' },
  ],
  'sf pro': [
    { family: 'Inter', reason: 'Closest free match, designed for UI like SF Pro' },
    { family: 'DM Sans', reason: 'Clean geometric with similar x-height' },
    { family: 'Plus Jakarta Sans', reason: 'Modern geometric display sans' },
    { family: 'Albert Sans', reason: 'Geometric with similar rounded terminals' },
    { family: 'Public Sans', reason: 'Neutral UI-focused sans' },
  ],
  'proxima nova': [
    { family: 'Montserrat', reason: 'Known free Proxima Nova alternative' },
    { family: 'Nunito Sans', reason: 'Similar proportions and x-height' },
    { family: 'Poppins', reason: 'Geometric with similar character' },
    { family: 'Raleway', reason: 'Similar geometric weight range' },
    { family: 'Work Sans', reason: 'Grotesque-geometric hybrid' },
  ],
  'gotham': [
    { family: 'Montserrat', reason: 'Made as a free Gotham alternative' },
    { family: 'Raleway', reason: 'Similar geometric proportions' },
    { family: 'Poppins', reason: 'Geometric with similar boldness' },
    { family: 'Work Sans', reason: 'Wide geometric grotesque' },
    { family: 'Plus Jakarta Sans', reason: 'Modern geometric sans' },
  ],
  'futura': [
    { family: 'Jost', reason: "Directly inspired by Futura's geometry" },
    { family: 'Poppins', reason: 'Geometric with similar round shapes' },
    { family: 'Nunito', reason: 'Rounded geometric like Futura' },
    { family: 'Quicksand', reason: 'Geometric rounded sans' },
    { family: 'Montserrat', reason: 'Geometric with similar uppercase' },
  ],
  'avenir': [
    { family: 'Nunito Sans', reason: 'Very close match in feel and proportions' },
    { family: 'Nunito', reason: 'Rounded geometric like Avenir' },
    { family: 'Poppins', reason: 'Geometric with matching warmth' },
    { family: 'Outfit', reason: 'Modern geometric, similar feel' },
    { family: 'Montserrat', reason: 'Geometric with similar weight range' },
  ],
  'circular': [
    { family: 'DM Sans', reason: 'Very similar geometric proportions' },
    { family: 'Plus Jakarta Sans', reason: 'Modern geometric, similar feel' },
    { family: 'Albert Sans', reason: 'Geometric with similar roundness' },
    { family: 'Outfit', reason: 'Clean geometric, similar character' },
    { family: 'Inter', reason: 'Modern alternative, similar weight' },
  ],
  'garamond': [
    { family: 'EB Garamond', reason: 'Direct open-source Garamond revival' },
    { family: 'Cormorant Garamond', reason: 'Display-oriented Garamond' },
    { family: 'Crimson Pro', reason: 'Old-style with similar elegance' },
    { family: 'Libre Baskerville', reason: 'Classic book serif' },
    { family: 'Lora', reason: 'Contemporary old-style serif' },
  ],
  'bodoni': [
    { family: 'Playfair Display', reason: 'High-contrast display like Bodoni' },
    { family: 'Libre Bodoni', reason: 'Direct open-source Bodoni' },
    { family: 'Cormorant', reason: 'High-contrast elegant serif' },
    { family: 'DM Serif Display', reason: 'Modern high-contrast serif' },
    { family: 'Abril Fatface', reason: 'Bold Bodoni-style display' },
  ],
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/['']/g, '').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

function findNameOverride(family: string): NameOverrideAlt[] | null {
  const normalized = normalizeName(family);

  if (NAME_OVERRIDES[normalized]) return NAME_OVERRIDES[normalized];

  // Strip common suffixes
  const stripped = normalized
    .replace(/\s+(pro|text|display|round|rounded|neue|next|pt|lt|std|mt|regular|bold|light|medium|book|condensed|narrow|wide|extended|variable|vf|web|sc|caption|subhead|headline|title|poster|black|heavy|ultra|thin|hairline|extra|semi)$/g, '')
    .trim();
  if (stripped !== normalized && NAME_OVERRIDES[stripped]) return NAME_OVERRIDES[stripped];

  // Partial match
  for (const key of Object.keys(NAME_OVERRIDES)) {
    if (normalized.startsWith(key) || key.startsWith(normalized)) return NAME_OVERRIDES[key];
  }

  // First word match
  const firstWord = normalized.split(' ')[0];
  if (firstWord.length > 3) {
    for (const key of Object.keys(NAME_OVERRIDES)) {
      if (key === firstWord || key.split(' ')[0] === firstWord) return NAME_OVERRIDES[key];
    }
  }

  return null;
}

// ============================================================================
// Main API handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const { family, weight, style, url, referer } = await request.json();

    if (!family) {
      return NextResponse.json({ error: 'Font family is required' }, { status: 400 });
    }

    // 1. Check name overrides first (for well-known commercial fonts)
    const nameMatch = findNameOverride(family);
    if (nameMatch) {
      return NextResponse.json({
        original: { family, weight, style },
        method: 'name-override',
        alternatives: nameMatch.map(alt => ({
          family: alt.family,
          similarity: 95,
          reason: alt.reason,
          downloadUrl: `https://fonts.google.com/specimen/${alt.family.replace(/ /g, '+')}`,
        })),
      });
    }

    // 2. Feature-vector similarity matching
    const database = await getDatabase();

    if (database.length > 0 && url) {
      try {
        const isDataUrl = url.startsWith('data:');
        const fontUrl = isDataUrl
          ? url
          : `${request.nextUrl.origin}/api/font?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(referer || '')}`;

        const fontResponse = await fetch(fontUrl);
        if (fontResponse.ok) {
          const buffer = await fontResponse.arrayBuffer();
          const queryFeatures = await extractFeaturesFromBuffer(buffer);

          if (queryFeatures) {
            const matches = findSimilar(queryFeatures, database, 5, family);

            // Debug: include extracted features
            const featureDebug: Record<string, number> = {};
            FEATURE_NAMES.forEach((name, i) => {
              featureDebug[name] = Math.round(queryFeatures[i] * 1000) / 1000;
            });

            return NextResponse.json({
              original: { family, weight, style },
              method: 'feature-similarity',
              features: featureDebug,
              alternatives: matches.map(m => ({
                family: m.family,
                category: m.category,
                similarity: m.similarity,
                reason: `${m.similarity}% visual match`,
                downloadUrl: `https://fonts.google.com/specimen/${m.family.replace(/ /g, '+')}`,
              })),
            });
          }
        }
      } catch (error) {
        console.error('Feature matching failed:', error);
      }
    }

    // 3. No database built yet
    if (database.length === 0) {
      return NextResponse.json({
        original: { family, weight, style },
        method: 'no-database',
        error: 'Font feature database not built yet. Run: npm run build:features',
        alternatives: [],
      });
    }

    // 4. Last resort: search database by category from name patterns
    const lower = family.toLowerCase();
    let categoryFilter: string | null = null;
    if (/mono|code|courier|consolas|menlo|terminal/i.test(lower)) categoryFilter = 'monospace';
    else if (/serif/i.test(lower) && !/sans/i.test(lower)) categoryFilter = 'serif';
    else if (/sans/i.test(lower)) categoryFilter = 'sans-serif';
    else if (/script|cursive|handwrit|brush|callig/i.test(lower)) categoryFilter = 'handwriting';

    const filtered = categoryFilter
      ? database.filter(e => e.category === categoryFilter)
      : database;

    const fallback = filtered.slice(0, 5);
    return NextResponse.json({
      original: { family, weight, style },
      method: 'category-fallback',
      alternatives: fallback.map(m => ({
        family: m.family,
        category: m.category,
        similarity: 50,
        reason: `Category match: ${m.category}`,
        downloadUrl: `https://fonts.google.com/specimen/${m.family.replace(/ /g, '+')}`,
      })),
    });

  } catch (error) {
    console.error('Font matching error:', error);
    return NextResponse.json({ error: 'Failed to find similar fonts' }, { status: 500 });
  }
}
