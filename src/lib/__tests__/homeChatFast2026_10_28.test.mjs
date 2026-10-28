// Home chat answers fast, and a long answer is not wiped (2026-10-28).
//
// - The question's embedding ran the full retry ladder (up to ~13 s) before the
//   model was asked; it now gets the warm-query budget.
// - The overlay's 20 s ceiling covered the whole answer (the invoke resolves at
//   the end of the stream), so a long answer was replaced with "This is taking
//   longer than expected". It now only applies until the first token.
// - The prompt leads with the answer, and no canned "didn't come up in your
//   meetings" line sits in the excerpts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('the Home question gets the warm-query embedding budget', () => {
  const rag = read('electron/rag/RAGManager.ts');
  assert.match(rag, /const GLOBAL_QUERY_EMBED_BUDGET_MS = 1_500;/);
  assert.match(rag, /retrieveGlobal\(query, \{[\s\S]{0,120}queryEmbedRetryBudgetMs: GLOBAL_QUERY_EMBED_BUDGET_MS,/);
  assert.doesNotMatch(rag, /import \{[^}]*NO_GLOBAL_CONTEXT_FALLBACK[^}]*\} from '\.\/prompts'/);
  assert.doesNotMatch(rag, /\$\{NO_GLOBAL_CONTEXT_FALLBACK\}/);
});

test('the overlay times out only while no token has arrived', () => {
  const ui = read('src/components/GlobalChatOverlay.tsx');
  assert.match(ui, /function withTimeout<T>\([^)]*started: \(\) => boolean = \(\) => false\)/);
  assert.match(ui, /if \(started\(\)\) return;/);
  assert.match(ui, /withTimeout\(call, RAG_QUERY_CLIENT_TIMEOUT_MS, 'ragQueryGlobal', \(\) => firstTokenSeen\)/);
  assert.match(ui, /withTimeout\(fallbackCall, RAG_QUERY_CLIENT_TIMEOUT_MS, 'streamGeminiChat', \(\) => firstTokenSeen\)/);
  assert.equal((ui.match(/firstTokenSeen = true;/g) || []).length, 2, 'both paths mark their first token');
});

test('the Home prompt leads with the answer', () => {
  const prompts = read('electron/rag/prompts.ts');
  const start = prompts.indexOf('export const GLOBAL_RAG_SYSTEM_PROMPT');
  const body = prompts.slice(start, prompts.indexOf('`;', start));
  assert.match(body, /Lead with the direct answer in the first sentence/);
});
