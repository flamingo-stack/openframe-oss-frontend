import { OpenframeLogoIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';

/** The compact logo + wordmark of the Fae window (sidebar, onboarding): openframe-chat `OpenFrameMark`. */
export function OpenFrameMark() {
  return (
    <span className="flex items-center gap-[var(--spacing-system-xxs)] text-ods-text-primary">
      <OpenframeLogoIcon
        className="size-6"
        color="var(--color-text-primary)"
        secondaryColor="var(--ods-open-yellow-base)"
      />
      <span className="text-wordmark">OpenFrame</span>
    </span>
  );
}
