// Row geometry the live row and its skeleton share, so the swap to real content does not shift the list.
export const DEVICE_LOG_LINE =
  'flex items-center gap-[var(--spacing-system-xs)] px-[var(--spacing-system-xs)] py-[var(--spacing-system-xxs)]';
/** Fits `13:23:05.486`. */
export const DEVICE_LOG_TIME_COLUMN = 'w-[12ch]';
/** A slot, not the chip's width: `INFO` and `ERROR` differ, the message must not. */
export const DEVICE_LOG_LEVEL_COLUMN = 'w-16';
