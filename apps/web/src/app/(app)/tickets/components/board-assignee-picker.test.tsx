/**
 * The assign picker in a board card's slot is the card's only assignee avatar, so it draws the assignee's own
 * picture from the URL the board resolved, not just their initials.
 */

import type { BoardTicket } from '@flamingo-stack/openframe-frontend-core/components/features';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardAssigneePicker } from './board-assignee-picker';

vi.mock('../hooks/use-assign-ticket', () => ({ useAssignTicket: () => ({ isPending: false, mutate: vi.fn() }) }));
vi.mock('../hooks/use-assignee-options', () => ({
  useAssigneeOptions: () => ({ options: [], isLoading: false, onSearchChange: vi.fn() }),
}));

const AVATAR_URL = 'https://tenant.test/api/images/user/u1?v=h1';

const TICKET: BoardTicket = {
  id: 't-1',
  title: 'Printer down',
  ticketNumber: '1',
  status: 's-tech',
  assignees: [{ id: 'u1', name: 'Ann Lee', initials: 'AL', avatarUrl: AVATAR_URL }],
};

const imageByAltText = (alt: string) => [...document.images].find(image => image.alt === alt);

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('BoardAssigneePicker', () => {
  it("draws the assignee's picture from their avatar URL", () => {
    act(() => root.render(<BoardAssigneePicker ticket={TICKET} />));

    expect(imageByAltText('Ann Lee')?.getAttribute('src')).toBe(AVATAR_URL);
  });
});
