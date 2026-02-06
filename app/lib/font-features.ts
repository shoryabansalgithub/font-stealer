import opentype from 'opentype.js';

// ============================================================================
// Feature vector for visual font similarity matching
// Each font is represented as an array of 15 normalized numeric features
// ============================================================================

export const FEATURE_NAMES = [
  'weightClass',      // 0:  Normalized weight (100-900 → 0-1)
  'widthClass',       // 1:  Normalized width (1-9 → 0-1)
  'xHeightRatio',     // 2:  x-height / unitsPerEm
  'capHeightRatio',   // 3:  cap-height / unitsPerEm
  'ascenderRatio',    // 4:  ascender / unitsPerEm
  'descenderRatio',   // 5:  |descender| / unitsPerEm
  'avgWidthRatio',    // 6:  average char width / unitsPerEm
  'serifScore',       // 7:  0-1 normalized serif score from glyph analysis
  'contrastRatio',    // 8:  stroke contrast (thin/thick ratio), 0-1
  'roundness',        // 9:  curve commands / total commands ratio
  'isMonospace',      // 10: 0 or 1
  'italicAngle',      // 11: normalized italic angle (0 = upright, 1 = 45deg)
  'panoseSerif',      // 12: panose byte 1 / 15
  'panoseWeight',     // 13: panose byte 2 / 15 (cross-check with weightClass)
  'complexity',       // 14: avg path commands per glyph, normalized
] as const;

export const FEATURE_COUNT = FEATURE_NAMES.length;

// Weights for similarity — higher = more important for visual matching
export const FEATURE_WEIGHTS = [
  1.0,  // weightClass — primary weight
  0.8,  // widthClass — condensed vs wide
  1.3,  // xHeightRatio — strongest proportional differentiator
  0.7,  // capHeightRatio
  0.5,  // ascenderRatio
  0.5,  // descenderRatio
  1.0,  // avgWidthRatio — overall letter width
  1.8,  // serifScore — CRITICAL: serif vs sans is the biggest visual class
  0.9,  // contrastRatio — Bodoni vs Helvetica feel
  0.7,  // roundness — geometric vs humanist
  3.0,  // isMonospace — monospace is a completely different universe
  0.3,  // italicAngle — slope
  0.9,  // panoseSerif — serif subcategory detail
  0.4,  // panoseWeight — cross-check
  0.5,  // complexity — script/decorative vs clean
];

export type FeatureVector = number[];

export interface FontFeatureEntry {
  family: string;
  category: string;  // Google's category: serif, sans-serif, monospace, display, handwriting
  features: FeatureVector;
}

// ============================================================================
// Extract feature vector from an opentype.js Font object
// ============================================================================

export function extractFeatures(font: opentype.Font): FeatureVector {
  const os2 = font.tables?.os2;
  const post = font.tables?.post;
  const upm = font.unitsPerEm || 1000;

  // Basic metrics from OS/2 table
  const weightClass = clamp((os2?.usWeightClass || 400) / 900, 0, 1);
  const widthClass = clamp(((os2?.usWidthClass || 5) - 1) / 8, 0, 1);

  // Proportional metrics
  const sxHeight = os2?.sxHeight || 0;
  const sCapHeight = os2?.sCapHeight || 0;
  const xHeightRatio = sxHeight > 0 ? clamp(sxHeight / upm, 0, 1) : estimateXHeight(font, upm);
  const capHeightRatio = sCapHeight > 0 ? clamp(sCapHeight / upm, 0, 1) : estimateCapHeight(font, upm);

  const ascenderRatio = clamp((os2?.sTypoAscender || font.ascender || upm * 0.8) / upm, 0, 1.5);
  const descenderRatio = clamp(Math.abs(os2?.sTypoDescender || font.descender || upm * -0.2) / upm, 0, 0.5);
  const avgWidthRatio = clamp((os2?.xAvgCharWidth || estimateAvgWidth(font, upm)) / upm, 0, 2);

  // Glyph-based analysis
  const glyphAnalysis = analyzeGlyphs(font, upm);

  // Monospace detection
  const isFixedPitch = post?.isFixedPitch === 1;
  const panose = os2?.panose || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const panoseMonospace = panose[3] === 9;
  const isMonospace = (isFixedPitch || panoseMonospace || glyphAnalysis.isMonospace) ? 1 : 0;

  // Italic
  const italicAngle = clamp(Math.abs(post?.italicAngle || 0) / 45, 0, 1);

  // Panose metadata
  const panoseSerif = clamp((panose[1] || 0) / 15, 0, 1);
  const panoseWeight = clamp((panose[2] || 0) / 15, 0, 1);

  return [
    weightClass,
    widthClass,
    xHeightRatio,
    capHeightRatio,
    ascenderRatio,
    descenderRatio,
    avgWidthRatio,
    glyphAnalysis.serifScore,
    glyphAnalysis.contrastRatio,
    glyphAnalysis.roundness,
    isMonospace,
    italicAngle,
    panoseSerif,
    panoseWeight,
    glyphAnalysis.complexity,
  ];
}

