/**
 * Row geometry shared by `AgentLogRow`, the list that paints it and the skeleton
 * that stands in for it — the job `table-column-layout.ts` does for `DataTable`.
 * Data-only, so a skeleton never pulls the row and its Relay artifacts in.
 */

/** Holds `13:23:05.486000012` at `text-code`: 12px below `md`, 14px above. */
export const AGENT_LOG_TIME_COLUMN = 'w-[144px] md:w-[168px]';

/** A slot, not the chip's width: `INFO` and `ERROR` differ, the message must not. */
export const AGENT_LOG_LEVEL_COLUMN = 'w-[64px]';

/**
 * The collapsed row's intrinsic height: 32px chip + 4px padding + 1px border,
 * top and bottom. The row does not set it; the skeleton and the off-screen size
 * hint below read it, so changing the row means changing this.
 */
export const AGENT_LOG_ROW_HEIGHT_PX = 42;

/**
 * Grows a text line's box to the chip's 32px (`Tag` is `h-8`) so the three
 * columns centre on one row: half the difference against the ODS code line,
 * whose only step (16px → 20px) is at 800px, which is `md`.
 */
export const AGENT_LOG_LINE_BOX = 'py-[calc((2rem_-_var(--font-line-space-h6-caption))/2)]';

/** Puts the expanded block under the message: the button's padding, both columns and both gaps. */
export const AGENT_LOG_MESSAGE_INDENT = 'md:pl-[calc(3*var(--spacing-system-xs)_+_168px_+_64px)]';

/**
 * Lets the browser skip layout and paint of rows outside the viewport; `auto`
 * remembers an opened row's real height once it has been rendered.
 */
export const AGENT_LOG_ROW_PAINT = {
  contentVisibility: 'auto',
  containIntrinsicSize: `auto ${AGENT_LOG_ROW_HEIGHT_PX}px`,
} as const;
