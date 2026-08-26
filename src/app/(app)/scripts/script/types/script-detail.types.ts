import type { scriptDetailRelayQuery as ScriptDetailQueryType } from '@/__generated__/scriptDetailRelayQuery.graphql';

/**
 * The loaded `script` payload of the script detail query — the shape every
 * script page (details, edit, run) works with once its query resolves. Derived
 * from the query artifact rather than hand-written, so a schema change surfaces
 * at the call sites instead of drifting silently.
 */
export type ScriptDetailData = NonNullable<ScriptDetailQueryType['response']['script']>;
