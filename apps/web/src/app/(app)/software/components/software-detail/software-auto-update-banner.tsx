'use client';

import { InfoCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { graphql, useFragment, useMutation } from 'react-relay';
import type { softwareAutoUpdateBanner_software$key } from '@/__generated__/softwareAutoUpdateBanner_software.graphql';
import type { softwareAutoUpdateBannerTurnOffMutation as TurnOffMutationType } from '@/__generated__/softwareAutoUpdateBannerTurnOffMutation.graphql';
import { SoftwareAutoUpdateStatus } from '@/generated/schema-enums';
import { getRelayErrorMessage } from '@/lib/handle-api-error';

const softwareAutoUpdateBannerFragment = graphql`
  fragment softwareAutoUpdateBanner_software on Software {
    id
    name
    autoUpdate
  }
`;

/** Returns the title's new state, so the banner and the AUTO-UPDATE cells read it from the store. */
const softwareAutoUpdateBannerTurnOffMutation = graphql`
  mutation softwareAutoUpdateBannerTurnOffMutation($softwareId: ID!) {
    turnOffSoftwareAutoUpdate(softwareId: $softwareId) {
      id
      autoUpdate
    }
  }
`;

/**
 * "Auto-Update Enabled" over the software's card (design 1562:59149): new versions of the title are installed as they
 * come out, until it is turned off here.
 *
 * Only the enabled half of the design. Its "Settings" opens a page that loads and edits the title's auto-update
 * policy, and the API has neither; and the "Disabled" banner asks to turn auto-update on, which only an update started
 * from this page could do (a policy counts for the title only through the `softwareId` that update carries), and the
 * API cannot tell this page which package the title is.
 */
export function SoftwareAutoUpdateBanner({ software }: { software: softwareAutoUpdateBanner_software$key }) {
  const data = useFragment(softwareAutoUpdateBannerFragment, software);
  const { toast } = useToast();
  const [commitTurnOff, isTurningOff] = useMutation<TurnOffMutationType>(softwareAutoUpdateBannerTurnOffMutation);

  if (data.autoUpdate !== SoftwareAutoUpdateStatus.ON) return null;

  const turnOff = () =>
    commitTurnOff({
      variables: { softwareId: data.id },
      onCompleted: () => {
        toast({
          title: 'Auto-update turned off',
          description: `${data.name} updates only when you run Update Software.`,
          variant: 'success',
        });
      },
      onError: error => {
        toast({
          title: 'Error',
          description: getRelayErrorMessage(error, 'Failed to turn off auto-update'),
          variant: 'destructive',
        });
      },
    });

  return (
    <div className="flex flex-col gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)] content-md:flex-row content-md:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-[var(--spacing-system-m)]">
        <InfoCircleIcon className="size-6 shrink-0 text-ods-text-secondary" />
        <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
          <p className="text-ods-text-primary text-h3">Auto-Update Enabled</p>
          <p className="text-ods-text-secondary text-h6">
            Installs new versions of {data.name} automatically on the devices it was turned on for.
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        onClick={turnOff}
        loading={isTurningOff}
        disabled={isTurningOff}
        className="shrink-0 self-start content-md:self-auto"
      >
        Turn Off Auto-Update
      </Button>
    </div>
  );
}
