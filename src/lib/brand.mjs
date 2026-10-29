// src/lib/brand.mjs
//
// The name the user sees (2026-10-29: Natively → Clevi). Shared by the renderer
// (t() runs every UI string through withBrand) and the main process (menu,
// tray, notifications). Internal names stay: productName / executable, the
// profile directory and the bundle id are untouched, so settings, meetings and
// keys carry over.
//
// Natively's own services keep their names: there is no "Clevi API" or "Clevi
// Pro", and the browser extension is still listed as "Natively Companion".

export const BRAND_NAME = 'Clevi';

const SOURCE = /\bNatively\b(?!-|\s+(?:API|Pro|Companion|Plans?|Max|Ultra)\b)/g;

/** `text` with the old product name replaced by BRAND_NAME (vendor services kept). */
export function withBrand(text) {
  return typeof text === 'string' && text.includes('Natively') ? text.replace(SOURCE, BRAND_NAME) : text;
}
