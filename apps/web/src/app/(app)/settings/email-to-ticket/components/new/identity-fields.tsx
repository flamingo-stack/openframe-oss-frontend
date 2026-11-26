'use client';

import { Input, RadioGroupBlock } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { z } from 'zod';
import { MailboxProvider } from '@/generated/schema-enums';
import { knownValue } from '@/lib/exhaustive-map';
import { MAILBOX_PROVIDER_ORDER, mailboxProviderPresentation } from '../../utils/mailbox-presentation';

/** The address check of Generate: syntax only, as the API's (it trims and lower-cases on its side). */
export const supportAddressSchema = z.string().trim().email();

const PROVIDER_OPTIONS = MAILBOX_PROVIDER_ORDER.map(provider => {
  const { label, radioDescription } = mailboxProviderPresentation(provider);
  return { value: provider, label, description: radioDescription };
});

interface IdentityFieldsProps {
  provider: MailboxProvider;
  onProviderChange: (provider: MailboxProvider) => void;
  address: string;
  onAddressChange: (address: string) => void;
  disabled: boolean;
}

/** The provider radio and the Mailbox Address field (Figma 4527-132679). */
export function IdentityFields({
  provider,
  onProviderChange,
  address,
  onAddressChange,
  disabled,
}: IdentityFieldsProps) {
  return (
    <>
      <RadioGroupBlock
        name="provider"
        value={provider}
        onValueChange={value => {
          const next = knownValue(MailboxProvider, value);
          if (next) onProviderChange(next);
        }}
        options={PROVIDER_OPTIONS}
        variant="grouped"
        disabled={disabled}
        aria-label="Provider"
      />
      <Input
        label="Mailbox Address"
        labelVariant="large"
        type="email"
        placeholder="Enter Mailbox Address"
        value={address}
        onChange={event => onAddressChange(event.target.value)}
        disabled={disabled}
        autoComplete="off"
      />
    </>
  );
}
