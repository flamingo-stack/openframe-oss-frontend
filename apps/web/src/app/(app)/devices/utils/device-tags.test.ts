import { describe, expect, it } from 'vitest';
import { asInstant } from '@/lib/graphql-scalars';
import { toDeviceTags } from './device-tags';

const TAGGED_AT = asInstant('2026-11-01T10:00:00Z');

const ENV_TAG = { id: 'VGFnOmVudg==', key: 'env', description: 'Environment', color: '#ff0000' };

describe('toDeviceTags', () => {
  it('keys a tag by its definition and takes values and the tagged date from the device', () => {
    expect(toDeviceTags([{ id: 'TWFjaGluZVRhZzph', values: ['prod'], taggedAt: TAGGED_AT, tag: ENV_TAG }])).toEqual([
      {
        tagId: ENV_TAG.id,
        key: 'env',
        description: 'Environment',
        color: '#ff0000',
        values: ['prod'],
        createdAt: TAGGED_AT,
      },
    ]);
  });

  it('keeps each device its own values when two devices share a tag', () => {
    const first = toDeviceTags([{ id: 'MachineTag:a', values: ['a'], taggedAt: null, tag: ENV_TAG }]);
    const second = toDeviceTags([{ id: 'MachineTag:b', values: ['b'], taggedAt: null, tag: ENV_TAG }]);

    expect(first[0]).toMatchObject({ tagId: ENV_TAG.id, values: ['a'] });
    expect(second[0]).toMatchObject({ tagId: ENV_TAG.id, values: ['b'] });
  });

  it('leaves the date out for a legacy assignment without one', () => {
    const [tag] = toDeviceTags([{ id: 'MachineTag:a', values: ['a'], taggedAt: null, tag: ENV_TAG }]);
    expect(tag.createdAt).toBeUndefined();
  });

  it('maps a plain label to empty values and a definition without colour or description to undefined', () => {
    expect(toDeviceTags([{ id: 'MachineTag:a', values: [], tag: { id: 'Tag:vip', key: 'vip' } }])).toEqual([
      { tagId: 'Tag:vip', key: 'vip', description: undefined, color: undefined, values: [], createdAt: undefined },
    ]);
  });

  it('copies values instead of handing out the readonly array', () => {
    const values = Object.freeze(['a']) as unknown as string[];
    const [tag] = toDeviceTags([{ id: 'MachineTag:a', values, tag: ENV_TAG }]);
    tag.values.push('b');
    expect(values).toEqual(['a']);
  });

  it('is empty for no assignments and skips null entries', () => {
    expect(toDeviceTags(null)).toEqual([]);
    expect(toDeviceTags(undefined)).toEqual([]);
    expect(toDeviceTags([null, undefined])).toEqual([]);
  });
});
