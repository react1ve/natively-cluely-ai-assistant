// Modes opens nothing without the premium module, so nothing offers it (2026-10-28).
//
// ModesSettings falls back to a component that renders null when
// premium/src/ModesSettings.tsx is not in the build, yet the launcher's Modes
// button, its onboarding popover and the Settings links still opened the
// 820×600 dialog around it: a blank white card. App now hands onOpenModes to
// the launcher and Settings only when the module is there, and the launcher
// draws its Modes button only when it has the handler (Help and About already
// hide their link without it).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('the flag says whether the Modes manager is in the build', () => {
  assert.match(read('src/premium/index.tsx'), /export const PREMIUM_MODES_AVAILABLE = Object\.keys\(_modesSettings\)\.length > 0;/);
});

test('App passes onOpenModes only when Modes is available', () => {
  const app = read('src/App.tsx');
  assert.match(app, /import \{ PREMIUM_ADS_AVAILABLE, PREMIUM_MODES_AVAILABLE \} from '\.\/premium'/);
  const passes = [...app.matchAll(/onOpenModes=\{([^\n]*)\}\n/g)].map((m) => m[1]);
  assert.equal(passes.length, 2, 'the launcher and Settings');
  for (const p of passes) assert.match(p, /^PREMIUM_MODES_AVAILABLE \? .+ : undefined$/);
});

test('the launcher draws its Modes button only with a handler', () => {
  const launcher = read('src/components/Launcher.tsx');
  assert.match(launcher, /\{onOpenModes && \(\n\s*<div className="relative group\/modes-btn select-none">/);
});
