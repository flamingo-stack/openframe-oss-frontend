import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createdEntityOf, noteMingoToolExecuted, useMingoCreatedEntitiesStore } from './mingo-created-entities-store';

const invalidateQueries = vi.fn();
vi.mock('@/lib/query-client', () => ({ getQueryClient: () => ({ invalidateQueries }) }));

const executed = (toolFunction: string, success = true) => ({ type: 'EXECUTED_TOOL', toolFunction, success });

/**
 * Mingo's creates happen server-side, so the list behind the chat learns about
 * them only from the stream. These pin which chunk refreshes which list, and
 * that every other list is left alone.
 */
describe('mingo created entities', () => {
  beforeEach(() => {
    invalidateQueries.mockClear();
    useMingoCreatedEntitiesStore.setState({ epoch: { script: 0, scriptSchedule: 0, knowledgeBase: 0 } });
  });

  it('maps each create tool to the list it adds a row to', () => {
    expect(createdEntityOf(executed('createScriptV2'))).toBe('script');
    expect(createdEntityOf(executed('createScript'))).toBe('script');
    expect(createdEntityOf(executed('createScriptSchedule'))).toBe('scriptSchedule');
    expect(createdEntityOf(executed('createPolicy'))).toBe('policy');
    expect(createdEntityOf(executed('createTicket'))).toBe('ticket');
    expect(createdEntityOf(executed('createKnowledgeBaseArticle'))).toBe('knowledgeBase');
    expect(createdEntityOf(executed('createKnowledgeBaseFolder'))).toBe('knowledgeBase');
  });

  it('ignores a failed create, a tool still running and any other tool', () => {
    expect(createdEntityOf(executed('createScriptV2', false))).toBeNull();
    expect(createdEntityOf({ type: 'EXECUTING_TOOL', toolFunction: 'createScriptV2' })).toBeNull();
    expect(createdEntityOf(executed('runCommandV2'))).toBeNull();
    expect(createdEntityOf(executed('updateScriptV2'))).toBeNull();
    expect(createdEntityOf({ type: 'TEXT' })).toBeNull();
  });

  it('bumps only the created Relay list', () => {
    noteMingoToolExecuted(executed('createKnowledgeBaseArticle'));

    expect(useMingoCreatedEntitiesStore.getState().epoch).toEqual({ script: 0, scriptSchedule: 0, knowledgeBase: 1 });
    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it('invalidates only the policy list for a policy', () => {
    noteMingoToolExecuted(executed('createPolicy'));

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['policies', 'list'] });
    expect(useMingoCreatedEntitiesStore.getState().epoch).toEqual({ script: 0, scriptSchedule: 0, knowledgeBase: 0 });
  });

  it('invalidates the ticket table and board columns for a ticket', () => {
    noteMingoToolExecuted(executed('createTicket'));

    expect(invalidateQueries.mock.calls).toEqual([
      [{ queryKey: ['dialogs', 'list'] }],
      [{ queryKey: ['dialogs', 'boardColumn'] }],
    ]);
  });

  it('refreshes nothing for a chunk that created nothing', () => {
    noteMingoToolExecuted(executed('createScriptV2', false));
    noteMingoToolExecuted({ type: 'TEXT' });

    expect(invalidateQueries).not.toHaveBeenCalled();
    expect(useMingoCreatedEntitiesStore.getState().epoch).toEqual({ script: 0, scriptSchedule: 0, knowledgeBase: 0 });
  });
});
