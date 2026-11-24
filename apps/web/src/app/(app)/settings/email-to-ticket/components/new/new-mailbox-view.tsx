'use client';

import { Button, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useState } from 'react';
import { MailboxProvider } from '@/generated/schema-enums';
import { IdentityFields, supportAddressSchema } from './identity-fields';
import { GENERATE_LABEL, NewMailboxFrame } from './new-mailbox-frame';
import { useGenerateMailbox } from './use-generate-mailbox';

/**
 * `/settings/email-to-ticket/new` before a mailbox exists (Figma 4527-132679): provider, address, Generate. In a
 * loading scope (the flag's window) every control is drawn, locked.
 */
export function NewMailboxForm() {
  const loading = useLoadingScope();
  const [provider, setProvider] = useState<MailboxProvider>(MailboxProvider.MICROSOFT_365);
  const [address, setAddress] = useState('');
  const { generate, isGenerating } = useGenerateMailbox();
  const valid = supportAddressSchema.safeParse(address).success;
  return (
    <NewMailboxFrame>
      <IdentityFields
        provider={provider}
        onProviderChange={setProvider}
        address={address}
        onAddressChange={setAddress}
        disabled={loading || isGenerating}
      />
      <div>
        <Button
          variant="accent"
          onClick={() => generate({ provider, supportAddress: address.trim() })}
          disabled={loading || !valid}
          loading={isGenerating}
          className="w-full content-md:w-auto"
        >
          {GENERATE_LABEL}
        </Button>
      </div>
    </NewMailboxFrame>
  );
}
