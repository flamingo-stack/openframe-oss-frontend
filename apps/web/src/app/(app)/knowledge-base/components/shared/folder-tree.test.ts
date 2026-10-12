/**
 * Pins what the folder pickers offer: the tree in the listing's order, and a
 * folder that is being moved or deleted never offered as its own destination —
 * neither itself nor anything under it.
 */

import { describe, expect, it, vi } from 'vitest';

// The module declares the tree's fragment beside the pure functions under test; the tag
// would throw at module scope on import. Nothing here reads the fragment.
vi.mock('react-relay', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  graphql: () => ({}),
}));

import { buildFolderTree, findFolderName, folderMenuItems } from './folder-tree';

const folder = (id: string, name: string, parentId: string | null = null) => ({ id, name, parentId });

describe('buildFolderTree', () => {
  it('nests folders under their parents', () => {
    const tree = buildFolderTree([folder('guides', 'Guides'), folder('setup', 'Setup', 'guides')]);
    expect(tree).toEqual([{ id: 'guides', name: 'Guides', children: [{ id: 'setup', name: 'Setup', children: [] }] }]);
  });

  it('orders a level the way the listing does: case ignored, digits by value', () => {
    const tree = buildFolderTree([
      folder('z', 'Zebra'),
      folder('f10', 'Folder 10'),
      folder('a', 'apple'),
      folder('f2', 'Folder 2'),
    ]);
    expect(tree.map(node => node.name)).toEqual(['apple', 'Folder 2', 'Folder 10', 'Zebra']);
  });

  it('leaves out a folder whose parent is not in the list', () => {
    expect(buildFolderTree([folder('orphan', 'Orphan', 'gone')])).toEqual([]);
  });
});

describe('findFolderName', () => {
  const tree = buildFolderTree([folder('guides', 'Guides'), folder('setup', 'Setup', 'guides')]);

  it('finds a folder at any depth', () => {
    expect(findFolderName(tree, 'setup')).toBe('Setup');
  });

  it('answers null for an id the tree does not hold', () => {
    expect(findFolderName(tree, 'gone')).toBeNull();
  });
});

describe('folderMenuItems', () => {
  const tree = buildFolderTree([
    folder('guides', 'Guides'),
    folder('setup', 'Setup', 'guides'),
    folder('notes', 'Notes'),
  ]);

  it('makes a leaf a plain item and a folder with subfolders a submenu that offers the folder itself first', () => {
    const onSelect = vi.fn();
    const [guides, notes] = folderMenuItems(tree, onSelect);

    expect(notes).toMatchObject({ id: 'notes', label: 'Notes' });
    expect(guides).toMatchObject({ id: 'guides', type: 'submenu' });
    expect(guides.submenu?.map(item => item.id)).toEqual(['guides__self', 'guides__sep', 'setup']);

    guides.submenu?.[0].onClick?.();
    expect(onSelect).toHaveBeenCalledWith({ id: 'guides', name: 'Guides' });
  });

  it('removes the excluded folder together with everything under it', () => {
    const items = folderMenuItems(tree, vi.fn(), 'guides');
    expect(items.map(item => item.id)).toEqual(['notes']);
  });

  it('turns a folder whose only subfolder is excluded back into a plain item', () => {
    const [guides] = folderMenuItems(tree, vi.fn(), 'setup');
    expect(guides.type).toBeUndefined();
    expect(guides.submenu).toBeUndefined();
  });
});
