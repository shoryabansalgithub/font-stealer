import { NextRequest, NextResponse } from 'next/server';

interface FontInfo {
  name: string;
  family: string;
  format: string;
  url: string;
  weight?: string;
  style?: string;
}

// More robust regex to extract @font-face blocks
const fontFaceRegex = /@font-face\s*\{([\s\S]*?)\}/gi;
// Regex to extract @import rules
const importRegex = /@import\s+(?:url\(['"]?|['"])([^'")]+\.css[^'")]*)(?:['"]?\)['"]?|['"])\s*[^;]*;/gi;

// Regex to extract properties from @font-face
const fontFamilyRegex = /font-family\s*:\s*['"]?([^'";]+)['"]?/i;
const srcRegex = /src\s*:\s*([^;]+)/i;
const urlRegex = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
const formatRegex = /format\s*\(\s*['"]?([^'")]+)['"]?\s*\)/i;
const weightRegex = /font-weight\s*:\s*([^;]+)/i;
const styleRegex = /font-style\s*:\s*([^;]+)/i;

function resolveUrl(base: string, relative: string): string {
  try {
    if (relative.startsWith('data:')) return relative;
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function getFormatFromUrl(url: string): string {
  const cleanUrl = url.split('?')[0].split('#')[0];
  const ext = cleanUrl.split('.').pop()?.toLowerCase();
  const formatMap: Record<string, string> = {
    'woff2': 'WOFF2',
    'woff': 'WOFF',
    'ttf': 'TrueType',
    'otf': 'OpenType',
    'eot': 'EOT',
    'svg': 'SVG'
  };
  return formatMap[ext || ''] || 'Unknown';
}

function extractFontsFromCSS(css: string, baseUrl: string): { fonts: FontInfo[], imports: string[] } {
  const fonts: FontInfo[] = [];
  const imports: string[] = [];

  // Extract @import rules
  let importMatch;
  const importRegexCopy = new RegExp(importRegex.source, 'gi');
  while ((importMatch = importRegexCopy.exec(css)) !== null) {
    imports.push(resolveUrl(baseUrl, importMatch[1]));
  }

  // Extract @font-face blocks
  let blockMatch;
  const fontFaceRegexCopy = new RegExp(fontFaceRegex.source, 'gi');
  while ((blockMatch = fontFaceRegexCopy.exec(css)) !== null) {
    const block = blockMatch[1];
    const familyMatch = block.match(fontFamilyRegex);
    const srcMatch = block.match(srcRegex);
    const weightMatch = block.match(weightRegex);
    const styleMatch = block.match(styleRegex);

    if (!familyMatch || !srcMatch) continue;

    const family = familyMatch[1].replace(/['"]/g, '').trim();
    const srcValue = srcMatch[1];

    let urlMatch;
    const urlRegexCopy = new RegExp(urlRegex.source, 'gi');
    while ((urlMatch = urlRegexCopy.exec(srcValue)) !== null) {
      const rawUrl = urlMatch[1].replace(/['"]/g, '').trim();
      const resolvedUrl = resolveUrl(baseUrl, rawUrl);

      const afterUrl = srcValue.slice(urlMatch.index + urlMatch[0].length);
      const formatMatch = afterUrl.match(formatRegex);
      const format = formatMatch ? formatMatch[1].replace(/['"]/g, '').toUpperCase() : getFormatFromUrl(rawUrl);

      const fileName = rawUrl.startsWith('data:') ? 'embedded-font' : rawUrl.split('/').pop()?.split('?')[0] || '';
      const name = fileName || `${family}-${format}`;

      fonts.push({
        name,
        family,
        format,
        url: resolvedUrl,
        weight: weightMatch ? weightMatch[1].trim() : '400',
        style: styleMatch ? styleMatch[1].trim() : 'normal'
      });
    }
  }

  return { fonts, imports };
}

const MAX_IMPORT_DEPTH = 3;

async function fetchAndParseCSS(url: string, depth: number = 0, fetchedUrls: Set<string> = new Set()): Promise<FontInfo[]> {
  if (depth > MAX_IMPORT_DEPTH || fetchedUrls.has(url)) return [];
  fetchedUrls.add(url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) return [];
    const css = await response.text();
    const { fonts, imports } = extractFontsFromCSS(css, url);

    const nestedFonts = await Promise.all(imports.map(i => fetchAndParseCSS(i, depth + 1, fetchedUrls)));
    return [...fonts, ...nestedFonts.flat()];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    if (!url) return NextResponse.json({ error: 'URL is required' }, { status: 400 });

    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const response = await fetch(targetUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch website: ${response.status}` }, { status: 400 });
    }

    const html = await response.text();
    const allFonts: FontInfo[] = [];
    const fetchedCssUrls = new Set<string>();

    // Inline styles
    const inlineStyleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch;
    while ((styleMatch = inlineStyleRegex.exec(html)) !== null) {
      const { fonts, imports } = extractFontsFromCSS(styleMatch[1], targetUrl.href);
      allFonts.push(...fonts);
      // Follow imports from inline styles
      const importFonts = await Promise.all(imports.map(i => fetchAndParseCSS(i, 0, fetchedCssUrls)));
      allFonts.push(...importFonts.flat());
    }

    // Linked stylesheets
    const linkRegex = /<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi;
    const hrefRegex = /href=["']([^"']+)["']/i;
    let linkMatch;
    const initialCssUrls: string[] = [];

    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const hrefMatch = linkMatch[0].match(hrefRegex);
      if (hrefMatch) {
        initialCssUrls.push(resolveUrl(targetUrl.href, hrefMatch[1]));
      }
    }

    // Process all linked CSS files (recursively handling @import)
    const linkedFonts = await Promise.all(initialCssUrls.map(u => fetchAndParseCSS(u, 0, fetchedCssUrls)));
    allFonts.push(...linkedFonts.flat());

    // Deduplicate fonts by URL (keeping the first occurrence)
    const uniqueFontsMap = new Map<string, FontInfo>();
    for (const font of allFonts) {
      if (!uniqueFontsMap.has(font.url)) {
        uniqueFontsMap.set(font.url, font);
      }
    }
    const uniqueFonts = Array.from(uniqueFontsMap.values());

    return NextResponse.json({
      fonts: uniqueFonts,
      totalFound: uniqueFonts.length,
      sourceUrl: targetUrl.href
    });

  } catch (error) {
    console.error('Font extraction error:', error);
    return NextResponse.json({ error: 'Failed to extract fonts' }, { status: 500 });
  }
}
