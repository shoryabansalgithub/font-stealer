'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FontInfo } from '../types';

interface FontCardProps {
    font: FontInfo;
    index: number;
}

export default function FontCard({ font, index }: FontCardProps) {
    const [downloading, setDownloading] = useState(false);
    const [fontLoaded, setFontLoaded] = useState(false);

    // Only proxy external URLs, keep data URLs as is
    const isDataUrl = font.url.startsWith('data:');
    const displayUrl = isDataUrl ? font.url : `/api/font?url=${encodeURIComponent(font.url)}`;

    useEffect(() => {
        const fontId = `font-preview-${index}`;
        const existingStyle = document.getElementById(fontId);
        if (existingStyle) existingStyle.remove();

        const style = document.createElement('style');
        style.id = fontId;
        style.textContent = `
      @font-face {
        font-family: 'PreviewFont${index}';
        src: url('${displayUrl}');
        font-weight: ${font.weight || 'normal'};
        font-style: ${font.style || 'normal'};
      }
    `;
        document.head.appendChild(style);

        // Faster timeout for data URLs as they don't need network fetch
        setTimeout(() => setFontLoaded(true), isDataUrl ? 100 : 800);

        return () => {
            const el = document.getElementById(fontId);
            if (el) el.remove();
        };
    }, [font, index, displayUrl, isDataUrl]);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            let blob: Blob;
            if (isDataUrl) {
                const response = await fetch(font.url);
                blob = await response.blob();
            } else {
                const response = await fetch(displayUrl);
                blob = await response.blob();
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = font.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            window.open(font.url, '_blank');
        } finally {
            setDownloading(false);
        }
    };

    const formatBadgeStyle = (format: string): string => {
        const styles: Record<string, string> = {
            'WOFF2': 'bg-emerald-50 text-emerald-600',
            'WOFF': 'bg-blue-50 text-blue-600',
            'TRUETYPE': 'bg-violet-50 text-violet-600',
            'TTF': 'bg-violet-50 text-violet-600',
            'OPENTYPE': 'bg-amber-50 text-amber-600',
            'OTF': 'bg-amber-50 text-amber-600',
            'EOT': 'bg-red-50 text-red-600',
        };
        return styles[format.toUpperCase()] || 'bg-gray-100 text-gray-600';
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.4,
                ease: [0.23, 1, 0.32, 1],
                delay: index * 0.05
            }}
            className="group relative bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] transition-all duration-200 ease"
        >
            <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate" title={font.family}>
                            {font.family}
                        </h3>
                        <p className="text-sm text-gray-400 truncate mt-0.5" title={font.name}>
                            {font.name}
                        </p>
                    </div>
                    <span className={`ml-3 px-2.5 py-1 text-xs font-medium rounded-lg ${formatBadgeStyle(font.format)}`}>
                        {font.format}
                    </span>
                </div>

                {/* Font Preview */}
                <div className="mb-5 p-5 bg-gray-50 rounded-xl min-h-[100px] flex items-center justify-center">
                    {fontLoaded ? (
                        <p
                            className="text-2xl text-gray-900 text-center leading-relaxed"
                            style={{
                                fontFamily: `'PreviewFont${index}', sans-serif`,
                                fontStyle: font.style || 'normal',
                                fontWeight: font.weight || 'normal'
                            }}
                        >
                            The quick brown fox jumps over the lazy dog
                        </p>
                    ) : (
                        <div className="flex items-center gap-2 text-gray-400">
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            <span className="text-sm">Loading preview…</span>
                        </div>
                    )}
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-4 mb-5 text-sm text-gray-400">
                    <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                        </svg>
                        <span className="tabular-nums">{font.weight || '400'}</span>
                    </span>
                    <span className="flex items-center gap-1.5 capitalize">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16m-7 6h7" />
                        </svg>
                        {font.style || 'Normal'}
                    </span>
                </div>

                {/* Download Button */}
                <motion.button
                    onClick={handleDownload}
                    disabled={downloading}
                    whileTap={{ scale: 0.97 }}
                    className={`
            w-full py-3 px-4
            text-sm font-medium
            rounded-xl
            transition-all duration-150 ease
            focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2
            ${downloading
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950'
                        }
          `}
                >
                    {downloading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Downloading…
                        </span>
                    ) : (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                        </span>
                    )}
                </motion.button>
            </div>
        </motion.div>
    );
}
