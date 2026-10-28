// A local Active Model survives opening AI Providers (2026-10-28).
//
// The "stale default" effect ran once credentials loaded, before Ollama's model
// list arrived (checkOllama is not awaited) or LiteLLM / 9Router loaded theirs.
// The saved `ollama-…` id was missing from the options, so the effect wrote the
// first cloud model over it, on disk, every time the panel opened; the next
// launch restored that one. Main's modelAvailable() already keeps these ids.
// The effect now returns early for them, and the picker keeps showing the
// saved pick while the list loads.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'AIProvidersSettings.tsx'),
  'utf8',
);

function staleDefaultEffect() {
  const start = src.indexOf('// Keep the persisted default model from pointing at a provider the user just');
  const end = src.indexOf('window.electronAPI?.setDefaultModel?.(next)', start);
  assert.ok(start !== -1 && end > start, 'stale-default effect not found');
  return src.slice(start, end);
}

test('local and proxy picks return before the options are compared', () => {
  const body = staleDefaultEffect();
  const firstCompare = body.indexOf('const opts = buildAvailableModelOptions();');
  assert.ok(firstCompare !== -1);
  for (const guard of [
    "if (defaultModel.startsWith('ollama-') && isProviderEnabled('ollama')) return;",
    "if (defaultModel.startsWith('litellm/') && hasStoredKey.litellm && isProviderEnabled('litellm')) return;",
    "if (defaultModel.startsWith('ninerouter/') && hasStoredKey.ninerouter && isProviderEnabled('ninerouter')) return;",
  ]) {
    const at = body.indexOf(guard);
    assert.ok(at !== -1, `missing: ${guard}`);
    assert.ok(at < firstCompare, `runs before the comparison: ${guard}`);
  }
});

test('the Active Model picker keeps the saved local pick while its list loads', () => {
  assert.match(src, /const buildActiveModelOptions = \(\) => \{/);
  assert.match(src, /value=\{defaultModel\}\n\s*options=\{buildActiveModelOptions\(\)\}/);
});
