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
// Clean font family names — strip hashes, IDs, build artifacts
// e.g. "Inter-280267e3536fdc11" → "Inter", "Poppins-abc123" → "Poppins"
// ============================================================================

function cleanFamilyName(family: string): string {
  let cleaned = family;

  // Strip trailing hex hash (common in Next.js / webpack builds)
  // e.g. "Inter-280267e3536fdc11" → "Inter"
  cleaned = cleaned.replace(/-[0-9a-f]{6,}$/i, '');

  // Strip trailing random IDs like "__abc123_def456"
  cleaned = cleaned.replace(/__[a-zA-Z0-9_]+$/, '');

  // Strip trailing numbers-only suffix e.g. "Roboto-12345"
  cleaned = cleaned.replace(/-\d{4,}$/, '');

  return cleaned.trim();
}

/**
 * Search the database for a font by name, trying progressively fuzzier matches:
 * 1. Exact match on original family name
 * 2. Exact match on cleaned name (hash stripped)
 * 3. Case-insensitive startsWith on database entries
 */
function findInDatabase(
  family: string,
  database: FontFeatureEntry[],
): FontFeatureEntry | null {
  const lower = family.toLowerCase().trim();
  const cleanedLower = cleanFamilyName(family).toLowerCase().trim();

  // 1. Exact match
  const exact = database.find(e => e.family.toLowerCase().trim() === lower);
  if (exact) return exact;

  // 2. Match after stripping hash/ID suffixes
  if (cleanedLower !== lower) {
    const cleaned = database.find(e => e.family.toLowerCase().trim() === cleanedLower);
    if (cleaned) return cleaned;
  }

  // 3. The cleaned name starts with a known font family (or vice versa)
  // Only if cleaned name is at least 3 chars to avoid false positives
  if (cleanedLower.length >= 3) {
    const startsWith = database.find(e => {
      const dbLower = e.family.toLowerCase().trim();
      return dbLower.startsWith(cleanedLower) || cleanedLower.startsWith(dbLower);
    });
    if (startsWith) return startsWith;
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

    // 0. Check if the font itself is available on Google Fonts
    //    Use smart matching that strips hashes/IDs from font names
    const database = await getDatabase();
    const cleanedFamily = cleanFamilyName(family);
    const exactMatch = findInDatabase(family, database);

    // Use the cleaned name for name-override lookups and exclude logic
    const lookupName = exactMatch ? exactMatch.family : cleanedFamily;

    // 1. Check name overrides first (for well-known commercial fonts)
    const nameMatch = findNameOverride(lookupName);
    if (nameMatch) {
      const overrideAlts = nameMatch.map(alt => ({
        family: alt.family,
        similarity: 95,
        reason: alt.reason,
        downloadUrl: `https://fonts.google.com/specimen/${alt.family.replace(/ /g, '+')}`,
      }));

      // If the font itself is on Google Fonts, prepend it as a 100% match
      if (exactMatch) {
        overrideAlts.unshift({
          family: exactMatch.family,
          similarity: 100,
          reason: 'This exact font is available free on Google Fonts!',
          downloadUrl: `https://fonts.google.com/specimen/${exactMatch.family.replace(/ /g, '+')}`,
        });
      }

      return NextResponse.json({
        original: { family, weight, style },
        method: 'name-override',
        alternatives: overrideAlts,
      });
    }

    // If exact match found in Google Fonts, return it first along with similar fonts
    if (exactMatch) {
      // Still try feature matching to find similar fonts too
      let similarAlts: Array<{ family: string; category?: string; similarity: number; reason: string; downloadUrl: string }> = [];

      if (url) {
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
              // Exclude the matched font from similar results
              const matches = findSimilar(queryFeatures, database, 4, exactMatch.family);
              similarAlts = matches.map(m => ({
                family: m.family,
                category: m.category,
                similarity: m.similarity,
                reason: `${m.similarity}% visual match`,
                downloadUrl: `https://fonts.google.com/specimen/${m.family.replace(/ /g, '+')}`,
              }));
            }
          }
        } catch (error) {
          console.error('Feature matching for exact-match font failed:', error);
        }
      }

      return NextResponse.json({
        original: { family, weight, style },
        method: 'exact-match',
        alternatives: [
          {
            family: exactMatch.family,
            category: exactMatch.category,
            similarity: 100,
            reason: 'This exact font is available free on Google Fonts!',
            downloadUrl: `https://fonts.google.com/specimen/${exactMatch.family.replace(/ /g, '+')}`,
          },
          ...similarAlts,
        ],
      });
    }

    // 2. Feature-vector similarity matching

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
            // Use cleaned name for exclude to avoid false non-matches
            const matches = findSimilar(queryFeatures, database, 6, cleanedFamily);

            // Check if the top match IS the same font (name matches after cleaning)
            // If so, promote it to 100% and separate it
            const topMatch = matches[0];
            const isTopMatchSameFont = topMatch &&
              topMatch.family.toLowerCase().trim() === cleanedFamily.toLowerCase().trim();

            let alternatives;
            if (isTopMatchSameFont) {
              alternatives = [
                {
                  family: topMatch.family,
                  category: topMatch.category,
                  similarity: 100,
                  reason: 'This exact font is available free on Google Fonts!',
                  downloadUrl: `https://fonts.google.com/specimen/${topMatch.family.replace(/ /g, '+')}`,
                },
                ...matches.slice(1, 5).map(m => ({
                  family: m.family,
                  category: m.category,
                  similarity: m.similarity,
                  reason: `${m.similarity}% visual match`,
                  downloadUrl: `https://fonts.google.com/specimen/${m.family.replace(/ /g, '+')}`,
                })),
              ];
            } else {
              alternatives = matches.slice(0, 5).map(m => ({
                family: m.family,
                category: m.category,
                similarity: m.similarity,
                reason: `${m.similarity}% visual match`,
                downloadUrl: `https://fonts.google.com/specimen/${m.family.replace(/ /g, '+')}`,
              }));
            }

            // Debug: include extracted features
            const featureDebug: Record<string, number> = {};
            FEATURE_NAMES.forEach((name, i) => {
              featureDebug[name] = Math.round(queryFeatures[i] * 1000) / 1000;
            });

            return NextResponse.json({
              original: { family, weight, style },
              method: 'feature-similarity',
              features: featureDebug,
              alternatives,
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
    const lower = cleanedFamily.toLowerCase();
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
