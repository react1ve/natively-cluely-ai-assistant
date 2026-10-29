import React from 'react';

/**
 * Natively logomark — "N" letterform inscribed in a circle.
 * Rendered as inline SVG so it inherits `color` (currentColor) and
 * can be styled freely with className.
 *
 * The exact master geometry (brand/natively-mark-*.svg): one filled
 * path, ring + uprights + diagonal all one width (75/1024), cropped to the ring.
 */
export const NativelyLogoMark: React.FC<{
    size?: number;
    className?: string;
}> = ({ size = 18, className = '' }) => (
    <svg
        width={size}
        height={size}
        viewBox="106 106 812 812"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-hidden="true"
    >
        <path
            fill="currentColor"
            d="M701.1 317.3 A268 268 0 1 0 701.1 706.7 A48 48 0 0 0 635.2 637.0 A172 172 0 1 1 635.2 387.0 A48 48 0 0 0 701.1 317.3 Z M712 580 C724 538 738 524 780 512 C738 500 724 486 712 444 C700 486 686 500 644 512 C686 524 700 538 712 580 Z"
        />
    </svg>
);
