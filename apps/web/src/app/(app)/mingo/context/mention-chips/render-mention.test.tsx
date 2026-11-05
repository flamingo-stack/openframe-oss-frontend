/**
 * `record://chat/<dialogId>` reaches the chat-reference chip, and an inline chip draws no icon.
 */

import { RecordChip } from '@flamingo-stack/openframe-frontend-core/components/chat';
import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatReferenceChip } from './chat-reference-chip';
import { GraphqlMentionChip } from './relay-mention-chips';
import { renderMingoRecordChip } from './render-mention';

// The entity chips reach Relay (`graphql` tags need the compiler transform) and
// the picker's data components; none of them run for a chat reference.
vi.mock('react-relay', () => ({ graphql: () => ({}), useLazyLoadQuery: vi.fn() }));
vi.mock('./relay-mention-chips', () => ({ GraphqlMentionChip: vi.fn() }));
vi.mock('./rest-mention-chips', () => ({ RestMentionChip: vi.fn() }));
vi.mock('../context-sources', () => ({ MINGO_CONTEXT_ENTITY_TYPES: [] }));

describe('renderMingoRecordChip', () => {
  it('renders a chat record as the chat-reference chip, with no icon', () => {
    const element = renderMingoRecordChip({ type: 'chat', id: 'd-1' });

    expect(isValidElement(element)).toBe(true);
    if (!isValidElement<{ id: string; icon?: unknown }>(element)) return;
    expect(element.type).toBe(ChatReferenceChip);
    expect(element.props.id).toBe('d-1');
    expect(element.props.icon).toBeUndefined();
  });

  it("leaves an unknown type to the lib's own chip", () => {
    expect(renderMingoRecordChip({ type: 'nothing', id: 'x' })).toBeNull();
  });

  const propsOf = (element: unknown) =>
    isValidElement<{ label?: string; fallbackLabel?: string; href?: string | null }>(element) ? element : null;

  it('draws a vulnerability as its CVE id, linked to its page, with no fetch', () => {
    const chip = propsOf(renderMingoRecordChip({ type: 'vulnerability', id: 'CVE-2024-1234' }));
    expect(chip?.type).toBe(RecordChip);
    expect(chip?.props.label).toBe('CVE-2024-1234');
    expect(chip?.props.href).toContain('CVE-2024-1234');
  });

  it("hands a record's known name to its chip as the fallback", () => {
    const chip = propsOf(renderMingoRecordChip({ type: 'device', id: 'm1', label: 'MacBook' }));
    expect(chip?.type).toBe(GraphqlMentionChip);
    expect(chip?.props.fallbackLabel).toBe('MacBook');
  });

  it('reads every script id through Relay, whatever its shape', () => {
    for (const id of ['507f1f77bcf86cd799439011', '42']) {
      expect(propsOf(renderMingoRecordChip({ type: 'script', id }))?.type).toBe(GraphqlMentionChip);
    }
  });
});
