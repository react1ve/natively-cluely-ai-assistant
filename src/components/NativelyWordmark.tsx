import React from 'react';
import { BRAND_NAME } from '../lib/brand.mjs';

/**
 * Natively wordmark: the lowercase "natively" the website draws in its navbar
 * (natively-website src/assets/brand/natively-wordmark-black.svg, TT Interphases
 * Pro DemiBold). Inline SVG filled with currentColor, so it takes the text colour
 * of wherever it sits and follows every theme. The viewBox is the word's own box,
 * 80.1 x 22; the baseline is at 16.68 of the 22 (the y's tail hangs below it).
 */
export const NativelyWordmark: React.FC<{
    /** Drawn height in px; the width follows the word. */
    height?: number;
    className?: string;
}> = ({ height = 14, className = '' }) => (
    // The product is Clevi now (src/lib/brand.mjs); the old vector "natively"
    // lettering is replaced by the name set in the UI font at the same height.
    <span
        className={className}
        role="img"
        aria-label={BRAND_NAME}
        style={{ fontSize: height * 1.12, lineHeight: `${height}px`, fontWeight: 650, letterSpacing: '-0.02em', display: 'inline-block' }}
    >
        {BRAND_NAME.toLowerCase()}
    </span>
);
