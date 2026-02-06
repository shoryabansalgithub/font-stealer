'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from  'motion/react';

const fonts = [
    { name: 'Heading', family: 'CustomHeading, sans-serif' },
    { name: 'Inter', family: 'var(--font-inter), sans-serif' },
    { name: 'Geist', family: 'var(--font-geist), sans-serif' },
    { name: 'Manrope', family: 'var(--font-manrope), sans-serif' },
    { name: 'Custom', family: 'CustomFont, sans-serif' },
];

export default function HeroSection() {
    const [currentFontIndex, setCurrentFontIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const handleFontSwitch = () => {
        if (isAnimating) return;
        setIsAnimating(true);
        setCurrentFontIndex((prev) => (prev + 1) % fonts.length);
    };

    useEffect(() => {
        const timer = setTimeout(() => setIsAnimating(false), 400);
        return () => clearTimeout(timer);
    }, [currentFontIndex]);

    const currentFont = fonts[currentFontIndex];

    return (
        <section className="relative pt-32 pb-16 px-6">
            <div className="relative max-w-4xl mx-auto text-center">
                {/* Eyebrow */}
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    className="text-sm font-medium text-gray-500 tracking-wide uppercase mb-6"
                >
                    Font Discovery Tool
                </motion.p>

                {/* Main Heading - Clickable to switch fonts */}
                <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay: 0.1 }}
                    className="relative"
                >
                    <button
                        onClick={handleFontSwitch}
                        className="group relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-4 rounded-lg"
                        aria-label={`Currently using ${currentFont.name} font. Click to switch fonts.`}
                    >
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={currentFontIndex}
                                initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
                                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                exit={{ opacity: 0, y: -20, filter: 'blur(4px)' }}
                                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                                className="block text-6xl md:text-8xl font-semibold text-gray-900 tracking-tight leading-none"
                                style={{ fontFamily: currentFont.family }}
                            >
                                Download Any Font
                            </motion.span>
                        </AnimatePresence>

                        {/* Font indicator badge */}
                        <motion.span
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                            className="absolute -bottom-8 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 text-xs font-medium text-gray-400 group-hover:text-gray-600 transition-colors duration-150"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-gray-400 transition-colors duration-150" />
                            {currentFont.name}
                            <span className="text-gray-300">·</span>
                            <span className="text-gray-400 group-hover:text-gray-500">Click to switch</span>
                        </motion.span>
                    </button>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
                    className="mt-16 text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed"
                >
                    Enter any website URL and instantly discover all the fonts it uses.
                    Preview them live and download with a single click.
                </motion.p>
            </div>
        </section>
    );
}
