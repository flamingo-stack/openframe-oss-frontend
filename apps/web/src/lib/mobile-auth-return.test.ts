import { describe, expect, it } from 'vitest';
import { authApiClient } from './auth-api-client';
import { appWordedMessage, isAuthErrorRef, MOBILE_AUTH_ERROR, readMobileAuthReturn } from './mobile-auth-return';

const params = (query: string) => new URLSearchParams(query);

describe('readMobileAuthReturn', () => {
  it('returns the return address verbatim when the server marked the page as a mobile flow', () => {
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
    expect(readMobileAuthReturn(params('authMobile=true&redirectTo=%20'))).toBeNull();
  });

  it('does not judge the address itself: the BFF allow-list does', () => {
    expect(readMobileAuthReturn(params('authMobile=true&redirectTo=https%3A%2F%2Fexample.com%2Fauth'))).toBe(
      'https://example.com/auth',
    );
  });
});

describe('ssoJoinReturnUrl', () => {
  it('routes the exit through the BFF with the address and the reason, both encoded', () => {
    const url = authApiClient.ssoJoinReturnUrl('com.openframe.app://auth', MOBILE_AUTH_ERROR.USER_CANCELED);
    expect(url.endsWith('/oauth/join-return?redirectTo=com.openframe.app%3A%2F%2Fauth&reason=USER_CANCELED')).toBe(
      true,
    );
  });

  it('never navigates to the address directly', () => {
    const url = authApiClient.ssoJoinReturnUrl('com.openframe.app://auth', MOBILE_AUTH_ERROR.SESSION_EXPIRED);
    expect(url.startsWith('com.openframe.app://')).toBe(false);
    expect(url).toContain('/oauth/join-return?');
    expect(url).toContain('reason=SESSION_EXPIRED');
  });
});

describe('appWordedMessage', () => {
  it('has the app’s own sentence for an expired session', () => {
    expect(appWordedMessage(MOBILE_AUTH_ERROR.SESSION_EXPIRED)).toMatch(/expired/);
  });

  it('words the cancel as the code itself, so even a worded cancel stays quiet', () => {
    expect(appWordedMessage(MOBILE_AUTH_ERROR.USER_CANCELED)).toBe('USER_CANCELED');
  });

  it('leaves every other code to the auth server', () => {
    expect(appWordedMessage('SSO_SESSION_EXPIRED')).toBeUndefined();
    expect(appWordedMessage('constructor')).toBeUndefined();
  });
});

describe('isAuthErrorRef', () => {
  it('accepts what the auth server hands out and nothing that reads as a sentence', () => {
    expect(isAuthErrorRef('SSO_SESSION_EXPIRED')).toBe(true);
    expect(isAuthErrorRef('7KQ2M9XD')).toBe(true);
    expect(isAuthErrorRef('')).toBe(false);
    expect(isAuthErrorRef(null)).toBe(false);
    expect(isAuthErrorRef(undefined)).toBe(false);
    expect(isAuthErrorRef('Your account is suspended')).toBe(false);
    expect(isAuthErrorRef('sso_session_expired')).toBe(false);
    expect(isAuthErrorRef('<b>hi</b>')).toBe(false);
  });
});
