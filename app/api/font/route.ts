import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    const referer = request.nextUrl.searchParams.get('referer');

    if (!url) {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
        const origin = referer ? new URL(referer).origin : undefined;
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': '*/*',
                'Referer': referer || new URL(url).origin,
                ...(origin ? { 'Origin': origin } : {})
            }
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch font: ${response.status}` },
                { status: response.status }
            );
        }

        const buffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'font/woff2';

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('Font proxy error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch font' },
            { status: 500 }
        );
    }
}
