'use client';

import { ActionsMenuDropdown, Button, RadioGroupBlock } from '@flamingo-stack/openframe-frontend-core';
import { TextLineSkeleton } from '@flamingo-stack/openframe-frontend-core/components';
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

/** The "Use for Custom Policy" button: one box, drawn by a stock row and (inert) by a loading row. */
function CustomPolicyButton({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={
        onClick &&
        (e => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        })
      }
      className="hidden h-auto gap-[var(--spacing-system-xsf)] border-ods-border bg-ods-card !px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] text-ods-text-primary !text-h3 hover:bg-ods-bg-hover content-md:ml-[var(--spacing-system-s)] content-md:inline-flex [&_svg]:!size-6"
      leftIcon={<Filter03HrIcon className="text-ods-text-secondary" />}
      disabled={disabled}
    >
      Use for Custom Policy
    </Button>
  );
}

/** The stock templates the catalog ships (Autonomous, Balanced, Permissive, Restrictive): the picker's loading rows. */
const STOCK_TEMPLATE_COUNT = 4;
/** A stock template's description runs two lines on a desktop row (Figma 4365-22636). */
const DESCRIPTION_SKELETON_LINES = 2;

/**
 * A row while the templates are read: a null label, which the block draws as its own bar, two description lines, and
 * the stock row's button for real but inert (static copy), so each row has a stock row's loaded height (112px).
 */
const LOADING_OPTIONS = Array.from({ length: STOCK_TEMPLATE_COUNT }, (_, index) => ({
  value: `loading-${index}`,
  label: null,
  description: <TextLineSkeleton as="span" type="inherit" lines={DESCRIPTION_SKELETON_LINES} />,
  trailing: <CustomPolicyButton disabled />,
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
      // The settings design's policy rows: 24px around each (12 on a phone), the radio level with the name
      // (Figma 4365-22636 / 4365-22414).
      itemClassName="items-start p-[var(--spacing-system-sf)] content-md:p-[var(--spacing-system-lf)]"
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
                  <CustomPolicyButton onClick={() => onCreateCustomPolicyFrom(option.id)} disabled={disabled} />
                  {/* Mobile: collapsed into an ellipsis actions menu. preventDefault
                stops the wrapping radio label from selecting the option. */}
                  <div
                    // The phone's menu button sits at the row's top, beside the name (Figma 4365-22419).
                    className="self-start content-md:hidden"
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
              ) : (
                // The custom row has no action, but its text wraps at the same column as the stock rows': an unseen,
                // inert copy of their button holds that width (desktop only, where the button shows).
                <span aria-hidden className="invisible">
                  <CustomPolicyButton disabled />
                </span>
              ),
            }))
      }
    />
  );
}
