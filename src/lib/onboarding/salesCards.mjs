// src/lib/onboarding/salesCards.mjs
//
// Cards that sell a plan or the Natively API. This build never raises them:
// the stages stay in the catalog (their ids, order and persisted ledger
// entries are untouched), but their predicate never passes, so the
// orchestrator skips them like any card whose audience does not match.
//
// Not sales: permissions, browser_extension, review_prompt, support (a
// donation ask, not a subscription), and the gate-only markers.

export const SALES_CARD_IDS = Object.freeze([
  'plans',
  'natively_api_new',
  'natively_api_existing',
  'max_ultra',
  'profile_ad',
  'jd_ad',
]);

const SALES = new Set(SALES_CARD_IDS);

const never = () => false;

/** The stages with every sales card switched off. Pure: the input is not changed. */
export function withoutSalesCards(stages) {
  return stages.map((stage) => (SALES.has(stage.id) ? { ...stage, customPredicate: never } : stage));
}
