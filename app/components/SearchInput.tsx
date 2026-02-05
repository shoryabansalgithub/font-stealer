'use client';

import { useState, useRef } from 'react';
import { motion } from 'motion/react';

interface SearchInputProps {
    onSearch: (url: string) => void;
    loading: boolean;
}

export default function SearchInput({ onSearch, loading }: SearchInputProps) {
    const [url, setUrl] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim() || loading) return;

        let targetUrl = url.trim();
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }
        onSearch(targetUrl);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1], delay: 0.3 }}
            className="w-full max-w-2xl mx-auto px-6"
        >
            <form onSubmit={handleSubmit}>
                <div
                    className={`
            relative flex items-center
            bg-white rounded-2xl
            transition-shadow duration-200 ease
            ${isFocused
                            ? 'shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_4px_24px_-4px_rgba(0,0,0,0.12)]'
                            : 'shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(0,0,0,0.08)]'
                        }
          `}
                >
                    {/* Search Icon */}
                    <div className="pl-5 pr-2">
                        <svg
                            className={`w-5 h-5 transition-colors duration-150 ${isFocused ? 'text-gray-500' : 'text-gray-400'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.5}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </div>

                    {/* Input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Enter website URL"
                        className="
              flex-1 
              py-4 px-2 
              text-base text-gray-900 
              placeholder:text-gray-400
              bg-transparent 
              outline-none
              min-w-0
            "
                        style={{ fontSize: '16px' }} /* Prevent iOS zoom */
                    />

                    {/* Submit Button */}
                    <div className="pr-2">
                        <motion.button
                            type="submit"
                            disabled={loading || !url.trim()}
                            whileTap={{ scale: 0.97 }}
                            className={`
                px-5 py-2.5
                text-sm font-medium
                rounded-xl
                transition-all duration-150 ease
                outline-none
                ${loading || !url.trim()
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950'
                                }
              `}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                                        <circle
                                            className="opacity-25"
                                            cx="12" cy="12" r="10"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                            fill="none"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                        />
                                    </svg>
                                    Scanning
                                </span>
                            ) : (
                                'Extract'
                            )}
                        </motion.button>
                    </div>
                </div>

                {/* Helper text */}
                <p className="mt-3 text-center text-sm text-gray-400">
                    Try <button
                        type="button"
                        onClick={() => { setUrl('stripe.com'); inputRef.current?.focus(); }}
                        className="text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors duration-150"
                    >stripe.com</button>, <button
                        type="button"
                        onClick={() => { setUrl('linear.app'); inputRef.current?.focus(); }}
                        className="text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors duration-150"
                    >linear.app</button>, or <button
                        type="button"
                        onClick={() => { setUrl('vercel.com'); inputRef.current?.focus(); }}
                        className="text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors duration-150"
                    >vercel.com</button>
                </p>
            </form>
        </motion.div>
    );
}
