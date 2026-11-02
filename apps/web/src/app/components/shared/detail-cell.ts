/**
 * The value-over-label cells of a record's detail card (an execution, a script, a query, an incident): each cell's
 * place on the card's wrapping rows, and the gap inside it. One definition, read by every card that lays cells out.
 */

/** A cell's place on a wrapping row: at least 140px, sharing the row evenly. */
export const DETAIL_CELL_CLASS = 'flex min-w-[140px] flex-[1_0_0]';

/** The gap between a cell's value and its label (the `InfoCell`'s `className`). */
export const DETAIL_CELL_GAP_CLASS = 'gap-[var(--spacing-system-xxs)]';
