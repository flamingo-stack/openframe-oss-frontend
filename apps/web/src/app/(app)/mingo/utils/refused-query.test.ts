import { describe, expect, it } from 'vitest';
import { isRefusedQuery } from './refused-query';

// What QA's /chat/graphql answered (200, 2026-11-19) for a field its schema does not have.
const unknownField = {
  message:
    "Validation error (FieldUndefined@[dialog/tokenUsage/notARealField]) : Field 'notARealField' in type 'DialogTokenUsage' is undefined",
  locations: [{ line: 1, column: 87 }],
  path: ['dialog', 'tokenUsage', 'notARealField'],
  extensions: { classification: 'ValidationError', errorType: 'BAD_REQUEST', errorDetail: 'FIELD_NOT_FOUND' },
};

describe('isRefusedQuery', () => {
  it('is a validation error with no data: the schema does not have what the query asks', () => {
    expect(isRefusedQuery({ errors: [unknownField] })).toBe(true);
  });

  it('is GraphQL errors with no data when the server names no classification', () => {
    // What QA's federation router (/api/router/graphql, flag graphql-router) answered (200, 2026-11-19).
    const routerUnknownField = {
      message: 'Cannot query field "notARealField" on type "DialogTokenUsage".',
      path: ['query', 'dialog', 'tokenUsage'],
    };
    expect(isRefusedQuery({ errors: [routerUnknownField] })).toBe(true);
    expect(isRefusedQuery({ errors: [{ message: 'Unknown field' }] })).toBe(true);
    expect(isRefusedQuery({ data: null as unknown as undefined, errors: [{ message: 'Unknown field' }] })).toBe(true);
  });

  it('is not a query that ran: data beside the errors, a failed resolver included', () => {
    expect(isRefusedQuery({ data: { dialog: null }, errors: [unknownField] })).toBe(false);
  });

  it('is not an error of another classification', () => {
    expect(isRefusedQuery({ errors: [{ message: 'boom', extensions: { classification: 'INTERNAL_ERROR' } }] })).toBe(
      false,
    );
  });

  it('is not an answer without GraphQL errors: a gateway page, an empty body', () => {
    expect(isRefusedQuery(undefined)).toBe(false);
    expect(isRefusedQuery({})).toBe(false);
    expect(isRefusedQuery({ errors: [] })).toBe(false);
  });

  it('reads a classification only from an object', () => {
    expect(isRefusedQuery({ errors: [{ message: 'x', extensions: 'ValidationError' }] })).toBe(true);
    expect(isRefusedQuery({ errors: [{ message: 'x', extensions: { classification: 7 } }] })).toBe(true);
  });
});
