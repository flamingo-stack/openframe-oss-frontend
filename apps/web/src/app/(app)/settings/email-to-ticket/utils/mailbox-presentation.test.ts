import { describe, expect, it } from 'vitest';
import { MailboxProvider, MailboxReceivingState, MailboxReplyState } from '@/generated/schema-enums';
import type { Instant } from '@/lib/graphql-scalars';
import {
  mailboxProviderPresentation,
  RECEIVING_FILTER_OPTIONS,
  receivingStateDetailLine,
  receivingStateLine,
  receivingStateTag,
  replyStateLine,
} from './mailbox-presentation';

const AT = '2026-11-19T09:00:00Z' as Instant;

describe('mailboxProviderPresentation', () => {
  it('names each provider and gives its forwarding steps', () => {
    for (const provider of Object.values(MailboxProvider)) {
      const presentation = mailboxProviderPresentation(provider);
      expect(presentation.label).not.toBe(provider);
      expect(presentation.radioDescription).not.toBe('');
      expect(presentation.forwardingSteps).toHaveLength(3);
      expect(presentation.guideUrl).toMatch(/^https:\/\//);
    }
  });

  it('keeps an unknown provider readable, with no steps to follow', () => {
    const presentation = mailboxProviderPresentation('ZOHO');
    expect(presentation.forwardingSteps).toEqual([]);
    expect(presentation.radioDescription).toBe('');
    expect(presentation.guideUrl).toBeNull();
  });
});

describe('receiving state', () => {
  it('tags every state, an unknown one as itself in grey', () => {
    expect(receivingStateTag(MailboxReceivingState.RECEIVING).variant).toBe('success');
    expect(receivingStateTag(MailboxReceivingState.NOT_RECEIVING).variant).toBe('error');
    expect(receivingStateTag('SOMETHING_NEW')).toEqual({ label: 'SOMETHING_NEW', variant: 'grey' });
  });

  it('offers the listed states only: the API never lists a Pending mailbox', () => {
    expect(RECEIVING_FILTER_OPTIONS.map(option => option.value)).toEqual([
      MailboxReceivingState.RECEIVING,
      MailboxReceivingState.QUIET,
      MailboxReceivingState.NOT_RECEIVING,
    ]);
  });

  it('says when the last email came, or that none has', () => {
    const base = { receivingState: MailboxReceivingState.RECEIVING, lastFinishedTestAt: null };
    expect(receivingStateLine({ ...base, lastEmailAt: null })).toBe('No email yet');
    expect(receivingStateLine({ ...base, lastEmailAt: AT })).toMatch(/^Last email /);
  });

  it('names the failed test when nothing is received', () => {
    const mailbox = { receivingState: MailboxReceivingState.NOT_RECEIVING, lastEmailAt: AT, lastFinishedTestAt: AT };
    expect(receivingStateLine(mailbox)).toMatch(/^Last test failed /);
    expect(receivingStateDetailLine(mailbox)).toMatch(/^Last test failed: /);
  });

  it('reads QUIET as a quiet mailbox whose test passed', () => {
    expect(receivingStateDetailLine({ receivingState: MailboxReceivingState.QUIET, lastFinishedTestAt: AT })).toMatch(
      /^Nothing for 3 days · Test passed /,
    );
  });
});

describe('replyStateLine', () => {
  it('has no line while replies leave as the mailbox, and says why they are off otherwise', () => {
    expect(replyStateLine(MailboxReplyState.AS_MAILBOX)).toBeNull();
    expect(replyStateLine(MailboxReplyState.NOT_SIGNED_IN)).toMatch(/off/);
    expect(replyStateLine(MailboxReplyState.CANNOT_SEND_AS_MAILBOX)).toMatch(/off/);
  });
});
