/**
 * Free AI tokens a month, by whether devices are on a committed package or on
 * metered pay-as-you-go.
 *
 * HARDCODED, pending a field that states it. The backend computes the live
 * figure per period and serves it as `usage.aiTokensFree` (5M on a trial, 10M on
 * pay as you go, 25M with a device package) — but two places have to name a
 * grant the tenant is NOT on yet: the paywall, previewing the plan being bought,
 * and the Updated Plan column, describing the plan a scheduled change moves to.
 * Neither has a field to read, so the rule lives here, in one place, rather than
 * as a number typed into each.
 *
 * Replace both entries with the catalog figure when it exists. The trial's 5M is
 * deliberately absent: nothing previews a trial.
 */
const FREE_TOKENS_COMMITTED = 25_000_000;
const FREE_TOKENS_PAYG = 10_000_000;

/** @param committed A device package is (or will be) in force, rather than metered billing. */
export function freeTokensForPlan(committed: boolean): number {
  return committed ? FREE_TOKENS_COMMITTED : FREE_TOKENS_PAYG;
}
