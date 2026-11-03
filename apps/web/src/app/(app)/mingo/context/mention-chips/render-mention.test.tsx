/**
 * `record://chat/<dialogId>` reaches the chat-reference chip with the chats glyph
 * (two overlapping bubbles) as its lead icon — the marker is not an entity, so
 * it has no picker entry to take an icon from, and the icon is pinned here
 * instead of in `MINGO_CONTEXT_ENTITY_TYPES`.
 */

import { ChatsIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatReferenceChip } from './chat-reference-chip';
import { MentionTag } from './mention-tag';
import { GraphqlMentionChip } from './relay-mention-chips';
import { renderMingoRecordChip } from './render-mention';

// The entity chips reach Relay (`graphql` tags need the compiler transform) and
// the picker's data components; none of them run for a chat reference.
vi.mock('react-relay', () => ({ graphql: () => ({}), useLazyLoadQuery: vi.fn() }));
vi.mock('./relay-mention-chips', () => ({ GraphqlMentionChip: vi.fn() }));
vi.mock('./rest-mention-chips', () => ({ RestMentionChip: vi.fn() }));
vi.mock('../context-sources', () => ({ MINGO_CONTEXT_ENTITY_TYPES: [] }));

describe('renderMingoRecordChip', () => {
  it('renders a chat record as the chat-reference chip led by the chats icon', () => {
    const element = renderMingoRecordChip({ type: 'chat', id: 'd-1' });

    expect(isValidElement(element)).toBe(true);
    if (!isValidElement<{ id: string; icon: unknown }>(element)) return;
    expect(element.type).toBe(ChatReferenceChip);
    expect(element.props.id).toBe('d-1');
    expect(isValidElement(element.props.icon)).toBe(true);
    if (!isValidElement(element.props.icon)) return;
    expect(element.props.icon.type).toBe(ChatsIcon);
  });

  it("leaves an unknown type to the lib's own chip", () => {
    expect(renderMingoRecordChip({ type: 'nothing', id: 'x' })).toBeNull();
  });

  // TODO(CU-17tkuw635xx): goes with the old mention token, which the lib writes as a link labelled with itself.
  describe('an old mention token', () => {
    const propsOf = (element: unknown) =>
      isValidElement<{ label?: string; fallbackLabel?: string }>(element) ? element : null;

    it('a vulnerability reads as its CVE id, never as the token', () => {
      const chip = propsOf(
        renderMingoRecordChip({ type: 'vulnerability', id: 'CVE-2024-1234', label: '@vulnerability:CVE-2024-1234' }),
      );
      expect(chip?.type).toBe(MentionTag);
      expect(chip?.props.label).toBe('CVE-2024-1234');
    });

    it('a record that resolves no name falls back to its id, never to the token', () => {
      const chip = propsOf(renderMingoRecordChip({ type: 'device', id: 'm1', label: '@device:m1' }));
      expect(chip?.type).toBe(GraphqlMentionChip);
      expect(chip?.props.fallbackLabel).toBeUndefined();
    });

    it('a real name stays the name', () => {
      const chip = propsOf(renderMingoRecordChip({ type: 'device', id: 'm1', label: 'MacBook' }));
      expect(chip?.props.fallbackLabel).toBe('MacBook');
    });
  });
});
