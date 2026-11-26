/**
 * Which package managers get a card on the Agents tab: only one OpenFrame runs on the device, installed or being
 * installed by OpenFrame, in the order Chocolatey, WinGet, Homebrew.
 */
import { describe, expect, it } from 'vitest';
import type { Instant } from '@/lib/graphql-scalars';
import type { DevicePackageManager } from '../hooks/device-package-managers';
import { packageManagerCards } from './package-manager-cards';

const CHANGED_AT = '2026-11-01T10:00:00Z' as Instant;

function manager(overrides: Partial<DevicePackageManager>): DevicePackageManager {
  return {
    type: 'WINGET',
    state: 'PRESENT',
    managed: true,
    installing: false,
    version: '1.12.470',
    versionChangedAt: CHANGED_AT,
    ...overrides,
  };
}

describe('packageManagerCards', () => {
  it('gives none before the first answer, and none for a backend without the field', () => {
    expect(packageManagerCards(undefined)).toEqual([]);
    expect(packageManagerCards(null)).toEqual([]);
  });

  it('orders Chocolatey before WinGet before Homebrew, whatever order they come in', () => {
    const cards = packageManagerCards([
      manager({ type: 'BREW' }),
      manager({ type: 'WINGET' }),
      manager({ type: 'CHOCO' }),
    ]);
    expect(cards.map(card => card.label)).toEqual(['Chocolatey', 'WinGet', 'Homebrew']);
  });

  it('carries the version and its change time for an installed, managed manager', () => {
    expect(packageManagerCards([manager({})])).toEqual([
      { type: 'WINGET', label: 'WinGet', pending: false, version: '1.12.470', versionChangedAt: CHANGED_AT },
    ]);
  });

  it.each([
    ['installed but not run by OpenFrame (unsupported device, Chocolatey off)', { managed: false }],
    ['unsupported', { state: 'UNSUPPORTED', managed: false } as const],
    ['missing and not being installed (bootstrap off, or a failed install)', { state: 'MISSING' } as const],
    ['unreadable with nobody signed in', { state: 'UNKNOWN' } as const],
  ])('gives no card to a manager %s', (_case, overrides) => {
    expect(packageManagerCards([manager(overrides)])).toEqual([]);
  });

  it('makes an installing manager a pending card without version or change time', () => {
    const [card] = packageManagerCards([manager({ state: 'MISSING', installing: true, version: null })]);
    expect(card).toEqual({ type: 'WINGET', label: 'WinGet', pending: true, version: null, versionChangedAt: null });
  });

  it('gives no pending card to a manager OpenFrame does not run, even if installing is reported', () => {
    expect(packageManagerCards([manager({ managed: false, installing: true })])).toEqual([]);
  });
});
