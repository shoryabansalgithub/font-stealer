'use client';

import { FontInfo } from '../types';
import FontCard from './FontCard';

interface FontGridProps {
    fonts: FontInfo[];
}

export default function FontGrid({ fonts }: FontGridProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fonts.map((font, index) => (
                <FontCard key={`${font.url}-${index}`} font={font} index={index} />
            ))}
        </div>
    );
}
