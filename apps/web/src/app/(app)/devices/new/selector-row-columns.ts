/**
 * Desktop columns of the New Device selector row (mockups 504-46017/46069/46131: all
 * selectors in one row from `content-lg`).
 *
 * - Select Platform is `auto`: the Windows + macOS tabs never shrink.
 * - Remote Access Permission takes 1.5 shares and never less than 15rem: its label (233px at
 *   desktop size) stays on one line, so its dropdown lines up with the others, and its value
 *   (`Customer Default (<mode>)`) has the most room. Just past the content-lg step, plain `1fr`
 *   columns left it about 190px: the label wrapped and pushed the dropdown down.
 * - Select Customer and Install Method share the rest; they may shrink below their content
 *   (`minmax(0, …)`), the customer name truncates.
 *
 * Without the Remote Access selector (approval gate off) the row has three columns.
 */
export function selectorRowColumns(showRemoteAccess: boolean): string {
  return showRemoteAccess
    ? 'content-lg:grid-cols-[minmax(0,1fr)_minmax(15rem,1.5fr)_auto_minmax(0,1fr)]'
    : 'content-lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]';
}
