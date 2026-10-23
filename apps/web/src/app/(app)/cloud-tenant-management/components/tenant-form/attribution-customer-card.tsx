'use client';
'use no memo';

import { PlusCircleIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { Controller, type UseFormReturn, useFieldArray, useWatch } from 'react-hook-form';
import { DirectoryRuleKind } from '@/generated/schema-enums';
import { ruleKindLabel, ruleKindsFor } from '../../utils/tenant-presentation';
import { valuesClaimedElsewhere } from './attribution-helpers';
import { type AttributionFormData, newRule } from './attribution.types';
import type { PickerCustomer } from './customer-option';
import { CustomerSelect } from './customer-select';
import { RuleValuesField } from './rule-values-field';

// One customer of a shared directory (Figma 3562-27507): its picker, then its rules — "Match by"
// and the values it claims. A user is the customer's when any of its rules claims them.

function RemoveButton({ label, onClick, disabled }: { label: string; onClick?: () => void; disabled: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      leftIcon={<TrashIcon />}
      className="shrink-0 [&_svg]:!text-ods-error"
      onClick={onClick}
      disabled={disabled || !onClick}
    />
  );
}

interface RuleRowProps {
  form: UseFormReturn<AttributionFormData>;
  customerIndex: number;
  ruleIndex: number;
  connectionId: string;
  provider: string | null;
  /** The first rule carries the column labels. */
  first: boolean;
  /** Absent for a customer's only rule: every customer needs one. */
  onRemove?: () => void;
  /** The block waits for its directory: the values are not read. */
  locked: boolean;
  /** Locked or writing: every control inert. */
  disabled: boolean;
}

function RuleRow({
  form,
  customerIndex,
  ruleIndex,
  connectionId,
  provider,
  first,
  onRemove,
  locked,
  disabled,
}: RuleRowProps) {
  const base = `customers.${customerIndex}.rules.${ruleIndex}` as const;
  const kind = useWatch({ control: form.control, name: `${base}.kind` });
  const customers = useWatch({ control: form.control, name: 'customers' });
  // `ALL` is not offered, but a stored one (a single customer can hold it beside other rules) must stay drawable.
  const kinds = ruleKindsFor(provider);
  const offered = kind === DirectoryRuleKind.ALL ? [...kinds, DirectoryRuleKind.ALL] : kinds;

  return (
    <div className="grid grid-cols-1 items-end gap-[var(--spacing-system-xsf)] content-md:grid-cols-2">
      <Controller
        name={`${base}.kind`}
        control={form.control}
        render={({ field, fieldState }) => (
          <Select
            value={field.value}
            onValueChange={next => {
              field.onChange(next);
              // A group id means nothing as a domain: the values start over with the kind, and so does their error.
              form.setValue(`${base}.values`, []);
              form.clearErrors(`${base}.values`);
            }}
            disabled={disabled}
          >
            <SelectTrigger
              label={first ? 'Match by' : undefined}
              labelVariant="large"
              aria-label="Match by"
              invalid={!!fieldState.error}
              error={fieldState.error?.message}
            >
              <SelectValue placeholder="Select Match by" />
            </SelectTrigger>
            <SelectContent>
              {offered.map(option => (
                <SelectItem key={option} value={option}>
                  {ruleKindLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <div className="flex items-end gap-[var(--spacing-system-xsf)]">
        <div className="min-w-0 flex-1">
          <Controller
            name={`${base}.values`}
            control={form.control}
            render={({ field, fieldState }) => (
              <RuleValuesField
                connectionId={connectionId}
                kind={kind}
                value={field.value}
                onChange={field.onChange}
                label={first ? 'Values' : undefined}
                error={fieldState.error?.message}
                exclude={valuesClaimedElsewhere(customers, customerIndex, ruleIndex, kind)}
                locked={locked}
                disabled={disabled}
              />
            )}
          />
        </div>
        <RemoveButton label="Remove rule" onClick={onRemove} disabled={disabled} />
      </div>
    </div>
  );
}

interface AttributionCustomerCardProps {
  form: UseFormReturn<AttributionFormData>;
  index: number;
  connectionId: string;
  provider: string | null;
  /** The stored customers' options, so a picker names its customer before its list reaches it. */
  options: ReadonlyMap<string, PickerCustomer>;
  /** The customers the other cards picked. */
  exclude: readonly string[];
  /** Absent for the only card: a shared directory serves at least one customer. */
  onRemove?: () => void;
  /** The block waits for its directory: the picker and the values read nothing. */
  locked: boolean;
  /** Locked or writing: every control inert. */
  disabled: boolean;
}

export function AttributionCustomerCard({
  form,
  index,
  connectionId,
  provider,
  options,
  exclude,
  onRemove,
  locked,
  disabled,
}: AttributionCustomerCardProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: `customers.${index}.rules` });

  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-l)]">
      <div className="flex items-end gap-[var(--spacing-system-xsf)]">
        <div className="min-w-0 flex-1">
          <Controller
            name={`customers.${index}.organizationId`}
            control={form.control}
            render={({ field, fieldState }) => (
              <CustomerSelect
                label="Customer"
                value={field.value}
                onChange={field.onChange}
                includeOrganization={options.get(field.value)}
                exclude={exclude}
                enabled={!locked}
                disabled={disabled}
                error={fieldState.error?.message}
                invalid={!!fieldState.error}
              />
            )}
          />
        </div>
        <RemoveButton label="Remove customer" onClick={onRemove} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <span className="text-ods-text-secondary text-h5">Rules</span>
        <div className="flex flex-col gap-[var(--spacing-system-xsf)] rounded-md border border-ods-border p-[var(--spacing-system-m)]">
          {fields.map((rule, ruleIndex) => (
            <RuleRow
              key={rule.id}
              form={form}
              customerIndex={index}
              ruleIndex={ruleIndex}
              connectionId={connectionId}
              provider={provider}
              first={ruleIndex === 0}
              onRemove={fields.length > 1 ? () => remove(ruleIndex) : undefined}
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
            onClick={() => append(newRule())}
            disabled={disabled}
          >
            Add Rule
          </Button>
        </div>
      </div>
    </div>
  );
}
