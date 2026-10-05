import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatTicketRowMeta } from './ticket-row-meta';

describe('formatTicketRowMeta', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('joins the ticket number and the relative creation time with a bullet', () => {
    expect(formatTicketRowMeta({ ticketNumber: 3891, createdAt: '2026-09-10T11:55:00Z' })).toBe('3891 • 5 min ago');
  });

  it('keeps the number alone when the creation time is missing', () => {
    expect(formatTicketRowMeta({ ticketNumber: 3891, createdAt: null })).toBe('3891');
  });

  it('keeps the time alone when the number is missing', () => {
    expect(formatTicketRowMeta({ ticketNumber: undefined, createdAt: '2026-09-10T11:55:00Z' })).toBe('5 min ago');
  });

  it('renders nothing when both halves are missing', () => {
    expect(formatTicketRowMeta({})).toBe('');
  });
});
