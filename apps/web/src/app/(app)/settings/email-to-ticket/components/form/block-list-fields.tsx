'use client';
'use no memo';

import { PlusCircleIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Input, Label } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type Control, Controller, useFieldArray } from 'react-hook-form';
import { BlockListHeading } from '../block-list/block-list-heading';
import type { MailboxSettingsFormData } from './mailbox-defaults';

interface BlockListFieldsProps {
  control: Control<MailboxSettingsFormData>;
  disabled?: boolean;
}

/**
 * Block List (Figma settings 6236-120500, 6236-120311): the addresses and domains whose emails are dropped, one input
 * per sender with its trash button, and Add Sender below. Blank rows are dropped on save; a value the server refuses is
 * marked on its row.
 */
export function BlockListFields({ control, disabled = false }: BlockListFieldsProps) {
  const { fields, append, remove } = useFieldArray({ control, name: 'blockList' });
  return (
    <section className="flex flex-col gap-[var(--spacing-system-m)]">
      <BlockListHeading />
      {fields.length > 0 && (
        <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
          <Label variant="large">Email or Domain</Label>
          {fields.map((row, index) => (
            <Controller
              key={row.id}
              name={`blockList.${index}.value`}
              control={control}
              render={({ field, fieldState: { error } }) => (
                // The message hangs below its field (FieldWrapper): a row that has one keeps clear of the next row.
                <div
                  className={cn(
                    'flex items-start gap-[var(--spacing-system-xsf)]',
                    error && 'pb-[var(--spacing-system-lf)]',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <Input
                      // The ref lets Add Sender put the cursor in the row it adds.
                      ref={field.ref}
                      aria-label={`Email or domain ${index + 1}`}
                      placeholder="name@example.com or example.com"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      disabled={disabled}
                      invalid={!!error}
                      error={error?.message}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Remove sender"
                    leftIcon={<TrashIcon />}
                    className="shrink-0 [&_svg]:!text-ods-error"
                    onClick={() => remove(index)}
                    disabled={disabled}
                  />
                </div>
              )}
            />
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        leftIcon={<PlusCircleIcon className="text-ods-text-secondary" />}
        className="self-start"
        onClick={() => append({ value: '' })}
        disabled={disabled}
      >
        Add Sender
      </Button>
    </section>
  );
}
