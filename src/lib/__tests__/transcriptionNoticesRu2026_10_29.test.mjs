// Transcription notices follow the app language (2026-10-29).
//
// "Transcription Stopped" and its messages went through t() with no RU row,
// and the notes window's status line never went through t() at all, so a
// Russian install read them in English. Apple Speech refusing the language
// (it has no Russian model) now says so instead of "check its key".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRANSCRIPTION_RU } from '../../i18n.transcription.ru.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('every overlay transcription notice has a Russian row', () => {
  const ui = read('src/components/NativelyInterface.tsx');
  const start = ui.indexOf('const appleSpeechLanguageRefused');
  const end = ui.indexOf('// Whether the vision chip will render', start);
  assert.ok(start !== -1 && end > start, 'banner block not found');
  const keys = [...ui.slice(start, end).matchAll(/\bt\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1]);
  assert.ok(keys.length >= 7, `found ${keys.length}`);
  for (const k of keys) assert.ok(TRANSCRIPTION_RU[k], `missing RU row: ${k}`);
});

test('the notes window translates its status line, and every line it can show has a row', () => {
  const notes = read('src/components/NotesWindow.tsx');
  assert.match(notes, /role="status">\{t\(problem\)\}<\/p>/);
  for (const line of [
    'Transcription stopped. Check your speech provider in Settings.',
    'Transcription is reconnecting…',
    'Natively can’t hear your microphone. Check Settings › Audio.',
    'Natively can’t hear the call. Check Settings › Audio.',
    'Audio is off because Ambient AI Chat is on. Turn it off in Settings › General.',
  ]) {
    assert.ok(notes.includes(`'${line}'`), `still shown: ${line}`);
    assert.ok(TRANSCRIPTION_RU[line], `missing RU row: ${line}`);
  }
});

test('Apple Speech refusing the language is not reported as a key problem', () => {
  const ui = read('src/components/NativelyInterface.tsx');
  assert.match(ui, /provider === 'apple-speech' && \/does not support language\/i\.test\(error\)/);
  assert.match(ui, /message: appleSpeechLanguageRefused\n\s*\? t\('Apple Speech does not support this language\./);
});

test('the RU dictionary spreads the rows', () => {
  const src = read('src/i18n.tsx');
  assert.match(src, /import \{ TRANSCRIPTION_RU \} from '\.\/i18n\.transcription\.ru';/);
  assert.match(src, /\.\.\.TRANSCRIPTION_RU,/);
});
