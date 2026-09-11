/** Player timecode per the mockup: always `HH:MM:SS`, e.g. 318_000 -> "00:05:18". */
export function formatTimecodeMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  return [hours, minutes, seconds].map(v => String(v).padStart(2, '0')).join(':');
}

/** 90_500 -> "01:30"; hour-long recordings -> "1:05:12". */
export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 2_454_931 -> "2.3 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 'B';
  for (const next of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  // `>= 99.95`, not `>= 100`: `toFixed(1)` rounds 99.96 up to "100.0", which
  // would sit next to a rounded "100" - same number, two formats.
  return `${value >= 99.95 ? Math.round(value) : value.toFixed(1)} ${unit}`;
}
