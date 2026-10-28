// Settings stays Russian when the app language is Russian (2026-10-28).
//
// Switching to Русский left most of Settings in English: hundreds of t('…')
// sentences in SettingsOverlay and src/components/settings/** had no RU row, so
// t() fell back to the English source. src/i18n.settings.ru.ts now carries them.
// Every t('…') literal in those files must resolve in the RU dictionary, so a
// sentence added without a row fails here instead of quietly showing English.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SETTINGS_RU } from '../../i18n.settings.ru.ts';
import { PERMISSIONS_RU } from '../../i18n.permissions.ru.ts';
import { RU_GENERATED } from '../../i18n.ru.generated.ts';
import { RU_GENERATED2 } from '../../i18n.ru.generated2.ts';
import { ONBOARDING_RU } from '../../i18n.onboarding.ts';
import { DIRECT_ASSIST_RU } from '../../i18n.directAssist.ts';
import { CREDENTIAL_STORES_RU } from '../../i18n.credentialStores.ts';
import { TRIAL_NOTICE_RU } from '../../i18n.trial.ts';
import { ASSIST_RU } from '../../i18n.assist.ts';
import { AMBIENT_CHAT_RU } from '../../i18n.ambientChat.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// Decode a JS string literal body ('…' or "…") into the runtime string.
const decode = (body) => JSON.parse(`"${body.replace(/\\'/g, "'").replace(/(^|[^\\])"/g, '$1\\"')}"`);

// The hand-authored RU block in i18n.tsx: 'English': 'Русский' rows.
function handRows() {
  const src = read('src/i18n.tsx');
  const start = src.indexOf('const RU: Record<string, string> = {');
  const end = src.indexOf('\n};', start);
  assert.ok(start !== -1 && end > start, 'RU block not found in i18n.tsx');
  const keys = new Set();
  for (const m of src.slice(start, end).matchAll(/^\s*(['"])((?:\\.|(?!\1).)*)\1\s*:/gm)) keys.add(decode(m[2]));
  return keys;
}

const RU_KEYS = new Set([
  ...Object.keys(RU_GENERATED),
  ...Object.keys(RU_GENERATED2),
  ...Object.keys(ONBOARDING_RU),
  ...Object.keys(DIRECT_ASSIST_RU),
  ...Object.keys(CREDENTIAL_STORES_RU),
  ...Object.keys(TRIAL_NOTICE_RU),
  ...Object.keys(ASSIST_RU),
  ...Object.keys(AMBIENT_CHAT_RU),
  ...Object.keys(SETTINGS_RU),
  ...Object.keys(PERMISSIONS_RU),
  ...handRows(),
]);

function settingsFiles() {
  // Settings, and the permissions card and onboarding (translated 2026-10-28 too).
  const out = [
    'src/components/SettingsOverlay.tsx',
    'src/components/onboarding/PermissionsToaster.tsx',
    'src/components/onboarding/PermissionsOnboardingFull.tsx',
    'src/components/onboarding/BrowserExtensionToaster.tsx',
  ];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== '__tests__') walk(rel); }
      else if (e.name.endsWith('.tsx')) out.push(rel);
    }
  };
  walk('src/components/settings');
  return out;
}

test('every t() literal in Settings has a Russian row', () => {
  const missing = [];
  for (const file of settingsFiles()) {
    for (const m of read(file).matchAll(/\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*[,)]/g)) {
      const key = decode(m[2]);
      if (!RU_KEYS.has(key)) missing.push(`${file}: ${key}`);
    }
  }
  assert.deepEqual(missing, [], `untranslated Settings strings:\n${missing.join('\n')}`);
});

test('a Russian row keeps the slots of its English sentence', () => {
  const slots = (s) => (s.match(/\{\{?\w+\}?\}/g) || []).sort();
  for (const [en, ru] of Object.entries({ ...SETTINGS_RU, ...PERMISSIONS_RU })) {
    assert.ok(ru.trim().length > 0, `"${en}" is empty`);
    assert.deepEqual(slots(ru), slots(en), `"${en}"`);
  }
});

test('the RU dictionary spreads the Settings rows', () => {
  const src = read('src/i18n.tsx');
  assert.match(src, /import \{ SETTINGS_RU \} from '\.\/i18n\.settings\.ru';/);
  assert.match(src, /\.\.\.SETTINGS_RU,/);
  assert.match(src, /import \{ PERMISSIONS_RU \} from '\.\/i18n\.permissions\.ru';/);
  assert.match(src, /\.\.\.PERMISSIONS_RU,/);
});
