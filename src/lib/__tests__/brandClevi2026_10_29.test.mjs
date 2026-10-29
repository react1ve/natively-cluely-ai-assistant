// The product shows as Clevi (2026-10-29).
//
// Every UI string goes through t(), which runs withBrand(); the main process
// uses BRAND_NAME for the menu/Dock name, tray and notifications. Natively's own
// services keep their names, and internal names (productName, profile dir,
// bundle id) are untouched so settings and meetings carry over.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BRAND_NAME, withBrand } from '../brand.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('the old name becomes Clevi; vendor services, URLs and repo names stay', () => {
  assert.equal(BRAND_NAME, 'Clevi');
  assert.equal(withBrand('Start Natively'), 'Start Clevi');
  assert.equal(withBrand('Natively не слышит ваш микрофон'), 'Clevi не слышит ваш микрофон');
  for (const kept of ['Natively API key', 'Natively Pro', 'Natively Companion', 'Natively-AI-assistant', 'heynatively.com']) {
    assert.equal(withBrand(kept), kept);
  }
  assert.equal(withBrand(undefined), undefined);
});

test('t() brands every string it returns', () => {
  assert.match(read('src/i18n.tsx'), /\(text: string\) => withBrand\(lang === 'en' \? text : \(DICT\[lang\]\[text\] \?\? text\)\),/);
});

test('the bundle shows Clevi, and the internal names are unchanged', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.build.mac.extendInfo.CFBundleDisplayName, 'Clevi');
  assert.equal(pkg.build.productName, 'Natively', 'productName drives the profile dir; keep it');
  assert.match(read('scripts/ad-hoc-sign.js'), /Set :CFBundleDisplayName 'Clevi'/);
  assert.match(read('electron/utils/disguiseAppName.ts'), /return BRAND_NAME;/);
});
