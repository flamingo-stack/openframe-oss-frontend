/**
 * While the ticket is read (a loading scope) its tags are not known, and every write sends the whole list: the
 * section takes no pick, so a ticket's tags are never replaced by one chosen before they loaded.
 */
import { LoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketTagsSection } from './ticket-tags-section';

interface DropdownProps {
  disabled?: boolean;
  onChange: (ids: string[]) => void;
  onCreate: (name: string) => void;
}

const mutate = vi.fn();
const createTag = vi.fn();
let dropdown: DropdownProps | null = null;

vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => ({
  ...(await importOriginal<object>()),
  TagSelectDropdown: (props: DropdownProps) => {
    dropdown = props;
    return null;
  },
}));
vi.mock('../hooks/use-ticket-tags', () => ({
  useTicketTags: () => ({ data: [{ id: 't1', key: 'printer' }], refetch: () => Promise.resolve() }),
}));
vi.mock('../hooks/use-ticket-detail-mutations', () => ({
  useSetTicketTags: () => ({ mutate, isPending: false }),
}));
vi.mock('../hooks/use-ticket-tag-delete', () => ({
  useTicketTagDelete: () => ({ requestDelete: vi.fn(), isDeleting: false, dialog: null }),
}));
vi.mock('@/app/components/shared/tags', () => ({
  useCreateTagMutation: () => ({ createTag, isInFlight: false }),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mutate.mockReset();
  createTag.mockReset();
  dropdown = null;
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
});

describe('TicketTagsSection', () => {
  it('takes no pick while the ticket loads', () => {
    act(() =>
      root.render(
        <LoadingScope>
          <TicketTagsSection ticketId="tk-1" tags={[]} />
        </LoadingScope>,
      ),
    );
    expect(dropdown?.disabled).toBe(true);

    act(() => dropdown?.onChange(['t1']));
    act(() => dropdown?.onCreate('new'));
    expect(mutate).not.toHaveBeenCalled();
    expect(createTag).not.toHaveBeenCalled();
  });

  it('writes the picked tags once the ticket is read', () => {
    act(() => root.render(<TicketTagsSection ticketId="tk-1" tags={[]} />));
    expect(dropdown?.disabled).toBe(false);

    act(() => dropdown?.onChange(['t1']));
    expect(mutate).toHaveBeenCalledWith(['t1']);
  });
});
