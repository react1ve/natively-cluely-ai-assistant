// A local build has no update feed, so the check reports "up to date" (2026-10-29).
//
// `package-app.js --dir` writes no Resources/app-update.yml, and electron-updater
// failed every check with ENOENT on it ("проверка версий выдает ошибку"). The
// publish feed is upstream's releases anyway, which would replace this build.
// Both the automatic and the manual check now look for the feed first.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const main = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'main.ts'), 'utf8');

test('the feed is the app-update.yml next to the app resources', () => {
  assert.match(main, /function hasUpdateFeed\(\): boolean \{\n\s*return fs\.existsSync\(path\.join\(process\.resourcesPath, 'app-update\.yml'\)\)\n\}/);
});

test('the automatic check is skipped without a feed', () => {
  assert.match(main, /\} else if \(!hasUpdateFeed\(\)\) \{\n\s*console\.log\("\[AutoUpdater\] No update feed in this build/);
});

test('a manual check without a feed reports up to date before electron-updater runs', () => {
  const start = main.indexOf('public async checkForUpdates(): Promise<void> {');
  const body = main.slice(start, main.indexOf('public async downloadUpdate', start));
  const noFeed = body.indexOf('} else if (!hasUpdateFeed()) {');
  const updater = body.indexOf('await autoUpdater.checkForUpdatesAndNotify()');
  assert.ok(noFeed !== -1 && updater > noFeed);
  assert.match(body.slice(noFeed, updater), /this\.broadcast\("update-not-available", \{ version: app\.getVersion\(\) \}\)/);
});
