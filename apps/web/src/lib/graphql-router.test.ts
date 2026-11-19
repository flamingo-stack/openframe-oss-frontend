import { afterEach, describe, expect, it } from 'vitest';
import { useFeatureFlagsStore } from '@/stores/feature-flags-store';
import { graphqlPath, ROUTER_GRAPHQL_PATH } from './graphql-router';

function setRouterFlag(enabled: boolean) {
  useFeatureFlagsStore.getState().setFlags([{ name: 'graphql-router', enabled }]);
}

describe('graphqlPath', () => {
  afterEach(() => useFeatureFlagsStore.getState().reset());

  it('keeps both subgraph paths while the flags have not answered', () => {
    expect(graphqlPath('/api/graphql')).toBe('/api/graphql');
    expect(graphqlPath('/chat/graphql')).toBe('/chat/graphql');
  });

  it('keeps both subgraph paths with the flag off', () => {
    setRouterFlag(false);
    expect(graphqlPath('/api/graphql')).toBe('/api/graphql');
    expect(graphqlPath('/chat/graphql')).toBe('/chat/graphql');
  });

  it('sends both subgraph paths to the router with the flag on', () => {
    setRouterFlag(true);
    expect(graphqlPath('/api/graphql')).toBe(ROUTER_GRAPHQL_PATH);
    expect(graphqlPath('/chat/graphql')).toBe(ROUTER_GRAPHQL_PATH);
  });

  it('leaves every other path alone with the flag on', () => {
    setRouterFlag(true);
    for (const path of ['/sas/graphql', '/api/me', '/api/graphql/x', '/chat/api/v1/dialogs']) {
      expect(graphqlPath(path)).toBe(path);
    }
  });
});
