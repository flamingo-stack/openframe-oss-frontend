/**
 * `@chat:<dialogId>` reaches the chat-reference chip with the chats glyph
 * (two overlapping bubbles) as its lead icon — the marker is not an entity, so
 * it has no picker entry to take an icon from, and the icon is pinned here
 * instead of in `MINGO_CONTEXT_ENTITY_TYPES`.
 */

import { ChatsIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { isValidElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatReferenceChip } from './chat-reference-chip';
import { renderMingoMention } from './render-mention';

// The entity chips reach Relay (`graphql` tags need the compiler transform) and
// the picker's data components; none of them run for a chat reference.
vi.mock('react-relay', () => ({ graphql: () => ({}), useLazyLoadQuery: vi.fn() }));
vi.mock('./relay-mention-chips', () => ({ GraphqlMentionChip: vi.fn() }));
vi.mock('./rest-mention-chips', () => ({ RestMentionChip: vi.fn() }));
vi.mock('../context-sources', () => ({ MINGO_CONTEXT_ENTITY_TYPES: [] }));

describe('renderMingoMention', () => {
  it('renders @chat as the chat-reference chip led by the chats icon', () => {
    const element = renderMingoMention({ marker: 'chat', id: 'd-1' });

    expect(isValidElement(element)).toBe(true);
    if (!isValidElement<{ id: string; icon: unknown }>(element)) return;
    expect(element.type).toBe(ChatReferenceChip);
    expect(element.props.id).toBe('d-1');
    expect(isValidElement(element.props.icon)).toBe(true);
    if (!isValidElement(element.props.icon)) return;
    expect(element.props.icon.type).toBe(ChatsIcon);
  });

  it('leaves an unknown marker to the lib as bare text', () => {
    expect(renderMingoMention({ marker: 'nothing', id: 'x' })).toBeNull();
  });
});
