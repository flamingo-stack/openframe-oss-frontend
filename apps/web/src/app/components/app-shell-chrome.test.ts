import { describe, expect, it } from 'vitest';
import { APP_MAIN_CLASS_NAME, getMainClassNameOverride } from './app-shell-chrome';

describe('getMainClassNameOverride', () => {
  it('drops the bottom padding on the pages that fill <main>, the Mingo chat and archive included', () => {
    for (const pathname of [
      '/devices/details/file-manager',
      '/tickets',
      '/settings/sso',
      '/mingo/chat',
      '/mingo/chat/',
      '/mingo/archive',
      '/mingo/archive/',
    ]) {
      expect(getMainClassNameOverride(pathname), pathname).toBe('pb-0 md:pb-0');
    }
  });

  it('leaves every other page on the default padding', () => {
    for (const pathname of ['/mingo', '/mingo/', '/approvals', '/devices', '/dashboard']) {
      expect(getMainClassNameOverride(pathname), pathname).toBeUndefined();
    }
    expect(getMainClassNameOverride(null)).toBeUndefined();
    expect(APP_MAIN_CLASS_NAME).toBe('pb-14');
  });
});
