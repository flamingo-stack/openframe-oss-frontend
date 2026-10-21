'use client';

import { ActionsMenuDropdown, Button, RadioGroupBlock } from '@flamingo-stack/openframe-frontend-core';
import { Filter03HrIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  RADIO_GROUP_BLOCK_SKELETON_OPTIONS,
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';

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

/** The "Use for Custom Policy" button's classes: one box, drawn by a stock row and by a loading row. */
const CUSTOM_POLICY_BUTTON_CLASS =
  'hidden h-auto gap-[var(--spacing-system-xsf)] border-ods-border bg-ods-card !px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] text-ods-text-primary !text-h3 hover:bg-ods-bg-hover content-md:inline-flex [&_svg]:!size-6';

/**
 * A row while the templates are read (the lib's typical option count; the templates are not paged): a null label and
 * description, which the block draws as its own bars, and the stock row's button for real but inert (static copy), so the row has its loaded height.
 */
const LOADING_OPTIONS = Array.from({ length: RADIO_GROUP_BLOCK_SKELETON_OPTIONS }, (_, index) => ({
  value: `loading-${index}`,
  label: null,
  description: null,
  trailing: (
    <Button
      type="button"
      variant="outline"
      className={CUSTOM_POLICY_BUTTON_CLASS}
      leftIcon={<Filter03HrIcon className="text-ods-text-secondary" />}
      disabled
    >
      Use for Custom Policy
    </Button>
  ),
}));

/**
 * Edit-mode template chooser: one radio per template, stock rows offer "Use for Custom Policy". While the templates are
 * on their way (or in a loading scope) the lib's `RadioGroupBlock` draws its own skeleton rows.
 */
export function GuardrailsTemplatePicker({
  options,
  value,
  disabled,
  onSelect,
  onCreateCustomPolicyFrom,
}: GuardrailsTemplatePickerProps) {
  const loading = useLoadingScope() || options == null;
  return (
    <RadioGroupBlock
      name="policy-template"
      variant="grouped"
      value={value}
      onValueChange={onSelect}
      disabled={disabled}
      loading={loading}
      options={
        loading || options == null
          ? LOADING_OPTIONS
          : options.map(option => ({
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
                    className={CUSTOM_POLICY_BUTTON_CLASS}
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
            }))
      }
    />
  );
}
