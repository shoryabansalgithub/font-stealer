import { NextRequest, NextResponse } from 'next/server';

interface FontInfo {
  name: string;
  family: string;
  format: string;
  url: string;
  weight?: string;
  style?: string;
  referer?: string;
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

const fontSourceRegex = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)\s*(?:format\s*\(\s*['"]?([^'")]+)['"]?\s*\))?/gi;
const formatPreference = ['WOFF2', 'WOFF', 'OPENTYPE', 'TRUETYPE', 'OTF', 'TTF', 'EOT', 'SVG'];

function normalizeFamilyName(family: string): string {
  return family.replace(/["']/g, '').trim();
}

function pickBestSource(src: string, baseUrl: string): { url: string; format: string } | null {
  const candidates: { url: string; format: string }[] = [];
  let match;
  const regexCopy = new RegExp(fontSourceRegex.source, 'gi');

  while ((match = regexCopy.exec(src)) !== null) {
    const rawUrl = match[1]?.trim();
    if (!rawUrl || rawUrl.startsWith('local(')) continue;
    const resolvedUrl = resolveUrl(baseUrl, rawUrl);
    const rawFormat = match[2]?.replace(/["']/g, '').trim().toUpperCase() || getFormatFromUrl(rawUrl);
    candidates.push({ url: resolvedUrl, format: rawFormat });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aIndex = formatPreference.indexOf(a.format.toUpperCase());
    const bIndex = formatPreference.indexOf(b.format.toUpperCase());
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return candidates[0];
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

    const family = normalizeFamilyName(familyMatch[1]);
    const srcValue = srcMatch[1];
    const bestSource = pickBestSource(srcValue, baseUrl);
    if (!bestSource) continue;

    const fileName = bestSource.url.startsWith('data:')
      ? 'embedded-font'
      : bestSource.url.split('/').pop()?.split('?')[0] || '';
    const name = fileName || `${family}-${bestSource.format}`;

    fonts.push({
      name,
      family,
      format: bestSource.format,
      url: bestSource.url,
      weight: weightMatch ? weightMatch[1].trim() : '400',
      style: styleMatch ? styleMatch[1].trim() : 'normal'
    });
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

async function extractFontsWithPlaywright(targetUrl: string): Promise<FontInfo[]> {
  let browser: any;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve()));

    const fontFaces = await page.evaluate(() => {
      return Array.from(document.fonts).map((fontFace) => ({
        family: fontFace.family,
        style: fontFace.style,
        weight: fontFace.weight,
        status: fontFace.status,
        src: (fontFace as unknown as { src?: string }).src || ''
      }));
    });

    const fonts: FontInfo[] = [];
    for (const face of fontFaces) {
      if (face.status !== 'loaded' && face.status !== 'loading') continue;
      if (!face.src) continue;

      const bestSource = pickBestSource(face.src, targetUrl);
      if (!bestSource) continue;

      const family = normalizeFamilyName(face.family || 'Unknown Font');
      const fileName = bestSource.url.startsWith('data:')
        ? 'embedded-font'
        : bestSource.url.split('/').pop()?.split('?')[0] || '';

      fonts.push({
        name: fileName || `${family}-${bestSource.format}`,
        family,
        format: bestSource.format,
        url: bestSource.url,
        weight: face.weight || '400',
        style: face.style || 'normal',
        referer: targetUrl
      });
    }

    return fonts;
  } catch {
    return [];
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore
      }
    }
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

    let realFonts = await extractFontsWithPlaywright(targetUrl.href);

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

    // 1. Inline styles
    const inlineStyleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch;
    while ((styleMatch = inlineStyleRegex.exec(html)) !== null) {
      const { fonts, imports } = extractFontsFromCSS(styleMatch[1], targetUrl.href);
      // Attach referer to inline fonts
      allFonts.push(...fonts.map(f => ({ ...f, referer: targetUrl.href })));

      const importFonts = await Promise.all(imports.map(i => fetchAndParseCSS(i, 0, fetchedCssUrls)));
      const importFontsWithReferer = importFonts.flat().map(f => ({ ...f, referer: targetUrl.href }));
      allFonts.push(...importFontsWithReferer);
    }

    // 2. Linked stylesheets and Preloaded fonts
    const linkTagRegex = /<link[^>]+>/gi;
    const relRegex = /rel=["']?([^"'\s]+)["']?/i;
    const hrefRegex = /href=["']?([^"'\s>]+)["']?/i;
    const asRegex = /as=["']?([^"'\s]+)["']?/i;

    let linkMatch;
    const initialCssUrls: string[] = [];

    while ((linkMatch = linkTagRegex.exec(html)) !== null) {
      const tag = linkMatch[0];
      const rel = tag.match(relRegex)?.[1].toLowerCase() || '';
      const href = tag.match(hrefRegex)?.[1] || '';
      const as = tag.match(asRegex)?.[1]?.toLowerCase() || '';

      if (!href) continue;
      const resolvedUrl = resolveUrl(targetUrl.href, href);

      if (rel === 'stylesheet' || (rel === 'preload' && as === 'style')) {
        initialCssUrls.push(resolvedUrl);
      } else if ((rel === 'preload' || rel === 'prefetch') && as === 'font') {
        const format = getFormatFromUrl(resolvedUrl);
        const name = resolvedUrl.split('/').pop()?.split('?')[0] || 'preloaded-font';
        allFonts.push({
          name: name,
          family: name.split('.')[0] || 'Unknown Font',
          format,
          url: resolvedUrl,
          weight: '400',
          style: 'normal',
          referer: targetUrl.href
        });
      }
    }

    // 3. Process all linked CSS files
    const linkedFonts = await Promise.all(initialCssUrls.map(u => fetchAndParseCSS(u, 0, fetchedCssUrls)));
    // Attach referer to linked fonts
    const fontsWithReferer = linkedFonts.flat().map(font => ({ ...font, referer: targetUrl.href }));
    allFonts.push(...fontsWithReferer);

    // Deduplicate fonts by URL (keeping the first occurrence)
    const uniqueFontsMap = new Map<string, FontInfo>();
    for (const font of allFonts) {
      if (!uniqueFontsMap.has(font.url)) {
        uniqueFontsMap.set(font.url, font);
      }
    }
    const uniqueFonts = Array.from(uniqueFontsMap.values());

    const mergedFonts = realFonts.length > 0 ? [...realFonts, ...uniqueFonts] : uniqueFonts;
    const mergedUnique = new Map<string, FontInfo>();
    for (const font of mergedFonts) {
      if (!mergedUnique.has(font.url)) {
        mergedUnique.set(font.url, font);
      }
    }

    const mergedValues = Array.from(mergedUnique.values());

    return NextResponse.json({
      fonts: mergedValues,
      totalFound: mergedValues.length,
      sourceUrl: targetUrl.href
    });

  } catch (error) {
    console.error('Font extraction error:', error);
    return NextResponse.json({ error: 'Failed to extract fonts' }, { status: 500 });
  }
}
