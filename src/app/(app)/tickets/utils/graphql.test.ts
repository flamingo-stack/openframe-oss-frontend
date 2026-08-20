import { describe, expect, it } from 'vitest';
import {
  extractGraphQlData,
  GraphQlResponseError,
  isGraphQlValidationError,
  pruneLeafFields,
  undefinedFieldNames,
} from './graphql';

const UNDEFINED_ESCALATED =
  "Validation error of type FieldUndefined: Field 'escalatedByUser' in type 'Ticket' is undefined";

describe('undefinedFieldNames', () => {
  it('reads the field name from a FieldUndefined validation error', () => {
    expect(undefinedFieldNames([{ message: UNDEFINED_ESCALATED }])).toEqual(['escalatedByUser']);
  });

  it('de-duplicates a field reported across several errors', () => {
    expect(undefinedFieldNames([{ message: UNDEFINED_ESCALATED }, { message: UNDEFINED_ESCALATED }])).toEqual([
      'escalatedByUser',
    ]);
  });

  it('ignores errors that are not about an undefined field', () => {
    expect(undefinedFieldNames([{ message: 'Internal server error' }])).toEqual([]);
  });
});

describe('pruneLeafFields', () => {
  it('removes a plain leaf selection', () => {
    const query = `{ ticket { id escalatedByUser title } }`;
    expect(pruneLeafFields(query, ['escalatedByUser'])).not.toContain('escalatedByUser');
  });

  it('keeps a field that carries a sub-selection', () => {
    const query = `{ ticket { tags { id } } }`;
    expect(pruneLeafFields(query, ['tags'])).toContain('tags {');
  });

  it('keeps a field that carries arguments', () => {
    const query = `{ ticket { notes(first: 5) } }`;
    expect(pruneLeafFields(query, ['notes'])).toContain('notes(first: 5)');
  });
});

describe('extractGraphQlData', () => {
  it('throws a validation error carrying the undefined field', () => {
    const call = () =>
      extractGraphQlData({
        ok: true,
        data: { errors: [{ message: UNDEFINED_ESCALATED, extensions: { classification: 'ValidationError' } }] },
      });
    expect(call).toThrow(GraphQlResponseError);
    try {
      call();
    } catch (error) {
      expect(isGraphQlValidationError(error)).toBe(true);
      expect((error as GraphQlResponseError).undefinedFields).toEqual(['escalatedByUser']);
    }
  });

  it('does not flag a plain GraphQL error as a validation error', () => {
    try {
      extractGraphQlData({ ok: true, data: { errors: [{ message: 'boom' }] } });
    } catch (error) {
      expect(isGraphQlValidationError(error)).toBe(false);
    }
  });

  it('returns the data when the response has no errors', () => {
    expect(extractGraphQlData({ ok: true, data: { data: { value: 1 } } })).toEqual({ value: 1 });
  });
});
