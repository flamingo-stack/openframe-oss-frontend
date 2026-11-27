import { describe, expect, it } from 'vitest';
import { deviceHeaderStatus } from './device-header-status';

describe('deviceHeaderStatus', () => {
  it('puts a managed device in the subtitle instead of a tag, in the lifecycle display', () => {
    for (const status of ['MANAGED', 'ONLINE', 'offline']) {
      expect(deviceHeaderStatus(status, 'lifecycle', 'Updated 41 days ago')).toEqual({
        tag: false,
        subtitle: 'Managed · Updated 41 days ago',
      });
    }
    expect(deviceHeaderStatus('MANAGED', 'lifecycle', undefined)).toEqual({ tag: false, subtitle: 'Managed' });
  });

  it('keeps the tag for every other status', () => {
    for (const status of ['PENDING', 'PENDING_DELETION', 'DELETED', 'ARCHIVED', null, undefined]) {
      expect(deviceHeaderStatus(status, 'lifecycle', 'Updated 1 hour ago')).toEqual({
        tag: true,
        subtitle: 'Updated 1 hour ago',
      });
    }
  });

  it('keeps the tag and the plain subtitle in the legacy display', () => {
    expect(deviceHeaderStatus('MANAGED', 'legacy', 'Updated 1 hour ago')).toEqual({
      tag: true,
      subtitle: 'Updated 1 hour ago',
    });
    expect(deviceHeaderStatus('ONLINE', 'legacy', undefined)).toEqual({ tag: true, subtitle: undefined });
  });
});
