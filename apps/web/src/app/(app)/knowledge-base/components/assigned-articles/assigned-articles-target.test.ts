/**
 * The server stores an assignment by the target's own id (an `organizationId`,
 * a `machineId`) and decodes the target global id to get it, so the id the tab
 * sends must be exactly the Organization / Machine global id of that raw id —
 * the same bytes the API hands out as `node.id`.
 */

import { describe, expect, it } from 'vitest';
import { decodeGlobalId } from '@/lib/relay-id';
import { customerArticlesTarget, deviceArticlesTarget, targetNoun } from './assigned-articles-target';

describe('assigned articles target', () => {
  it('encodes a customer by its organizationId, as the API does', () => {
    const target = customerArticlesTarget('a805b7f9-283d-4ad5-a10e-22974eb737c9');
    expect(target.targetType).toBe('ORGANIZATION');
    // `organizations { id }` on a feature tenant, for that organizationId.
    expect(target.targetId).toBe('T3JnYW5pemF0aW9uOmE4MDViN2Y5LTI4M2QtNGFkNS1hMTBlLTIyOTc0ZWI3MzdjOQ');
  });

  it('encodes a device by its machineId', () => {
    const target = deviceArticlesTarget('machine-1');
    expect(target.targetType).toBe('DEVICE');
    expect(decodeGlobalId(target.targetId)).toEqual({ typename: 'Machine', rawId: 'machine-1' });
  });

  it('names the target in the empty state', () => {
    expect(targetNoun(customerArticlesTarget('o'))).toBe('customer');
    expect(targetNoun(deviceArticlesTarget('m'))).toBe('device');
  });
});
