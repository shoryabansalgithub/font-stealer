import { NextRequest, NextResponse } from 'next/server';

interface FontInfo {
  name: string;
  family: string;
  format: string;
  url: string;
  weight?: string;
  style?: string;
}

// Regex to extract @font-face blocks
const fontFaceRegex = /@font-face\s*\{[^}]+\}/gi;

// Regex to extract properties from @font-face
const fontFamilyRegex = /font-family\s*:\s*['"]?([^'";]+)['"]?/i;
const srcRegex = /src\s*:\s*([^;]+)/i;
const urlRegex = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
const formatRegex = /format\s*\(\s*['"]?([^'")]+)['"]?\s*\)/i;
const weightRegex = /font-weight\s*:\s*([^;]+)/i;
const styleRegex = /font-style\s*:\s*([^;]+)/i;

function resolveUrl(base: string, relative: string): string {
  try {
    // Handle data URLs
    if (relative.startsWith('data:')) {
      return relative;
    }
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

function getFormatFromUrl(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
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

function extractFontsFromCSS(css: string, baseUrl: string): FontInfo[] {
  const fonts: FontInfo[] = [];
  const fontFaceBlocks = css.match(fontFaceRegex) || [];

  for (const block of fontFaceBlocks) {
    const familyMatch = block.match(fontFamilyRegex);
    const srcMatch = block.match(srcRegex);
    const weightMatch = block.match(weightRegex);
    const styleMatch = block.match(styleRegex);

    if (!familyMatch || !srcMatch) continue;

    const family = familyMatch[1].trim();
    const srcValue = srcMatch[1];

    // Extract all URLs from src
    let urlMatch;
    const urlRegexCopy = new RegExp(urlRegex.source, 'gi');
    
    while ((urlMatch = urlRegexCopy.exec(srcValue)) !== null) {
      const rawUrl = urlMatch[1];
      
      // Skip data URLs for now (too large)
      if (rawUrl.startsWith('data:')) continue;

      const resolvedUrl = resolveUrl(baseUrl, rawUrl);
      
      // Get format from format() or from URL extension
      const afterUrl = srcValue.slice(urlMatch.index + urlMatch[0].length);
      const formatMatch = afterUrl.match(formatRegex);
      const format = formatMatch ? formatMatch[1].toUpperCase() : getFormatFromUrl(rawUrl);

      // Generate a readable name
      const urlParts = rawUrl.split('/');
      const fileName = urlParts[urlParts.length - 1].split('?')[0];
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

  return fonts;
}

async function fetchCSS(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    let targetUrl: URL;
    try {
      targetUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Fetch the main page
    const response = await fetch(targetUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch website: ${response.status}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    const allFonts: FontInfo[] = [];

    // Extract inline styles
    const inlineStyleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let styleMatch;
    while ((styleMatch = inlineStyleRegex.exec(html)) !== null) {
      const fonts = extractFontsFromCSS(styleMatch[1], targetUrl.href);
      allFonts.push(...fonts);
    }

    // Extract linked stylesheets
    const linkRegex = /<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi;
    const hrefRegex = /href=["']([^"']+)["']/i;
    let linkMatch;

    const cssUrls: string[] = [];
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const hrefMatch = linkMatch[0].match(hrefRegex);
      if (hrefMatch) {
        const cssUrl = resolveUrl(targetUrl.href, hrefMatch[1]);
        cssUrls.push(cssUrl);
      }
    }

    // Also check for link tags with href before rel
    const linkRegex2 = /<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]*>/gi;
    while ((linkMatch = linkRegex2.exec(html)) !== null) {
      const cssUrl = resolveUrl(targetUrl.href, linkMatch[1]);
      if (!cssUrls.includes(cssUrl)) {
        cssUrls.push(cssUrl);
      }
    }

    // Fetch all CSS files in parallel
    const cssContents = await Promise.all(cssUrls.map(fetchCSS));

    for (let i = 0; i < cssContents.length; i++) {
      const fonts = extractFontsFromCSS(cssContents[i], cssUrls[i]);
      allFonts.push(...fonts);
    }

    // Deduplicate fonts by URL
    const uniqueFonts = allFonts.filter((font, index, self) =>
      index === self.findIndex(f => f.url === font.url)
    );

    return NextResponse.json({ 
      fonts: uniqueFonts,
      totalFound: uniqueFonts.length,
      sourceUrl: targetUrl.href
    });

  } catch (error) {
    console.error('Font extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract fonts' },
      { status: 500 }
    );
  }
}
