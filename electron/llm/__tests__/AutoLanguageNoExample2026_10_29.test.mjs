// Auto response language names no example language (2026-10-29).
//
// The auto block said "If the user writes in Hindi, respond in Hindi. If in
// Spanish…", and llama3.2:3b (a local Ollama model) read the first example as
// the instruction: every English and Russian question was answered in Hindi.
// The block now says only "reply in the language of the latest message", and
// an explicit request for a language wins.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'LLMHelper.ts'), 'utf8');

function autoBlock() {
  const start = src.indexOf("if (!this.aiResponseLanguage || this.aiResponseLanguage === 'auto') {");
  const end = src.indexOf('[END LANGUAGE INSTRUCTION]', start);
  assert.ok(start !== -1 && end > start, 'auto language block not found');
  return src.slice(start, end);
}

test('the auto block names no example language', () => {
  const block = autoBlock();
  for (const lang of ['Hindi', 'Spanish', 'French', 'German']) assert.ok(!block.includes(lang), `mentions ${lang}`);
});

test('the auto block mirrors the latest message, and an asked-for language wins', () => {
  const block = autoBlock();
  assert.match(block, /Reply in the language the user's most recent message is written in\./);
  assert.match(block, /If the user asks for a language \("in English", "на русском"\), use that language\./);
  assert.match(block, /If the language is ambiguous, default to English\./);
});
