# Font Downloader

A web tool to discover and download fonts from any website. Simply enter a URL to extract all fonts used on the page, preview them live, and download with a single click.

## ⚠️ Important Legal Disclaimer

**This tool does not grant licenses or permissions for font usage.**

Users are solely responsible for ensuring they have the legal right to download and use any font files accessed through this tool. The service is provided for inspection and development purposes only.

Always verify that you have proper licensing before using downloaded fonts in your projects.

## Features

- 🔍 Extract fonts from any website URL
- 👀 Live preview of each font with customizable text
- 📥 One-click download support for WOFF, WOFF2, TTF, and OTF formats
- ⚡ Fast extraction with modern Next.js architecture
- 🎨 Beautiful UI with smooth animations

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm, yarn, pnpm, or bun package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/shoryabansalgithub/font-stealer.git
cd font-stealer
```

2. Install dependencies:
```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

3. Run the development server:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## How It Works

1. Enter any website URL in the search box
2. The tool fetches and analyzes the page's CSS and font files
3. All discovered fonts are displayed with their family names, weights, and styles
4. Click on any font to preview it with custom text
5. Download fonts individually with the download button

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Font Loading:** Next.js Font Optimization

## API Routes

- `/api/extract` - POST endpoint to extract fonts from a given URL
- `/api/font` - GET endpoint to fetch and serve font files

## Supported Font Formats

- WOFF (Web Open Font Format)
- WOFF2 (Web Open Font Format 2)
- TTF (TrueType Font)
- OTF (OpenType Font)

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Disclaimer

This tool is intended for educational and development purposes only. Users must comply with font licensing agreements and copyright laws. The creators of this tool are not responsible for any misuse or copyright infringement by users.
