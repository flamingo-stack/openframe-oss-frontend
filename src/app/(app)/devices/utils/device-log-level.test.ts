import { describe, expect, it } from 'vitest';
import { getDeviceLogLevelVariant, normalizeDeviceLogLevel } from './device-log-level';

describe('normalizeDeviceLogLevel', () => {
  it('accepts the four levels in any case', () => {
    expect(normalizeDeviceLogLevel('error')).toBe('ERROR');
    expect(normalizeDeviceLogLevel(' Warn ')).toBe('WARN');
    expect(normalizeDeviceLogLevel('DEBUG')).toBe('DEBUG');
  });

  it('renders anything else in the INFO style', () => {
    expect(normalizeDeviceLogLevel('TRACE')).toBe('INFO');
    expect(normalizeDeviceLogLevel('')).toBe('INFO');
  });

  it('never relies on colour alone: every level has its own variant', () => {
    expect(new Set(['DEBUG', 'INFO', 'WARN', 'ERROR'].map(l => getDeviceLogLevelVariant(l as never))).size).toBe(4);
  });
});
