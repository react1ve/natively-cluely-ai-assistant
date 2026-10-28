// No card that sells a plan or the Natively API is ever raised (2026-10-28).
//
// The catalog keeps its policy (stageCatalogPolicy2026_09_26.test.mjs still
// pins who each card is for); App.tsx starts the orchestrator through
// withoutSalesCards(), whose sales stages never pass. Every other stage is
// handed over unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGES, QUIET_WINDOW_STAGE } from '../stageCatalog.ts';
import { DEFAULT_USER_STATE } from '../orchestrator.ts';
import { emptyLedger } from '../../cards/cardPolicy.mjs';
import { SALES_CARD_IDS, withoutSalesCards } from '../salesCards.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const NOW = Date.UTC(2026, 9, 28);

// A user every sales card would otherwise be shown to, one at a time.
const AUDIENCES = {
  plans: {},
  natively_api_new: { trialClaimed: true },
  natively_api_existing: { hasOwnAiKey: true },
  max_ultra: { hasNativelyKey: true, planTier: 'pro', nativelyQuotaPct: 95 },
  profile_ad: {},
  jd_ad: { hasProfile: true },
};

const ctx = (user) => ({
  startupCount: 5, totalUsageMs: 0, turnCount: 0, homepageMountedFor: 60_000,
  appInForeground: true, homepageCurrentlyMounted: true, meetingActive: false,
  completed: {}, skipped: new Set(), lastShownTimes: {}, now: NOW,
  userState: { ...DEFAULT_USER_STATE, cardLedger: emptyLedger(NOW), adsAvailable: true, ...user },
});

test('the list names exactly the sales cards, and each one is in the catalog', () => {
  assert.deepEqual([...SALES_CARD_IDS].sort(), Object.keys(AUDIENCES).sort());
  const ids = new Set(STAGES.map((s) => s.id));
  for (const id of SALES_CARD_IDS) assert.ok(ids.has(id), `${id} is a catalog stage`);
});

test('a sales card that its audience would see never passes once switched off', () => {
  const before = Object.fromEntries(STAGES.map((s) => [s.id, s]));
  const after = Object.fromEntries(withoutSalesCards(STAGES).map((s) => [s.id, s]));
  for (const [id, user] of Object.entries(AUDIENCES)) {
    assert.equal(before[id].customPredicate(ctx(user)), true, `${id}: the audience is right`);
    assert.equal(after[id].customPredicate(ctx(user)), false, `${id}: switched off`);
  }
});

test('every other stage is handed over unchanged, and the input is not mutated', () => {
  const input = [...STAGES, QUIET_WINDOW_STAGE];
  const predicates = input.map((s) => s.customPredicate);
  const out = withoutSalesCards(input);
  assert.equal(out.length, input.length);
  out.forEach((stage, i) => {
    assert.equal(input[i].customPredicate, predicates[i], `${input[i].id}: input untouched`);
    if (SALES_CARD_IDS.includes(stage.id)) assert.notEqual(stage, input[i]);
    else assert.equal(stage, input[i], `${stage.id}: same object`);
  });
});

test('App starts the orchestrator without the sales cards', () => {
  const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /orch\.start\(withoutSalesCards\(\[\.\.\.STAGES, QUIET_WINDOW_STAGE\]\)\)/);
});
