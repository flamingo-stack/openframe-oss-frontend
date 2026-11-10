import { describe, expect, it, vi } from 'vitest';
import { getFullImageUrl, resolveBackendImageUrl } from './image-url';

vi.mock('./runtime-config', () => ({ runtimeEnv: { tenantHostUrl: () => 'https://acme.openframe.ai' } }));

describe('resolveBackendImageUrl', () => {
  it("sends the backend's image paths to the gateway's /api, query and all", () => {
    expect(resolveBackendImageUrl('/images/user/u-1')).toBe('https://acme.openframe.ai/api/images/user/u-1');
    expect(resolveBackendImageUrl('/images/user/u-1?v=abc')).toBe(
      'https://acme.openframe.ai/api/images/user/u-1?v=abc',
    );
    expect(resolveBackendImageUrl('/images/client_agent_settings/cv-1')).toBe(
      'https://acme.openframe.ai/api/images/client_agent_settings/cv-1',
    );
    expect(resolveBackendImageUrl('/knowledge-base/images/k-1')).toBe(
      'https://acme.openframe.ai/api/knowledge-base/images/k-1',
    );
    expect(resolveBackendImageUrl('/api/images/organization/o-1')).toBe(
      'https://acme.openframe.ai/api/images/organization/o-1',
    );
  });

  it('is idempotent, and agrees with getFullImageUrl', () => {
    const once = resolveBackendImageUrl('/images/user/u-1?v=abc');
    expect(resolveBackendImageUrl(once)).toBe(once);
    expect(getFullImageUrl('/images/user/u-1', 'abc')).toBe(once);
  });

  it('leaves everything that is not a backend image path alone', () => {
    for (const url of [
      'https://lh3.googleusercontent.com/a/x',
      'blob:https://acme.openframe.ai/1',
      'data:image/png;base64,AAAA',
      '/assets/logo.svg',
      '/content/api/storage/view/x.png',
      'images/user/u-1',
    ]) {
      expect(resolveBackendImageUrl(url)).toBe(url);
    }
  });
});
