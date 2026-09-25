/**
 * Row geometry shared by `AgentLogRow`, the list that paints it and the skeleton
 * that stands in for it — the job `table-column-layout.ts` does for `DataTable`.
 * Data-only, so a skeleton never pulls the row and its Relay artifacts in.
 */

/**
 * The two fixed column widths, set once on the row box: the columns and the
 * expanded block's indent read the same numbers. The time holds
 * `13:23:05.486000012` at `text-code` (12px below `md`, 14px above).
 */
export const AGENT_LOG_COLUMN_VARS = '[--agent-log-time:144px] md:[--agent-log-time:168px] [--agent-log-level:64px]';

export const AGENT_LOG_TIME_COLUMN = 'w-[var(--agent-log-time)]';

/** A slot, not the chip's width: `INFO` and `ERROR` differ, the message must not. */
export const AGENT_LOG_LEVEL_COLUMN = 'w-[var(--agent-log-level)]';

/**
 * Grows a text line's box to the chip's 32px (`Tag` is `h-8`) so the three
 * columns centre on one row: half the difference against the ODS code line,
 * whose only step (16px → 20px) is at 800px, which is `md`.
 */
export const AGENT_LOG_LINE_BOX = 'py-[calc((2rem_-_var(--font-line-space-h6-caption))/2)]';

/** Puts the expanded block under the message: the button's padding, both columns and both gaps. */
export const AGENT_LOG_MESSAGE_INDENT =
  'md:pl-[calc(3*var(--spacing-system-xs)_+_var(--agent-log-time)_+_var(--agent-log-level))]';

/**
 * Skips layout and paint of rows outside the viewport; `auto` remembers an opened
 * row's real height. 42px = the collapsed row: 1px border + 4px padding + the
 * 32px chip, top and bottom.
 */
export const AGENT_LOG_ROW_PAINT = '[content-visibility:auto] [contain-intrinsic-size:auto_42px]';
