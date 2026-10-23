'use client';
'use no memo';

import { PlusCircleIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Alert, Button, RadioGroupBlock } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Controller, type UseFormReturn, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { NO_ITEMS } from '@/app/components/shared';
import { knownValue } from '@/lib/exhaustive-map';
import { ruleKindLabel, ruleKindPlural, ruleKindsFor } from '../../utils/tenant-presentation';
import { AttributionCustomerCard } from './attribution-customer-card';
import type { StoredAttribution } from './attribution-helpers';
import {
  ATTRIBUTION_DEFAULT_VALUES,
  ATTRIBUTION_MODE,
  type AttributionFormData,
  type AttributionMode,
  newRule,
} from './attribution.types';
import type { CustomerOption } from './customer-option';
import { CustomerSelect } from './customer-select';

// "Customers and attribution" (Figma 3126-14295, 3562-27470 → 27507): one customer that owns the
// whole directory, or several that share it, each claiming its accounts with rules.

const SOLE_DESCRIPTION =
  'Every account is theirs by definition. Nothing is stored, so there is no rule to fall out of step with the directory.';

/** Words listed in a sentence: "domain, group or org unit". */
function inProse(words: readonly string[], conjunction: 'or' | 'and'): string {
  return `${words.slice(0, -1).join(', ')} ${conjunction} ${words.at(-1)}`;
}

/** Figma's copy, less "a customer with no rule sees the whole directory": the API accepts no such customer. */
function sharedDescription(provider: string): string {
  const kinds = inProse(
    ruleKindsFor(provider).map(kind => ruleKindLabel(kind).toLowerCase()),
    'or',
  );
  return `Bind each one, then claim their accounts by ${kinds}. Every customer needs a rule, and anyone no rule claims is reported as unattributed rather than assigned to someone.`;
}

function sharedUnavailable(provider: string): string {
  const kinds = inProse(ruleKindsFor(provider).map(ruleKindPlural), 'and');
  return `Available once OpenFrame can read this directory: a rule's ${kinds} come from it.`;
}

/**
 * The shared option's line names the provider's kinds, so it waits for the provider: `null` draws a bar in the
 * loading block (every render without a provider is one) rather than Microsoft's kinds on a Google tenant.
 */
function sharedOptionDescription(provider: string | null, readable: boolean): string | null {
  if (provider == null) return null;
  return readable ? sharedDescription(provider) : sharedUnavailable(provider);
}

function modeOptions(provider: string | null, readable: boolean) {
  return [
    { value: ATTRIBUTION_MODE.SOLE, label: 'One customer owns this tenant', description: SOLE_DESCRIPTION },
    {
      value: ATTRIBUTION_MODE.SHARED,
      label: 'Several customers share this directory',
      description: sharedOptionDescription(provider, readable),
      disabled: !readable,
    },
  ];
}

/** The API refuses an archived customer (`CUSTOMER_NOT_FOUND`), so a save of the set drops its binding. */
function archivedMessage(archived: StoredAttribution['archived']): string {
  const names = archived.map(customer => customer.name ?? 'A deleted customer').join(', ');
  return archived.length === 1
    ? `${names} is no longer an active customer, so it can't be edited here. Saving a change to this tenant's customers removes it.`
    : `${names} are no longer active customers, so they can't be edited here. Saving a change to this tenant's customers removes them.`;
}

interface SharedCustomersProps {
  form: UseFormReturn<AttributionFormData>;
  connectionId: string;
  provider: string | null;
  options: ReadonlyMap<string, CustomerOption>;
  locked: boolean;
  /** Locked or writing: every control inert. */
  disabled: boolean;
}

