/**
 * The address a row shows for a customer: the first of its contacts that
 * actually has one. Takes the addresses, not the contacts, so every caller's
 * query visibly selects `email`.
 */
export function customerContactEmail(
  emails: ReadonlyArray<string | null | undefined> | null | undefined,
): string | undefined {
  return emails?.find(email => !!email) ?? undefined;
}
