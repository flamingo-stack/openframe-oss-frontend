import { describe, expect, it } from 'vitest';
import { DEVICE_LOG_SEARCH_REJECTED_MESSAGE, parseDeviceLogSearch } from './device-log-search';

describe('parseDeviceLogSearch', () => {
  it('splits plain words into terms that must all appear', () => {
    expect(parseDeviceLogSearch('connection failed')).toEqual({
      contains: ['connection', 'failed'],
      excludes: [],
      error: null,
    });
  });

  it('keeps quoted text as one phrase', () => {
    expect(parseDeviceLogSearch('"control channel"')).toEqual({
      contains: ['control channel'],
      excludes: [],
      error: null,
    });
  });

  it('turns a leading dash into an exclusion, quoted or not', () => {
    expect(parseDeviceLogSearch('"control channel" -heartbeat')).toEqual({
      contains: ['control channel'],
      excludes: ['heartbeat'],
      error: null,
    });
    expect(parseDeviceLogSearch('-"auth token"').excludes).toEqual(['auth token']);
  });

  it('drops empty tokens: a lone dash, empty quotes, extra whitespace', () => {
    expect(parseDeviceLogSearch('  -  ""  -""  ')).toEqual({ contains: [], excludes: [], error: null });
    expect(parseDeviceLogSearch('')).toEqual({ contains: [], excludes: [], error: null });
  });

  it('passes regex-looking characters through literally', () => {
    expect(parseDeviceLogSearch('. * ( fd=20').contains).toEqual(['.', '*', '(', 'fd=20']);
  });

  it('refuses the patterns the edge proxy rejects before sending them', () => {
    expect(parseDeviceLogSearch('(?=foo').error).toBe(DEVICE_LOG_SEARCH_REJECTED_MESSAGE);
    expect(parseDeviceLogSearch('ok -(?>bar').error).toBe(DEVICE_LOG_SEARCH_REJECTED_MESSAGE);
  });

  it('enforces the term limits instead of sending a request that will fail', () => {
    expect(parseDeviceLogSearch('a b c d e f').error).toMatch(/up to 5 search terms/i);
    expect(parseDeviceLogSearch('-a -b -c -d -e -f').error).toMatch(/up to 5 excluded terms/i);
    expect(parseDeviceLogSearch('a b c d e -f -g -h -i -j').error).toBeNull();
    expect(parseDeviceLogSearch('x'.repeat(257)).error).toMatch(/256 characters/);
    expect(parseDeviceLogSearch('x'.repeat(256)).error).toBeNull();
  });
});
