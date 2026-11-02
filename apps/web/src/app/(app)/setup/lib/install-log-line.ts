import { normalizeDeviceLogLevel } from '@/app/(app)/devices/utils/device-log-level';
import { DeviceLogLevel } from '@/generated/schema-enums';

/** A line the installer printed, with the time the shell handed it over. */
export interface InstallOutputLine {
  text: string;
  receivedAt: Date;
}

/** One row of the install log, in the Agent Logs columns: time · level · message. */
export interface InstallLogRow {
  time: Date;
  level: DeviceLogLevel;
  message: string;
}

/** The Doctor's check marks (`[+] Admin privileges`): pass, fail, warn, info. */
const DOCTOR_LINE = /^\s*\[([+x!i])\]\s+(.*)$/;
const DOCTOR_LEVEL: Record<string, DeviceLogLevel> = {
  '+': DeviceLogLevel.INFO,
  x: DeviceLogLevel.ERROR,
  '!': DeviceLogLevel.WARN,
  i: DeviceLogLevel.INFO,
};
/** The agent's compact tracing line: `2026-10-23T10:00:00.123456Z  INFO openframe::service: started`. */
const TRACING_LINE = /^(\d{4}-\d{2}-\d{2}T\S+)\s+(TRACE|DEBUG|INFO|WARN|ERROR)\s+(.*)$/;
/** What a shell step prints when it fails: `curl: (22) …`, `Error: …`, `failed to …`. */
const FAILURE_LINE = /^(?:curl: \(\d+\)|(?:error|fatal|failed)\b)/i;
/** A Doctor hint under its check, or any other indented continuation. */
const CONTINUATION = /^\s{4,}\S/;

function validDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The agent's JSON log line (`{"timestamp", "level", "message", …}`), or null. */
function parseJsonLine(text: string): (Omit<InstallLogRow, 'time'> & { time: Date | null }) | null {
  if (!text.startsWith('{')) return null;
  try {
    const entry = JSON.parse(text) as Record<string, unknown>;
    if (typeof entry.message !== 'string' || typeof entry.level !== 'string') return null;
    return { time: validDate(entry.timestamp), level: normalizeDeviceLogLevel(entry.level), message: entry.message };
  } catch {
    return null;
  }
}

/**
 * The installer's output as Agent Logs rows. The installer mixes the Doctor's
 * check list, the agent's own log lines (JSON or compact text) and whatever the
 * shell steps print; each keeps the time and level it carries, and the rest take
 * the time they arrived and INFO, or ERROR when they read as a failure. An
 * indented line continues the row above and takes its level. Blank lines are
 * spacing in a terminal and dropped here.
 */
export function toInstallLogRows(lines: readonly InstallOutputLine[]): InstallLogRow[] {
  const rows: InstallLogRow[] = [];
  for (const { text, receivedAt } of lines) {
    if (!text.trim()) continue;

    const json = parseJsonLine(text);
    if (json) {
      rows.push({ ...json, time: json.time ?? receivedAt });
      continue;
    }
    const tracing = TRACING_LINE.exec(text);
    if (tracing) {
      rows.push({
        time: validDate(tracing[1]) ?? receivedAt,
        level: normalizeDeviceLogLevel(tracing[2] === 'TRACE' ? 'DEBUG' : tracing[2]),
        message: tracing[3],
      });
      continue;
    }
    const doctor = DOCTOR_LINE.exec(text);
    if (doctor) {
      rows.push({ time: receivedAt, level: DOCTOR_LEVEL[doctor[1]], message: doctor[2] });
      continue;
    }
    const previous = rows.at(-1);
    const message = text.trim();
    if (previous && CONTINUATION.test(text)) {
      rows.push({ time: receivedAt, level: previous.level, message });
      continue;
    }
    rows.push({
      time: receivedAt,
      level: FAILURE_LINE.test(message) ? DeviceLogLevel.ERROR : DeviceLogLevel.INFO,
      message,
    });
  }
  return rows;
}
