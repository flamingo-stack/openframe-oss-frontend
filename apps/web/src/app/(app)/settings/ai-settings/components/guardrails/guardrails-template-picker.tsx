'use client';

import { ActionsMenuDropdown, Button, RadioGroupBlock } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
import { Filter03HrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';

export interface GuardrailsTemplateOption {
  id: string;
  label: string;
  description?: string;
  isCustom: boolean;
}

interface GuardrailsTemplatePickerProps {
  /** Unread while loading. */
  options?: GuardrailsTemplateOption[];
  value: string;
  disabled?: boolean;
  onSelect: (templateId: string) => void;
  /** "Use for Custom Policy" on a stock template row. */
  onCreateCustomPolicyFrom: (baseTemplateId: string) => void;
}

/** The loading list's size: the templates arrive at once (not paged), so this is a typical count. */
const GUARDRAILS_TEMPLATES_SKELETON_ROWS = 3;

/**
 * The picker while the templates are on their way, as the lib's grouped `RadioGroupBlock` draws its rows (it has no
 * skeleton of its own): one bordered group, a radio dot, the name and the description.
 */
export function GuardrailsTemplatePickerSkeleton() {
  return (
    <div className="flex w-full flex-col overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
      {Array.from({ length: GUARDRAILS_TEMPLATES_SKELETON_ROWS }, (_, index) => (
        <div
          key={index}
          data-loading-item
          className="flex w-full items-center gap-3 border-ods-border bg-ods-card px-[var(--spacing-system-sf)] py-[var(--spacing-system-xs,8px)] [&:not(:last-child)]:border-b"
        >
          <UnifiedSkeleton className="h-6 w-6 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <TextLineSkeleton type="h4" className="w-1/3" />
            <TextLineSkeleton type="h6" className="w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Edit-mode template chooser: one radio per template, stock rows offer "Use for Custom Policy". */
export function GuardrailsTemplatePicker({
  options,
  value,
  disabled,
  onSelect,
  onCreateCustomPolicyFrom,
}: GuardrailsTemplatePickerProps) {
  if (useLoadingScope() || options == null) return <GuardrailsTemplatePickerSkeleton />;
  return (
    <RadioGroupBlock
      name="policy-template"
      variant="grouped"
      value={value}
      onValueChange={onSelect}
      disabled={disabled}
      options={options.map(option => ({
        value: option.id,
        label: option.label,
        description: option.description,
        trailing: !option.isCustom ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onCreateCustomPolicyFrom(option.id);
              }}
              className="hidden h-auto gap-[var(--spacing-system-xsf)] border-ods-border bg-ods-card !px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] text-ods-text-primary !text-h3 hover:bg-ods-bg-hover content-md:inline-flex [&_svg]:!size-6"
              leftIcon={<Filter03HrIcon className="text-ods-text-secondary" />}
              disabled={disabled}
            >
              Use for Custom Policy
            </Button>
            {/* Mobile: collapsed into an ellipsis actions menu. preventDefault
                stops the wrapping radio label from selecting the option. */}
            <div
              className="content-md:hidden"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <ActionsMenuDropdown
                triggerAriaLabel={`Actions for ${option.label}`}
                groups={[
                  {
                    items: [
                      {
                        id: 'use-for-custom-policy',
                        label: 'Use for Custom Policy',
                        icon: <Filter03HrIcon className="text-ods-text-secondary" />,
                        onClick: () => onCreateCustomPolicyFrom(option.id),
                        disabled,
                      },
                    ],
                  },
                ]}
              />
            </div>
          </>
        ) : undefined,
      }))}
    />
  );
}