// ============================================================================
// Glyph-level analysis — serif score, contrast, roundness, complexity
// ============================================================================

interface GlyphAnalysis {
  serifScore: number;
  contrastRatio: number;
  roundness: number;
  complexity: number;
  isMonospace: boolean;
}

function analyzeGlyphs(font: opentype.Font, upm: number): GlyphAnalysis {
  // Characters to analyze
  const serifTestChars = 'IlT';
  const generalTestChars = 'HoeaABCDnpqr0123';
  const allTestChars = serifTestChars + generalTestChars;

  const widths: number[] = [];
  let totalCurves = 0;
  let totalLines = 0;
  let totalCommands = 0;
  let glyphCount = 0;

  // Serif detection
  let serifScore = 0;

  for (const char of allTestChars) {
    try {
      const glyph = font.charToGlyph(char);
      if (!glyph || glyph.index === 0) continue;

      const path = glyph.getPath(0, 0, 72);
      const cmds = path.commands || [];
      const cmdCount = cmds.length;

      if (cmdCount === 0) continue;

      glyphCount++;
      totalCommands += cmdCount;

      // Count curve vs line commands
      for (const cmd of cmds) {
        if (cmd.type === 'C' || cmd.type === 'Q') totalCurves++;
        else if (cmd.type === 'L') totalLines++;
      }

      // Track advance widths for monospace detection
      if (glyph.advanceWidth) {
        widths.push(glyph.advanceWidth);
      }

      // Serif analysis on I, l, T
      if (serifTestChars.includes(char)) {
        // Serif 'I' has ~12-30 commands (serifs add contour), sans has ~4-8
        if (char === 'I') {
          if (cmdCount > 12) serifScore += 3;
          else if (cmdCount <= 6) serifScore -= 3;
          else serifScore -= 1;
        }
        if (char === 'l') {
          if (cmdCount > 10) serifScore += 2;
          else if (cmdCount <= 6) serifScore -= 2;
        }
        if (char === 'T') {
          if (cmdCount > 16) serifScore += 1;
          else if (cmdCount <= 8) serifScore -= 1;
        }
      }
    } catch {
      // Skip characters that fail
    }
  }

  // Normalize serif score to 0-1 range
  // serifScore range is roughly -8 to +6
  const normalizedSerif = clamp((serifScore + 8) / 14, 0, 1);

  // Roundness: ratio of curves to total non-move/close commands
  const drawCommands = totalCurves + totalLines;
  const roundness = drawCommands > 0 ? totalCurves / drawCommands : 0.5;

  // Complexity: average commands per glyph, normalized
  // Typical range: 10-60 commands per glyph
  const avgComplexity = glyphCount > 0 ? totalCommands / glyphCount : 20;
  const normalizedComplexity = clamp(avgComplexity / 80, 0, 1);

  // Contrast: analyze 'o' or 'O' for stroke thickness variation
  const contrastRatio = estimateContrast(font, upm);

  // Monospace: check width uniformity
  let isMonospace = false;
  if (widths.length >= 3) {
    const uniqueWidths = new Set(widths);
    isMonospace = uniqueWidths.size <= 2;
  }

  return {
    serifScore: normalizedSerif,
    contrastRatio,
    roundness,
    complexity: normalizedComplexity,
    isMonospace,
  };
}

// ============================================================================
// Helper functions
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estimateXHeight(font: opentype.Font, upm: number): number {
  // Try measuring actual 'x' glyph
  try {
    const glyph = font.charToGlyph('x');
    if (glyph && glyph.index !== 0) {
      const bbox = glyph.getBoundingBox();
      if (bbox.y2 > 0) return clamp(bbox.y2 / upm, 0, 1);
    }
  } catch { /* fallback */ }
  return 0.48; // reasonable default
}

function estimateCapHeight(font: opentype.Font, upm: number): number {
  try {
    const glyph = font.charToGlyph('H');
    if (glyph && glyph.index !== 0) {
      const bbox = glyph.getBoundingBox();
      if (bbox.y2 > 0) return clamp(bbox.y2 / upm, 0, 1);
    }
  } catch { /* fallback */ }
  return 0.70; // reasonable default
}

