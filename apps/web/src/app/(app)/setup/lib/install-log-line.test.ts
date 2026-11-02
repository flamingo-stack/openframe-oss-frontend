/**
 * The installer's output as Agent Logs rows: each line keeps the time and level
 * it carries, the rest take the time it arrived.
 */

import { describe, expect, it } from 'vitest';
import { type InstallOutputLine, toInstallLogRows } from './install-log-line';

const RECEIVED = new Date('2026-10-23T10:00:00.000Z');
const lines = (...texts: string[]): InstallOutputLine[] => texts.map(text => ({ text, receivedAt: RECEIVED }));

describe('toInstallLogRows', () => {
  it('reads the Doctor check marks as levels and drops blank lines', () => {
    const rows = toInstallLogRows(
      lines(
        '',
        'OpenFrame Doctor — pre-install diagnostics',
        '',
        '  [+] Admin privileges',
        '  [x] Network: TCP test-env.qa.openframe.build:443 reachable',
        '      Check the firewall',
        '  [!] Disk: 2 GB free',
        '  [i] Proxy: none',
      ),
    );
    expect(rows.map(row => [row.level, row.message])).toEqual([
      ['INFO', 'OpenFrame Doctor — pre-install diagnostics'],
      ['INFO', 'Admin privileges'],
      ['ERROR', 'Network: TCP test-env.qa.openframe.build:443 reachable'],
      ['ERROR', 'Check the firewall'],
      ['WARN', 'Disk: 2 GB free'],
      ['INFO', 'Proxy: none'],
    ]);
    expect(rows.every(row => row.time === RECEIVED)).toBe(true);
  });

  it("takes the agent's own time and level from its JSON and compact lines", () => {
    const rows = toInstallLogRows(
      lines(
        '{"timestamp":"2026-10-23T09:59:58.123456Z","level":"WARN","target":"openframe","message":"retrying"}',
        '2026-10-23T09:59:59.500000Z  ERROR openframe::service: install failed',
        '2026-10-23T09:59:59.600000Z TRACE openframe::service: tick',
      ),
    );
    expect(rows).toEqual([
      { time: new Date('2026-10-23T09:59:58.123Z'), level: 'WARN', message: 'retrying' },
      { time: new Date('2026-10-23T09:59:59.500Z'), level: 'ERROR', message: 'openframe::service: install failed' },
      { time: new Date('2026-10-23T09:59:59.600Z'), level: 'DEBUG', message: 'openframe::service: tick' },
    ]);
  });

  it('marks what a failing shell step prints as an error, everything else as info', () => {
    const rows = toInstallLogRows(
      lines(
        'Starting installation...',
        'curl: (22) The requested URL returned error: 404',
        'Error: the service did not start',
        '{not json',
        'OpenFrame agent installed successfully.',
      ),
    );
    expect(rows.map(row => row.level)).toEqual(['INFO', 'ERROR', 'ERROR', 'INFO', 'INFO']);
  });
});
