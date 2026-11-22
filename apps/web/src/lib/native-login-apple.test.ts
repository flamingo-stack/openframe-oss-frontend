import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { nativeLogin } from './native-login';

const nativeAuth = vi.hoisted(() => ({
  start: vi.fn().mockResolvedValue({ callbackUrl: 'openframe://auth?devTicket=fixture' }),
  signInWithApple: vi.fn().mockResolvedValue({ identityToken: 'identity', authorizationCode: 'code' }),
  exchangeApple: vi.fn().mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
  exchangeTicket: vi.fn().mockResolvedValue({ accessToken: 'access' }),
  setTenantHost: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./auth-api-client', () => ({
  authApiClient: {
    loginUrl: () => 'https://auth.openframe.example/oauth/login',
    ssoLoginUrl: () => 'https://auth.openframe.example/sas/oauth/sso',
  },
}));
vi.mock('./native-shell', () => ({ nativeAuthPlugin: () => nativeAuth, storeTenantHost: vi.fn() }));
vi.mock('./platform', () => ({ isDesktopShell: () => false, mobilePlatform: () => 'ios' }));
vi.mock('./runtime-config', () => ({
  runtimeEnv: {
    tenantHostUrl: () => '',
    pinnedTenantHostUrl: () => '',
    sharedHostUrl: () => 'https://auth.openframe.example',
    appScheme: () => 'openframe',
  },
}));
vi.mock('./token-store', () => ({ setTokens: vi.fn() }));

afterEach(() => vi.unstubAllGlobals());

it('keeps native Apple sign-in for a known workspace when discovery also supplies a company handle', async () => {
  vi.stubGlobal('crypto', webcrypto);

  await nativeLogin({
    provider: 'apple',
    tenantId: 'workspace-1',
    tenantDomain: 'acme.openframe.example',
    loginHandle: 'company-sign-in-handle',
  });

  expect(nativeAuth.signInWithApple).toHaveBeenCalledOnce();
  expect(nativeAuth.exchangeApple).toHaveBeenCalledWith({
    url: 'https://auth.openframe.example/oauth/apple/native-exchange',
    body: expect.objectContaining({ tenantId: 'workspace-1', identityToken: 'identity', authorizationCode: 'code' }),
  });
  expect(nativeAuth.start).not.toHaveBeenCalled();
});
