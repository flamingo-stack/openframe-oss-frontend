// The user page and Edit User call the same number the user's Phone: an empty one is no number, on both.

import { describe, expect, it, vi } from 'vitest';
import type { userPhone_account$data, userPhone_account$key } from '@/__generated__/userPhone_account.graphql';

// `readInlineData` hands the node back: the fixtures are the fragment's fields.
vi.mock('react-relay', () => ({
  graphql: () => ({}),
  readInlineData: (_fragment: unknown, ref: unknown) => ref,
}));

import { readUserPhone } from './user-phone';

function phoneOf(
  phone: string | null,
  details: { mobilePhone: string | null; businessPhones: string[] } | null,
): ReturnType<typeof readUserPhone> {
  const data: Omit<userPhone_account$data, ' $fragmentType'> = { phone, details };
  return readUserPhone(data as unknown as userPhone_account$key);
}

describe('readUserPhone', () => {
  it('takes the mobile number, then the first business one, then the local one', () => {
    expect(phoneOf('+1 999', { mobilePhone: '+1 555', businessPhones: ['+1 777'] })).toEqual({
      phone: '+1 555',
      target: 'mobile',
      otherBusinessPhones: [],
    });
    expect(phoneOf('+1 999', { mobilePhone: null, businessPhones: ['+1 777', '+1 888'] })).toEqual({
      phone: '+1 777',
      target: 'business',
      otherBusinessPhones: ['+1 888'],
    });
    expect(phoneOf('+1 999', { mobilePhone: null, businessPhones: [] })).toMatchObject({
      phone: '+1 999',
      target: 'local',
    });
  });

  it('passes over an empty number', () => {
    expect(phoneOf(null, { mobilePhone: '', businessPhones: ['+1 777'] })).toMatchObject({
      phone: '+1 777',
      target: 'business',
    });
    expect(phoneOf('+1 999', { mobilePhone: '', businessPhones: [] })).toMatchObject({
      phone: '+1 999',
      target: 'local',
    });
  });

  it('keeps only the local number on a failed live read', () => {
    expect(phoneOf('+1 999', null)).toMatchObject({ phone: '+1 999', target: 'local' });
    expect(phoneOf(null, null)).toMatchObject({ phone: '', target: 'local' });
  });

  it('starts a business number on a provider account that has none', () => {
    expect(phoneOf(null, { mobilePhone: null, businessPhones: [] })).toEqual({
      phone: '',
      target: 'business',
      otherBusinessPhones: [],
    });
  });
});
