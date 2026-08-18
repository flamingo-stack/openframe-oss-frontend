/**
 * Tell React this is an `act()` environment.
 *
 * Without it React both warns on every `act()` call and, more importantly,
 * keeps its counterpart check switched off — so a component test that updates
 * state OUTSIDE an `act()` wrap fails silently instead of being reported. Set
 * here rather than per-file so component tests added later inherit it.
 *
 * Cast rather than `declare global`: tsconfig pulls this root file into the app
 * program, so augmenting `globalThis` would make a test-only flag look like an
 * always-present global to shipping code.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
