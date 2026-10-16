/** A refusal as `inviteUsers` reports it: `field` is `["emails", "<index>"]`. */
interface InviteRefusal {
  readonly field: readonly string[] | null | undefined;
  readonly message: string;
}

/** The submitted emails `inviteUsers` refused, by their index in the submitted list. */
export function refusedEmailIndexes(refusals: readonly InviteRefusal[]): Set<number> {
  return new Set(refusals.map(({ field }) => Number(field?.[1])).filter(Number.isInteger));
}

/**
 * The toast text for the emails `inviteUsers` refused — each one by address with
 * its reason — or null when every invitation was sent.
 */
export function describeInviteRefusals(emails: readonly string[], refusals: readonly InviteRefusal[]): string | null {
  if (refusals.length === 0) return null;
  const lines = refusals.map(({ field, message }) => {
    const email = emails[Number(field?.[1])];
    return email ? `${email}: ${message}` : message;
  });
  return `Not sent: ${lines.join('; ')}`;
}
