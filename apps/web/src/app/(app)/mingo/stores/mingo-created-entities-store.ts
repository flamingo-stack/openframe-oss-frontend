'use client';

import { useDeferredValue } from 'react';
import { create } from 'zustand';
import { getQueryClient } from '@/lib/query-client';
import { policiesQueryKeys } from '../../monitoring/hooks/use-policies';
import { MESSAGE_TYPE } from '../../tickets/constants';
import { dialogsQueryKeys } from '../../tickets/utils/query-keys';

/** The lists a Mingo create tool can add a row to. */
export type MingoCreatedEntity = 'script' | 'scriptSchedule' | 'policy' | 'ticket' | 'knowledgeBase';

/** The Relay lists, refreshed through a `fetchKey` (see `useMingoCreatedEpoch`). */
type RelayListEntity = Extract<MingoCreatedEntity, 'script' | 'scriptSchedule' | 'knowledgeBase'>;

/**
 * Mingo's create tools by the name the ai-agent publishes as `toolFunction`,
 * mapped to the list each one adds a row to. The knowledge base list shows
 * folders as well as articles, so a new folder refreshes it too. `createScript`
 * is the pre-V2 name, still registered on the server.
 */
const CREATE_TOOL_ENTITY: Readonly<Record<string, MingoCreatedEntity>> = {
  createScriptV2: 'script',
  createScript: 'script',
  createScriptSchedule: 'scriptSchedule',
  createPolicy: 'policy',
  createTicket: 'ticket',
  createKnowledgeBaseArticle: 'knowledgeBase',
  createKnowledgeBaseFolder: 'knowledgeBase',
};

/** What of a stream chunk tells whether a tool call created something. */
interface ToolChunk {
  type?: string;
  toolFunction?: string;
  success?: boolean;
}

/** The list a finished tool call added a row to, or null when it added none. */
export function createdEntityOf(chunk: ToolChunk): MingoCreatedEntity | null {
  if (chunk.type !== MESSAGE_TYPE.EXECUTED_TOOL || chunk.success !== true || !chunk.toolFunction) return null;
  return CREATE_TOOL_ENTITY[chunk.toolFunction] ?? null;
}

interface MingoCreatedEntitiesStore {
  /** Bumped once per entity Mingo created; a Relay list passes its own as `fetchKey`. */
  epoch: Record<RelayListEntity, number>;
  bump: (entity: RelayListEntity) => void;
}

/**
 * Mingo creates entities server-side, out of reach of the pages' own mutations,
 * so a list behind the chat would keep its old rows until a reload.
 *
 * A mounted Relay query cannot be refetched from outside it (the reasoning is on
 * `bumpDeviceEpoch`): only a new `fetchKey` makes it fetch again, so each Relay
 * list reads its own counter from here. A react-query list is invalidated by key
 * instead. Either way only the created entity's list refreshes, and only when it
 * is on screen.
 */
export const useMingoCreatedEntitiesStore = create<MingoCreatedEntitiesStore>()(set => ({
  epoch: { script: 0, scriptSchedule: 0, knowledgeBase: 0 },
  bump: entity => set(state => ({ epoch: { ...state.epoch, [entity]: state.epoch[entity] + 1 } })),
}));

function refreshList(entity: MingoCreatedEntity): void {
  switch (entity) {
    case 'policy':
      void getQueryClient().invalidateQueries({ queryKey: policiesQueryKeys.lists() });
      return;
    case 'ticket': {
      // The table and the board columns; ticket details and statistics are untouched.
      const queryClient = getQueryClient();
      void queryClient.invalidateQueries({ queryKey: dialogsQueryKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: dialogsQueryKeys.boardColumns() });
      return;
    }
    default:
      useMingoCreatedEntitiesStore.getState().bump(entity);
  }
}

/** Note a stream chunk; refreshes a list only when the chunk is a successful create. */
export function noteMingoToolExecuted(chunk: ToolChunk): void {
  const entity = createdEntityOf(chunk);
  if (entity) refreshList(entity);
}

/**
 * The counter a Relay list adds to its `fetchKey`, so a create by Mingo refetches
 * it. DEFERRED like `useDeviceEpoch`: a new `fetchKey` suspends, and deferred the
 * list keeps its rows on screen until the new ones arrive instead of dropping to
 * its skeleton.
 */
export function useMingoCreatedEpoch(entity: RelayListEntity): number {
  return useDeferredValue(useMingoCreatedEntitiesStore(state => state.epoch[entity]));
}
