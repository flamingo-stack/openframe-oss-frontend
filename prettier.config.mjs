import shared from '@flamingo-stack/openframe-frontend-core/eslint-config/prettier';

/*
 * Formatting comes from the shared preset, which reproduces the outgoing Biome
 * formatter byte-for-byte (120 cols, single quotes, trailing commas, avoided
 * arrow parens) so that swapping engines is not also a restyling. It adds
 * Tailwind class sorting on top — that part is new.
 *
 * Nothing repo-specific is needed here; keep it that way.
 */
export default shared;
