import { CheckIcon, Chevron02RightIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { type ActionsMenuItem, Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useEffect } from 'react';

export interface MingoChatModelSelectorProps {
  items: ActionsMenuItem[];
  disabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MENU_FRAME =
  'z-[1500] max-h-[var(--radix-popper-available-height)] w-64 min-w-0 max-w-[calc((100vw_-_var(--spacing-system-xlf))/2)] overflow-y-auto rounded-md border border-ods-border bg-ods-bg text-ods-text-primary';
const MENU_ROW =
  'flex w-full cursor-pointer items-center gap-[var(--spacing-system-xs)] border-b border-ods-border p-[var(--spacing-system-s)] text-h4 font-medium outline-none last:border-b-0 data-[highlighted]:bg-ods-bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-60';

function ModelMenuItems({ items }: { items: ActionsMenuItem[] }) {
  return (
    <DropdownMenu.RadioGroup value={items.find(item => item.checked)?.id ?? ''}>
      {items.map(item =>
        item.submenu ? (
          <DropdownMenu.Sub key={item.id}>
            <DropdownMenu.SubTrigger disabled={item.disabled} className={MENU_ROW}>
              <span className="min-w-0 flex-1 break-words">{item.label}</span>
              <Chevron02RightIcon className="h-5 w-5" aria-hidden />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal container={typeof document === 'undefined' ? undefined : document.body}>
              <DropdownMenu.SubContent sideOffset={4} collisionPadding={8} className={MENU_FRAME}>
                <ModelMenuItems items={item.submenu} />
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        ) : (
          <DropdownMenu.RadioItem
            key={item.id}
            value={item.id}
            disabled={item.disabled}
            className={MENU_ROW}
            onSelect={() => item.onClick?.()}
          >
            <span className="min-w-0 flex-1 break-words">{item.label}</span>
            <DropdownMenu.ItemIndicator>
              <CheckIcon className="h-5 w-5 text-ods-accent" aria-hidden />
            </DropdownMenu.ItemIndicator>
          </DropdownMenu.RadioItem>
        ),
      )}
    </DropdownMenu.RadioGroup>
  );
}

/** Uses registered radio items and viewport portals for the model menu in every chat layout. */
export function MingoChatModelSelector({ items, disabled, open, onOpenChange }: MingoChatModelSelectorProps) {
  useEffect(() => {
    if (disabled && open) onOpenChange(false);
  }, [disabled, open, onOpenChange]);
  return (
    <DropdownMenu.Root open={open && !disabled} onOpenChange={onOpenChange} modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="transparent" size="compact" disabled={disabled} aria-label="Change chat model">
          Chat Model
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={typeof document === 'undefined' ? undefined : document.body}>
        <DropdownMenu.Content side="top" align="end" sideOffset={6} collisionPadding={8} className={MENU_FRAME}>
          <ModelMenuItems items={items} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
