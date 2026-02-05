'use client';

import { useState } from 'react';
import FontGrid from './FontGrid';
import { FontInfo } from '../types';

export type { FontInfo };

export default function FontStealer() {
    const [url, setUrl] = useState('');
    const [fonts, setFonts] = useState<FontInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searched, setSearched] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!url.trim()) {
            setError('Please enter a URL');
            return;
        }

        // Add protocol if missing
        let targetUrl = url.trim();
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }

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
                // Prioritize normal style over italic
                const aIsItalic = a.style?.toLowerCase().includes('italic') ? 1 : 0;
                const bIsItalic = b.style?.toLowerCase().includes('italic') ? 1 : 0;
                if (aIsItalic !== bIsItalic) return aIsItalic - bIsItalic;

                // Prioritize weight 400 (regular)
                const aWeight = parseInt(a.weight || '400');
                const bWeight = parseInt(b.weight || '400');
                const aDiff = Math.abs(aWeight - 400);
                const bDiff = Math.abs(bWeight - 400);
                return aDiff - bDiff;
            });

            // Deduplicate fonts by family name only - one per family (keeping the first = normal)
            const seenFamilies = new Set<string>();
            const uniqueFonts = sortedFonts.filter((font: FontInfo) => {
                const key = font.family.toLowerCase().trim();
                if (seenFamilies.has(key)) {
                    return false;
                }
                seenFamilies.add(key);
                return true;
            });

            // Sort final list alphabetically by family name
            uniqueFonts.sort((a: FontInfo, b: FontInfo) => {
                return a.family.localeCompare(b.family);
            });

            setFonts(uniqueFonts);

            if (uniqueFonts.length === 0) {
                setError('No fonts found on this website');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto px-4">
            {/* Search Form */}
            <form onSubmit={handleSubmit} className="mb-12">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition duration-500"></div>
                    <div className="relative flex items-center bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                        <div className="pl-5 pr-3">
                            <svg className="w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Enter website URL (e.g., apple.com)"
                            className="flex-1 bg-transparent text-white text-lg py-5 px-2 outline-none placeholder:text-zinc-600"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="m-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-pink-400 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    <span>Scanning...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    <span>Extract Fonts</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>

            {/* Error Message */}
            {error && (
                <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center animate-fade-in">
                    {error}
                </div>
            )}

            {/* Results */}
            {fonts.length > 0 && (
                <div className="animate-fade-in">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">
                            Found <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">{fonts.length}</span> fonts
                        </h2>
                    </div>
                    <FontGrid fonts={fonts} />
                </div>
            )}

            {/* Empty State */}
            {searched && !loading && fonts.length === 0 && !error && (
                <div className="text-center py-16 animate-fade-in">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-zinc-800 flex items-center justify-center">
                        <svg className="w-10 h-10 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-zinc-500 text-lg">No fonts found on this website</p>
                </div>
            )}
        </div>
    );
}
