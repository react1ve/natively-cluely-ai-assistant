// Undetectable mode: the windows can always be brought back (2026-10-29).
//
// A launch with Undetectable already on hid the Dock tile before any window
// existed, so the windows created afterwards stayed hideable. After a Hide
// they vanished, ⌘B toggled flags that still read "shown", and with no Dock
// tile or tray nothing could unhide the app. macOS only; Windows is untouched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const main = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'main.ts'), 'utf8');
const body = (sig, next) => {
  const start = main.indexOf(sig);
  assert.ok(start !== -1, `${sig} not found`);
  return main.slice(start, main.indexOf(next, start));
};

test('a persisted-ON launch hides the Dock tile again once the windows exist (darwin only)', () => {
  const fn = body('public applyInitialUndetectableState(): void {', 'public reassertUndetectableStealth(');
  const hide = fn.indexOf("if (process.platform === 'darwin' && this.isUndetectable) {\n      try { app.dock?.hide(); }");
  assert.ok(hide !== -1);
  assert.ok(hide < fn.indexOf('this.reassertUndetectableStealth(DOCK_ENFORCE_STARTUP_MAX_ATTEMPTS);'));
});

test('⌘B unhides a hidden app before toggling anything (darwin only)', () => {
  const reveal = body('private revealHiddenApp(): boolean {', 'public toggleMainWindow(');
  assert.match(reveal, /if \(process\.platform !== 'darwin' \|\| !app\.isHidden\(\)\) return false;\n\s*app\.show\(\);\n\s*this\.reassertUndetectableStealth\(\);\n\s*return true;/);
  const fn = body('public toggleMainWindow(onCurrentDisplay = false): void {', 'public setWindowDimensions(');
  const at = fn.indexOf('if (this.revealHiddenApp()) return;');
  assert.ok(at !== -1 && at < fn.indexOf('const mode = this.windowHelper.getCurrentWindowMode();'));
});
