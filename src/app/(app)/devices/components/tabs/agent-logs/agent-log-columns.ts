/**
 * Column geometry shared by `AgentLogRow` and the skeleton that stands in for
 * it — the same job `table-column-layout.ts` does for `DataTable`. Data-only
 * and import-free on purpose: a skeleton must not pull the row in, and its
 * Relay artifacts with it, just to learn a width.
 */

/** Holds `13:23:05.486000012` at `text-code`: 12px below `md`, 14px above. */
export const AGENT_LOG_TIME_COLUMN = 'w-[144px] md:w-[168px]';

/** A slot, not the chip's width: `INFO` and `ERROR` differ, the message must not. */
export const AGENT_LOG_LEVEL_COLUMN = 'w-[64px]';

/**
 * The collapsed row's intrinsic height: 32px chip + 4px padding + 1px border,
 * top and bottom. The row does not set it — this records it for the skeleton
 * and the virtualizer's estimate, so changing the row means changing this.
 */
export const AGENT_LOG_ROW_HEIGHT_PX = 42;

/**
 * Grows a text line's box to the chip's 32px (`Tag` is `h-8`) so the three
 * columns centre on one row: half the difference against the ODS code line,
 * which is 16px on a phone and 20px from `md` — the token's only step is 800px,
 * which is `md`, so one class covers both.
 */
export const AGENT_LOG_LINE_BOX = 'py-[calc((2rem_-_var(--font-line-space-h6-caption))/2)]';

/**
 * Aligns the expanded block under the message column at `md+`, where `md` (800px)
 * and the spacing tokens' tablet step flip together, so `xs` is exactly 8px:
 * 8 padding + 168 time + 8 gap + 64 level + 8 gap. Recompute it here on a width change.
 */
export const AGENT_LOG_MESSAGE_INDENT = 'md:pl-[256px]';
