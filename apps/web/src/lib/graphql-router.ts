import { featureFlags } from './feature-flags';

/** openframe-api's GraphQL: Relay and the legacy raw-POST calls. */
export const API_GRAPHQL_PATH = '/api/graphql';

/**
 * The federation router (Cosmo) on the tenant gateway: one supergraph of openframe-api and the
 * ai-agent, which sends each subgraph call back through the gateway on that subgraph's own path.
 * Introspection is off there, so `npm run fetch-schema` keeps reading `/api/graphql`.
 */
export const ROUTER_GRAPHQL_PATH = '/api/router/graphql';

/** The two subgraphs as call sites name them: the router serves both. */
const SUBGRAPH_PATHS: ReadonlySet<string> = new Set([API_GRAPHQL_PATH, '/chat/graphql']);

/**
 * Where a GraphQL request goes. Call sites keep naming the subgraph they mean; with `graphql-router`
 * on, both go to the router. Read per request rather than once: the flags answer after the first
 * requests are out, and until then the subgraphs answer as before.
 */
export function graphqlPath(path: string): string {
  return SUBGRAPH_PATHS.has(path) && featureFlags.graphqlRouter.enabled() ? ROUTER_GRAPHQL_PATH : path;
}
