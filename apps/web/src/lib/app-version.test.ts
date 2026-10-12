import { describe, expect, it } from 'vitest';
import { isVersionBelow, parseVersion } from './app-version';

describe('parseVersion', () => {
  it('reads MAJOR.MINOR.PATCH', () => {
    expect(parseVersion('1.0.125')).toEqual([1, 0, 125]);
  });

  it('ignores a git-describe suffix, as the gateway does', () => {
    expect(parseVersion('1.0.125-4-geae0416-dirty')).toEqual([1, 0, 125]);
  });

  it.each(['-', '', 'eae0416', '1.0', 'v1.0.1', '1..1', null, undefined])('treats %j as unknown', value => {
    expect(parseVersion(value)).toBeNull();
  });
});

describe('isVersionBelow', () => {
  it('compares numerically, not as strings', () => {
    expect(isVersionBelow('1.9.0', '1.10.0')).toBe(true);
    expect(isVersionBelow('1.10.0', '1.9.0')).toBe(false);
  });

  it('compares each part in order', () => {
    expect(isVersionBelow('1.0.119', '1.0.120')).toBe(true);
    expect(isVersionBelow('1.1.0', '1.0.999')).toBe(false);
    expect(isVersionBelow('0.9.9', '1.0.0')).toBe(true);
  });

  it('is false for equal versions', () => {
    expect(isVersionBelow('1.0.120', '1.0.120')).toBe(false);
  });

  it('counts a suffixed build as its tag', () => {
    expect(isVersionBelow('1.0.125-4-geae0416-dirty', '1.0.125')).toBe(false);
    expect(isVersionBelow('1.0.124-9-gabcdef0', '1.0.125')).toBe(true);
  });

  it('never prompts on an unknown side', () => {
    expect(isVersionBelow('-', '1.0.120')).toBe(false);
    expect(isVersionBelow('garbage', '1.0.120')).toBe(false);
    expect(isVersionBelow('1.0.1', '-')).toBe(false);
    expect(isVersionBelow('1.0.1', undefined)).toBe(false);
    expect(isVersionBelow(null, '1.0.120')).toBe(false);
  });
});
