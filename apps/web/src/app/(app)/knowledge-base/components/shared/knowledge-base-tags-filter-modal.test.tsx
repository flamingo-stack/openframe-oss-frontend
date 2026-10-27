/**
 * Pins the tag filter modal with nothing to offer: no tags draws the modal's
 * empty state, worded for whose articles were asked, instead of a blank body
 * between the title and Reset / Apply.
 */

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SelectableTag } from '@/app/components/shared';
import { customerArticlesTarget } from '../assigned-articles/assigned-articles-target';

const tagsSpy = vi.hoisted(() => ({ tags: [] as SelectableTag[] }));

// The shared barrel and the real hook carry graphql tags, which need the Relay babel plugin vitest does not run.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
}));
vi.mock('./use-knowledge-base-tags', () => ({ useKnowledgeBaseTags: () => tagsSpy.tags }));

import { KnowledgeBaseTagsFilterModal } from './knowledge-base-tags-filter-modal';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  tagsSpy.tags = [];
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(scope: { parentId?: string | null; archived?: boolean; assigned?: boolean } = {}) {
  act(() => {
    root.render(
      <KnowledgeBaseTagsFilterModal
        isOpen
        onClose={vi.fn()}
        parentId={scope.parentId ?? null}
        archived={scope.archived ?? false}
        assignedTo={scope.assigned ? customerArticlesTarget('a805b7f9-283d-4ad5-a10e-22974eb737c9') : null}
        selectedIds={[]}
        onApply={vi.fn()}
      />,
    );
  });
  return document.body.textContent ?? '';
}

describe('KnowledgeBaseTagsFilterModal', () => {
  it('says the assigned articles have no tags instead of drawing an empty body', () => {
    const text = render({ assigned: true });
    expect(text).toContain('No tags to filter by');
    expect(text).toContain('No assigned article has tags.');
  });

  it.each([
    [{ archived: true }, 'No archived article has tags.'],
    [{ parentId: 'folder-1' }, 'No article in this folder has tags.'],
    [{}, 'No article in the knowledge base has tags.'],
  ])('words the empty state for the list it filters (%o)', (scope, description) => {
    expect(render(scope)).toContain(description);
  });

  it('lists the tags, without the empty state, when there are some', () => {
    tagsSpy.tags = [{ id: 'tag-1', key: 'backup' }];
    const text = render({ assigned: true });
    expect(text).toContain('backup');
    expect(text).not.toContain('No tags to filter by');
  });
});
