import { describe, expect, it } from 'vitest';
import { formatTicketRef } from './ticket-ref';

describe('formatTicketRef', () => {
  it('joins the number and the title with a colon', () => {
    expect(formatTicketRef({ ticketNumber: 1003, title: 'Email client synchronization issues' })).toBe(
      '1003: Email client synchronization issues',
    );
  });

  it('falls back to the title alone when the number is missing', () => {
    expect(formatTicketRef({ ticketNumber: null, title: 'Printer offline' })).toBe('Printer offline');
  });

  it('falls back to the number alone when the title is missing or blank', () => {
    expect(formatTicketRef({ ticketNumber: 7, title: '' })).toBe('7');
    expect(formatTicketRef({ ticketNumber: 7, title: '   ' })).toBe('7');
  });

  it('returns the fallback when neither half is present', () => {
    expect(formatTicketRef({}, 'abc123')).toBe('abc123');
    expect(formatTicketRef({})).toBe('');
  });
});
