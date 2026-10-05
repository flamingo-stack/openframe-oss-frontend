'use client';

import { EntityImage, TruncateText } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { graphql, useFragment } from 'react-relay';
import type { softwareLogCustomerCell_machine$key } from '@/__generated__/softwareLogCustomerCell_machine.graphql';
import { customerContactEmail } from '@/app/(app)/customers/utils/customer-contact-email';
import { ValueText } from '@/app/components/shared';
import { getFullImageUrl } from '@/lib/image-url';

const softwareLogCustomerCellFragment = graphql`
  fragment softwareLogCustomerCell_machine on Machine {
    organization {
      name
      image {
        imageUrl
        hash
      }
      contactInformation {
        contacts {
          email
        }
      }
    }
  }
`;

/** CUSTOMER column: the device's customer — logo, name, and a contact address. */
export function SoftwareLogCustomerCell({
  machine,
}: {
  machine: softwareLogCustomerCell_machine$key | null | undefined;
}) {
  const data = useFragment(softwareLogCustomerCellFragment, machine);
  const organization = data?.organization;

  if (!organization?.name) return <ValueText value={null} />;

  const email = customerContactEmail(organization.contactInformation?.contacts?.map(contact => contact?.email));

  return (
    <div className="flex min-w-0 items-center gap-[var(--spacing-system-mf)]">
      <EntityImage
        src={getFullImageUrl(organization.image?.imageUrl, organization.image?.hash)}
        alt={organization.name}
        sizeClassName="size-12"
        className="rounded-[4px]"
      />
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <TruncateText>{organization.name}</TruncateText>
        {email && (
          <TruncateText variant="h6" tone="secondary">
            {email}
          </TruncateText>
        )}
      </div>
    </div>
  );
}