function estimateAvgWidth(font: opentype.Font, upm: number): number {
  const testChars = 'abcdefghijklmnopqrstuvwxyz';
  let totalWidth = 0;
  let count = 0;
  for (const char of testChars) {
    try {
      const glyph = font.charToGlyph(char);
      if (glyph && glyph.index !== 0 && glyph.advanceWidth) {
        totalWidth += glyph.advanceWidth;
        count++;
      }
    } catch { /* skip */ }
  }
  return count > 0 ? totalWidth / count : upm * 0.5;
}

function estimateContrast(font: opentype.Font, upm: number): number {
  // The contrast ratio measures the difference between thick and thin strokes
  // We analyze the 'o' glyph — it's a great indicator because:
  // - High contrast (Bodoni): very thin horizontal strokes, thick verticals → ratio near 1
  // - Low contrast (Futura): uniform stroke width → ratio near 0
  // We sample the bounding box of path segments to approximate stroke widths

  try {
    const glyph = font.charToGlyph('o');
    if (!glyph || glyph.index === 0) return 0.3;

    const path = glyph.getPath(0, 0, upm);
    const cmds = path.commands || [];

    // Sample y-coordinates at various x positions to find horizontal/vertical extremes
    // Simplified: count the ratio of vertical vs horizontal segments
    let verticalExtent = 0;
    let horizontalExtent = 0;

    for (let i = 1; i < cmds.length; i++) {
      const prev = cmds[i - 1];
      const curr = cmds[i];
      if (!('x' in prev) || !('x' in curr)) continue;
      if (prev.x === undefined || curr.x === undefined) continue;
      if (prev.y === undefined || curr.y === undefined) continue;

      const dx = Math.abs((curr.x as number) - (prev.x as number));
      const dy = Math.abs((curr.y as number) - (prev.y as number));

      if (dy > dx * 2) verticalExtent += dy;
      if (dx > dy * 2) horizontalExtent += dx;
    }

    if (verticalExtent + horizontalExtent === 0) return 0.3;

    // High contrast = big difference between vertical and horizontal
    const ratio = Math.abs(verticalExtent - horizontalExtent) / (verticalExtent + horizontalExtent);
    return clamp(ratio, 0, 1);
  } catch {
    return 0.3;
  }
}

// ============================================================================
// Similarity computation
// ============================================================================

/**
 * Compute weighted Euclidean distance between two feature vectors.
 * Lower distance = more visually similar.
 */
export function featureDistance(a: FeatureVector, b: FeatureVector): number {
  let sumSq = 0;
  for (let i = 0; i < FEATURE_COUNT; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    sumSq += FEATURE_WEIGHTS[i] * diff * diff;
  }
  return Math.sqrt(sumSq);
}

/**
 * Convert distance to a 0-100 similarity percentage.
 * Uses an exponential decay — distance 0 = 100%, distance 2 ≈ 20%
 */
export function distanceToSimilarity(distance: number): number {
  return Math.round(100 * Math.exp(-distance * 1.2));
}

/**
 * Find the top N most similar fonts from the database.
 */
export function findSimilar(
  queryFeatures: FeatureVector,
  database: FontFeatureEntry[],
  topN: number = 5,
  excludeFamily?: string,
): Array<FontFeatureEntry & { distance: number; similarity: number }> {
  const excludeNorm = excludeFamily?.toLowerCase().trim();

  const results = database
    .filter(entry => {
      if (!excludeNorm) return true;
      return entry.family.toLowerCase().trim() !== excludeNorm;
    })
    .map(entry => {
      const distance = featureDistance(queryFeatures, entry.features);
      const similarity = distanceToSimilarity(distance);
      return { ...entry, distance, similarity };
    })
    .sort((a, b) => a.distance - b.distance);

  return results.slice(0, topN);
}

// ============================================================================
// Parse font buffer (handles WOFF2 decompression)
// ============================================================================

export async function parseFontBuffer(buffer: ArrayBuffer): Promise<opentype.Font | null> {
  try {
    let parseBuffer = buffer;

    // Check for WOFF2 signature (wOF2 = 0x774F4632)
    const view = new DataView(buffer);
    const signature = view.getUint32(0);
    if (signature === 0x774F4632) {
      const { decompress } = await import('wawoff2');
      const decompressed = await decompress(Buffer.from(buffer));
      parseBuffer = new Uint8Array(decompressed).buffer as ArrayBuffer;
    }

    return opentype.parse(parseBuffer);
  } catch (error) {
    console.error('Font parse error:', error);
    return null;
  }
}

/**
 * Extract features from a raw font buffer (WOFF2/TTF/OTF).
 */
export async function extractFeaturesFromBuffer(buffer: ArrayBuffer): Promise<FeatureVector | null> {
  const font = await parseFontBuffer(buffer);
  if (!font) return null;
  return extractFeatures(font);
}
