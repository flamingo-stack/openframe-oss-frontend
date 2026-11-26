import { Card } from '@flamingo-stack/openframe-frontend-core/components/ui';

/** No exception on the check: a card saying every device runs on the default. */
export function NoExceptions() {
  return (
    <Card variant="panel" className="flex flex-col gap-[var(--spacing-system-xxs)] p-[var(--spacing-system-l)]">
      <p className="text-ods-text-primary text-h3">No exceptions</p>
      <p className="text-ods-text-secondary text-h6">Every device uses the default threshold.</p>
    </Card>
  );
}