function SharedCustomers({ form, connectionId, provider, options, locked, disabled }: SharedCustomersProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'customers' });
  const customers = useWatch({ control: form.control, name: 'customers' });

  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)]">
      {fields.map((field, index) => (
        <AttributionCustomerCard
          key={field.id}
          form={form}
          index={index}
          connectionId={connectionId}
          provider={provider}
          options={options}
          exclude={customers.flatMap((customer, other) =>
            other !== index && customer.organizationId ? [customer.organizationId] : [],
          )}
          onRemove={fields.length > 1 ? () => remove(index) : undefined}
          locked={locked}
          disabled={disabled}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="small"
        leftIcon={<PlusCircleIcon className="text-ods-text-secondary" />}
        className="self-start"
        onClick={() => append({ organizationId: '', rules: [newRule()] })}
        disabled={disabled}
      >
        Add Customer
      </Button>
    </div>
  );
}

interface AttributionFieldsProps {
  form: UseFormReturn<AttributionFormData>;
  /** `null` before the record is read. */
  connectionId: string | null;
  provider: string | null;
  /** The directory has been read: a rule's values can be listed, so a shared directory can be split. */
  readable: boolean;
  /** The block waits (Connect and Reconnect before consent, Edit before its record): drawn, inert, reading nothing. */
  locked?: boolean;
  /** A write is in flight: every control inert. */
  busy?: boolean;
  stored?: Pick<StoredAttribution, 'archived' | 'options'>;
}

const NO_OPTIONS: ReadonlyMap<string, CustomerOption> = new Map();

export function AttributionFields({
  form,
  connectionId,
  provider,
  readable,
  locked = false,
  busy = false,
  stored,
}: AttributionFieldsProps) {
  const mode = useWatch({ control: form.control, name: 'mode' });
  const options = stored?.options ?? NO_OPTIONS;
  const archived = stored?.archived ?? NO_ITEMS;
  const inert = locked || busy;

  // The other mode keeps what was typed there; switching only carries the customer across when the target is empty.
  const switchMode = (next: string, onChange: (value: AttributionMode) => void) => {
    const target = knownValue(ATTRIBUTION_MODE, next) ?? ATTRIBUTION_MODE.SOLE;
    if (target === ATTRIBUTION_MODE.SHARED && form.getValues('customers').length === 0) {
      form.setValue('customers', [{ organizationId: form.getValues('soleCustomerId'), rules: [newRule()] }]);
    }
    if (target === ATTRIBUTION_MODE.SOLE && !form.getValues('soleCustomerId')) {
      form.setValue('soleCustomerId', form.getValues('customers')[0]?.organizationId ?? '');
    }
    onChange(target);
  };

  return (
    <section className="flex flex-col gap-[var(--spacing-system-lf)]" aria-label="Customers and attribution">
      <div className={locked ? 'flex flex-col opacity-50' : 'flex flex-col'}>
        <h3 className="text-ods-text-primary text-h3">Customers and attribution</h3>
        <p className="text-ods-text-secondary text-h6">
          Choose which customers this directory serves and the rule that claims their accounts.
        </p>
      </div>
      <Controller
        name="mode"
        control={form.control}
        render={({ field }) => (
          <RadioGroupBlock
            name={field.name}
            value={field.value}
            onValueChange={next => switchMode(next, field.onChange)}
            options={modeOptions(provider, readable)}
            variant="grouped"
            disabled={inert}
            aria-label="Customers and attribution"
          />
        )}
      />
      {mode === ATTRIBUTION_MODE.SHARED && connectionId ? (
        <SharedCustomers
          form={form}
          connectionId={connectionId}
          provider={provider}
          options={options}
          locked={locked}
          disabled={inert}
        />
      ) : (
        <Controller
          name="soleCustomerId"
          control={form.control}
          render={({ field, fieldState }) => (
            <CustomerSelect
              value={field.value}
              onChange={field.onChange}
              includeOrganization={options.get(field.value)}
              enabled={!locked}
              disabled={inert}
              error={fieldState.error?.message}
              invalid={!!fieldState.error}
            />
          )}
        />
      )}
      {archived.length > 0 && (
        <Alert variant="warning" className="p-[var(--spacing-system-s)]" role="status">
          <p className="text-h4">{archivedMessage(archived)}</p>
        </Alert>
      )}
    </section>
  );
}

/** The block before its record is read: the same markup, locked, over a throwaway form. */
export function PendingAttributionFields() {
  const form = useForm<AttributionFormData>({ defaultValues: ATTRIBUTION_DEFAULT_VALUES });
  return <AttributionFields form={form} connectionId={null} provider={null} readable={false} locked />;
}
