import { describe, expect, it } from 'vitest';
import { CONNECTION_MODIFIED_CONCURRENTLY, userErrorsDescription } from './form-save';

describe('userErrorsDescription', () => {
  it('says what to do about a save that crossed another one', () => {
    expect(userErrorsDescription([{ code: CONNECTION_MODIFIED_CONCURRENTLY, message: 'Connection modified' }])).toMatch(
      /Reload the page/,
    );
  });

  it("lists the API's messages once each", () => {
    expect(
      userErrorsDescription([
        { code: 'RULE_VALUE_UNKNOWN', message: 'Unknown GROUP id: g-gone' },
        { code: 'RULE_VALUE_UNKNOWN', message: 'Unknown GROUP id: g-gone' },
        { code: 'CUSTOMER_NOT_FOUND', message: 'Organization not found or not active: old' },
      ]),
    ).toBe('Unknown GROUP id: g-gone, Organization not found or not active: old');
  });
});
