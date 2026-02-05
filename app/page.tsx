'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HeroSection from './components/HeroSection';
import SearchInput from './components/SearchInput';
import FontGrid from './components/FontGrid';
import { FontInfo } from './types';

export default function Home() {
  const [fonts, setFonts] = useState<FontInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async (targetUrl: string) => {
    setLoading(true);
    setError('');
    setFonts([]);
    setSearched(true);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract fonts');
      }

      // Sort fonts: normal style first, then regular weight (400) preferred
      const sortedFonts = [...data.fonts].sort((a: FontInfo, b: FontInfo) => {
        const aIsItalic = a.style?.toLowerCase().includes('italic') ? 1 : 0;
        const bIsItalic = b.style?.toLowerCase().includes('italic') ? 1 : 0;
        if (aIsItalic !== bIsItalic) return aIsItalic - bIsItalic;

        const aWeight = parseInt(a.weight || '400');
        const bWeight = parseInt(b.weight || '400');
        const aDiff = Math.abs(aWeight - 400);
        const bDiff = Math.abs(bWeight - 400);
        return aDiff - bDiff;
      });

      sortedFonts.sort((a: FontInfo, b: FontInfo) => a.family.localeCompare(b.family));
      setFonts(sortedFonts);

      if (sortedFonts.length === 0) {
        setError('No fonts found on this website');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white relative">
      {/* Background Pattern */}
      <div className="fixed inset-0 h-full w-full bg-white pointer-events-none">
        <div className="absolute h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="absolute left-0 right-0 top-0 m-auto h-[310px] w-[310px] rounded-full bg-fuchsia-400 opacity-20 blur-[100px]"></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <HeroSection />

        {/* Search Input */}
        <div className="mt-8">
          <SearchInput onSearch={handleSearch} loading={loading} />
        </div>

        {/* Results Section */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          {/* Error Message */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-center text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Header */}
          <AnimatePresence mode="wait">
            {fonts.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="mb-8"
              >
                <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Found {fonts.length} {fonts.length === 1 ? 'font' : 'fonts'}
                </h2>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Font Grid */}
          <AnimatePresence mode="wait">
            {fonts.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <FontGrid fonts={fonts} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty State */}
          <AnimatePresence mode="wait">
            {searched && !loading && fonts.length === 0 && !error && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="text-center py-16"
              >
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-gray-500">No fonts found on this website</p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Footer */}
        <footer className="py-8 text-center text-sm text-gray-400">
          <p>Supports WOFF, WOFF2, TTF, and OTF formats</p>
        </footer>
      </div>
    </main>
  );
}
