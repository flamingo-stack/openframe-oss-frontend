import { describe, expect, it } from 'vitest';
import { parseDeviceLogSearch } from './device-log-search';

describe('parseDeviceLogSearch', () => {
  it('splits words, keeps quoted phrases whole and turns a leading dash into an exclusion', () => {
    expect(parseDeviceLogSearch('"control channel" failed -heartbeat -"auth token"')).toEqual({
      contains: ['control channel', 'failed'],
      excludes: ['heartbeat', 'auth token'],
      error: null,
    });
  });

  it('drops empty tokens and passes regex-looking characters through', () => {
    expect(parseDeviceLogSearch('  -  ""  . * (?=x ')).toEqual({
      contains: ['.', '*', '(?=x'],
      excludes: [],
      error: null,
    });
  });

  it('reports the API limits instead of sending a request that will be rejected', () => {
    expect(parseDeviceLogSearch('a b c d e f').error).toMatch(/up to 5/);
    expect(parseDeviceLogSearch('-a -b -c -d -e -f').error).toMatch(/up to 5/);
    expect(parseDeviceLogSearch('a b c d e -f -g -h -i -j').error).toBeNull();
    expect(parseDeviceLogSearch('x'.repeat(257)).error).toMatch(/256 characters/);
    expect(parseDeviceLogSearch('x'.repeat(256)).error).toBeNull();
  });
});
