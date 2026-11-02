export type DevicesViewMode = 'table' | 'grid';

/**
 * The shape the devices list draws for its `?viewMode` param on a page `contentMdUp` wide (`useContentMdUp`).
 *
 * The grid is for a page at least the content-md step wide: where the lib's page header draws the table/grid
 * switch (`content-md:`, the page's own width, a 768px tablet's included). Narrower, the page is the table, so a
 * phone always gets a usable list; the param is left as it is, and the grid comes back when the page widens.
 * Derived, never written back: the width is the window's until the content area is measured, and a write on
 * that guess reset a tablet's grid to the table the moment it was picked.
 */
export function devicesViewMode(param: string | null, contentMdUp: boolean | undefined): DevicesViewMode {
  if (param !== 'grid') return 'table';
  return contentMdUp === false ? 'table' : 'grid';
}
