import { describe, expect, it } from 'vitest';
import {
  MOBILE_AUTH_ERROR,
  mobileAuthErrorMessage,
  mobileAuthReturnUrl,
  readMobileAuthReturn,
} from './mobile-auth-return';

const params = (query: string) => new URLSearchParams(query);

describe('readMobileAuthReturn', () => {
  it('returns the app scheme URL when the server marked the page as a mobile flow', () => {
    expect(readMobileAuthReturn(params('authMobile=true&redirectTo=com.openframe.app%3A%2F%2Fauth'))).toBe(
      'com.openframe.app://auth',
    );
  });

  it('is null for a web flow, with or without a redirectTo', () => {
    expect(readMobileAuthReturn(params(''))).toBeNull();
    expect(readMobileAuthReturn(params('redirectTo=com.openframe.app%3A%2F%2Fauth'))).toBeNull();
    expect(readMobileAuthReturn(params('authMobile=false&redirectTo=com.openframe.app%3A%2F%2Fauth'))).toBeNull();
  });

  it('is null when the flow is mobile but no return address came with it', () => {
    expect(readMobileAuthReturn(params('authMobile=true'))).toBeNull();
    expect(readMobileAuthReturn(params('authMobile=true&redirectTo='))).toBeNull();
    expect(readMobileAuthReturn(params('authMobile=true&redirectTo=not%20a%20url'))).toBeNull();
  });

  it('refuses anything that is not a custom app scheme', () => {
    for (const bad of [
      'https://evil.example/auth',
      'http://localhost/auth',
      'javascript:alert(1)',
      'data:text/html,hi',
      'file:///etc/passwd',
    ]) {
      expect(readMobileAuthReturn(params(`authMobile=true&redirectTo=${encodeURIComponent(bad)}`))).toBeNull();
    }
  });
});

describe('mobileAuthReturnUrl', () => {
  it('adds the outcome the app reads off the callback', () => {
    expect(mobileAuthReturnUrl('com.openframe.app://auth', MOBILE_AUTH_ERROR.USER_CANCELED)).toBe(
      'com.openframe.app://auth?error=USER_CANCELED',
    );
  });

  it('keeps whatever query the address already carried', () => {
    expect(mobileAuthReturnUrl('com.openframe.app://auth?x=1', MOBILE_AUTH_ERROR.SESSION_EXPIRED)).toBe(
      'com.openframe.app://auth?x=1&error=SESSION_EXPIRED',
    );
  });
});

describe('mobileAuthErrorMessage', () => {
  it('passes the cancel code through verbatim so the quiet-cancel check still matches', () => {
    expect(mobileAuthErrorMessage('USER_CANCELED')).toBe('USER_CANCELED');
  });

  it('has copy for an expired session and a fallback for unknown codes', () => {
    expect(mobileAuthErrorMessage('SESSION_EXPIRED')).toMatch(/expired/);
    expect(mobileAuthErrorMessage('SOMETHING_ELSE')).toContain('SOMETHING_ELSE');
  });
});
