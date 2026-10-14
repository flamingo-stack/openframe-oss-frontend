/**
 * Pins the Assign Article modal: every picked article goes out as its own
 * `assignItem` against the page's target, an already assigned one is answered
 * like any other (the server returns the existing assignment), and a partial
 * failure still refreshes the tab but keeps the modal open with an error.
 */

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { customerArticlesTarget, deviceArticlesTarget } from './assigned-articles-target';

interface CommitConfig {
  variables: Record<string, unknown>;
  onCompleted: (response: unknown, errors?: readonly Error[] | null) => void;
  onError: (error: Error) => void;
}

const spies = vi.hoisted(() => ({
  toast: vi.fn<(options: Record<string, unknown>) => void>(),
  commit: vi.fn<(config: CommitConfig) => void>(),
}));

// The real module carries graphql tags, which need the Relay babel plugin vitest does not run.
vi.mock('react-relay', () => ({ graphql: () => ({}), useMutation: () => [spies.commit, false] }));

vi.mock('@/components/assignments', () => ({
  useAssignmentSearch: () => ({
    options: [
      { value: 'article-1', label: 'Storage Space Management' },
      { value: 'article-2', label: 'DNS Configuration Troubleshooting' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@flamingo-stack/openframe-frontend-core/hooks', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useToast: () => ({ toast: spies.toast, dismiss: vi.fn() }),
}));

// The picker opens on pointer events jsdom does not dispatch; a flat stand-in
// renders every option as a button that adds it to the selection.
vi.mock('@flamingo-stack/openframe-frontend-core/components/ui', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Autocomplete: ({
    options,
    value,
    onChange,
    placeholder,
  }: {
    options: { value: string; label: string }[];
    value: string[];
    onChange: (next: string[]) => void;
    placeholder: string;
  }) => (
    <div data-placeholder={placeholder}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          data-option={option.value}
          onClick={() => onChange([...value, option.value])}
        >
          {option.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/app/components/shared/simple-modal', () => ({
  SimpleModal: ({ isOpen, children, footer }: { isOpen: boolean; children: ReactNode; footer: ReactNode }) =>
    isOpen ? (
      <div>
        {children}
        {footer}
      </div>
    ) : null,
}));

import { AssignArticleModal } from './assign-article-modal';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  spies.toast.mockReset();
  spies.commit.mockReset();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(target = customerArticlesTarget('a805b7f9-283d-4ad5-a10e-22974eb737c9')) {
  const onClose = vi.fn();
  const onAssigned = vi.fn();
  act(() => {
    root.render(<AssignArticleModal target={target} isOpen onClose={onClose} onAssigned={onAssigned} />);
  });
  return { onClose, onAssigned };
}

function click(element: Element | null) {
  if (!element) throw new Error('element not found');
  act(() => (element as HTMLElement).click());
}

const assignButton = () => [...container.querySelectorAll('button')].find(button => button.textContent === 'Assign');

describe('AssignArticleModal', () => {
  it('sends one assignItem per picked article, against the page target', async () => {
    spies.commit.mockImplementation(config => config.onCompleted({ assignItem: { id: 'a' } }, null));
    const target = deviceArticlesTarget('machine-1');
    const { onClose, onAssigned } = render(target);

    click(container.querySelector('[data-option="article-1"]'));
    click(container.querySelector('[data-option="article-2"]'));
    await act(async () => assignButton()?.click());

    expect(spies.commit.mock.calls.map(([config]) => config.variables)).toEqual([
      { itemId: 'article-1', itemType: 'KNOWLEDGE_ARTICLE', targetType: 'DEVICE', targetId: target.targetId },
      { itemId: 'article-2', itemType: 'KNOWLEDGE_ARTICLE', targetType: 'DEVICE', targetId: target.targetId },
    ]);
    expect(onAssigned).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(spies.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'success' }));
  });

  it('keeps Assign disabled and the empty placeholder until an article is picked', () => {
    render();
    expect(assignButton()?.disabled).toBe(true);
    expect(container.querySelector('[data-placeholder]')?.getAttribute('data-placeholder')).toBe('Select Articles');

    click(container.querySelector('[data-option="article-1"]'));
    expect(assignButton()?.disabled).toBe(false);
    expect(container.querySelector('[data-placeholder]')?.getAttribute('data-placeholder')).toBe('Add More...');
  });

  it('on a partial failure refreshes the tab, stays open and reports the error', async () => {
    spies.commit.mockImplementation(config =>
      config.variables.itemId === 'article-2'
        ? config.onError(new Error('Knowledge base item not found'))
        : config.onCompleted({ assignItem: { id: 'a' } }, null),
    );
    const { onClose, onAssigned } = render();

    click(container.querySelector('[data-option="article-1"]'));
    click(container.querySelector('[data-option="article-2"]'));
    await act(async () => assignButton()?.click());

    expect(onAssigned).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    expect(spies.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Some articles were not assigned', variant: 'destructive' }),
    );
  });

  it('does not refresh the tab when nothing was assigned', async () => {
    spies.commit.mockImplementation(config => config.onError(new Error('boom')));
    const { onClose, onAssigned } = render();

    click(container.querySelector('[data-option="article-1"]'));
    await act(async () => assignButton()?.click());

    expect(onAssigned).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(spies.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Assign failed' }));
  });
});
