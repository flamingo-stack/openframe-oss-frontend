'use client';

import { NamedIcon } from '@flamingo-stack/openframe-frontend-core/components';
import {
  AnthropicLogoGreyIcon,
  CheckFillIcon,
  Chevron02DownIcon,
  GeminiLogoGreyIcon,
  OpenaiLogoGreyIcon,
  ShieldCheckIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { LLM_PROVIDER_ICON, LLM_PROVIDER_LABEL } from '@/app/(app)/settings/ai-settings/utils/ai-settings-display';
import type { MingoModelPickerState } from './use-mingo-model-selection';

type ProviderSelection = MingoModelPickerState['providers'][number];

const menuClassName = 'rounded-md border-ods-border bg-ods-menu p-0 shadow-none';
const menuTopInset = 64;

function ModelProviderLogo({ provider }: { provider: string | undefined }) {
  switch (provider?.toLowerCase()) {
    case 'anthropic':
    case 'claude':
      return <AnthropicLogoGreyIcon size={20} className="shrink-0" />;
    case 'openai':
      return <OpenaiLogoGreyIcon size={20} className="shrink-0" />;
    case 'google':
    case 'gemini':
    case 'google-gemini':
    case 'google_gemini':
      return <GeminiLogoGreyIcon size={20} className="shrink-0" />;
    default:
      return null;
  }
}

function ProviderModels({
  selection,
  providerMenu,
}: {
  selection: ProviderSelection;
  providerMenu: RefObject<HTMLDivElement | null>;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ alignOffset: 0, maxHeight: 0 });
  const trigger = useRef<HTMLDivElement>(null);
  const [submenu, setSubmenu] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const menu = providerMenu.current;
    const row = trigger.current;
    const content = submenu;
    if (!open || !menu || !row || !content) return undefined;

    // Radix anchors a submenu to its row. Fit the list above the provider
    // menu's bottom edge so its footer stays aligned as the list gets longer.
    const alignToProviderMenu = () => {
      const bottom = menu.getBoundingClientRect().bottom;
      const maxHeight = Math.max(0, Math.floor(bottom - menuTopInset));
      const height = Math.min(content.offsetHeight, maxHeight);
      const alignOffset = Math.round(bottom - row.getBoundingClientRect().top - height);
      setPlacement(previous =>
        previous.alignOffset === alignOffset && previous.maxHeight === maxHeight
          ? previous
          : { alignOffset, maxHeight },
      );
    };

    alignToProviderMenu();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(alignToProviderMenu);
    observer?.observe(menu);
    observer?.observe(content);
    window.addEventListener('resize', alignToProviderMenu);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', alignToProviderMenu);
    };
  }, [open, providerMenu, submenu]);

  const { provider, current, models } = selection;
  return (
    <DropdownMenuSub open={open} onOpenChange={setOpen}>
      <DropdownMenuSubTrigger
        ref={trigger}
        aria-current={current || undefined}
        className="min-h-10 gap-2 rounded-none px-3 normal-case text-h5 data-[state=open]:bg-[var(--ods-backgrounds-openframe-background-action)] [&_svg]:size-5"
      >
        <NamedIcon icon={LLM_PROVIDER_ICON[provider]} className="size-5" />
        <span className="flex-1">{LLM_PROVIDER_LABEL[provider]}</span>
        {current && <CheckFillIcon aria-hidden className="text-ods-accent" />}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        ref={setSubmenu}
        sideOffset={4}
        alignOffset={placement.alignOffset}
        collisionBoundary={[]}
        collisionPadding={{ top: menuTopInset, right: 12, bottom: 12, left: 12 }}
        className={`${menuClassName} flex w-[440px] max-w-[calc(100vw-24px)] flex-col overflow-hidden`}
        style={{
          maxHeight:
            placement.maxHeight > 0
              ? `min(${placement.maxHeight}px, var(--radix-popper-available-height))`
              : 'var(--radix-popper-available-height)',
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none]">
          {models.map(model => (
            <DropdownMenuItem
              key={model.id}
              role="menuitemradio"
              aria-checked={model.current}
              className="min-h-12 justify-between rounded-none border-b border-ods-border px-4 py-2 normal-case text-h5 last:border-b-0"
              onSelect={model.choose}
            >
              <span>{model.label}</span>
              {model.current && <CheckFillIcon aria-hidden className="text-ods-accent" />}
            </DropdownMenuItem>
          ))}
        </div>
        <div className="flex shrink-0 items-start gap-2 border-t border-ods-border px-4 py-3 text-xs text-ods-text-secondary">
          <ShieldCheckIcon aria-hidden size={16} className="shrink-0" />
          <p>
            Your chats aren’t used to train AI models. Model providers keep requests for up to 30 days, then delete
            them.
          </p>
        </div>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export function MingoModelPicker({
  name,
  provider,
  selection,
}: {
  name: string | undefined;
  provider: string | undefined;
  selection: MingoModelPickerState;
}) {
  const providerMenu = useRef<HTMLDivElement>(null);
  const label = name ?? 'Chat Model';
  const trigger = (
    <button
      type="button"
      aria-label={`Change chat model: ${label}`}
      disabled={selection.disabled}
      className="group inline-flex min-w-0 items-center gap-1.5 rounded-sm py-0.5 pl-1.5 pr-1 text-ods-text-secondary hover:bg-[var(--ods-backgrounds-openframe-background-hover)] hover:text-ods-text-primary focus-visible:outline-2 focus-visible:outline-ods-focus disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent data-[state=open]:bg-[var(--ods-backgrounds-openframe-background-action)] data-[state=open]:text-ods-text-primary"
    >
      <ModelProviderLogo provider={provider} />
      <span className="truncate font-body">{label}</span>
      <Chevron02DownIcon aria-hidden size={16} className="shrink-0 group-data-[state=open]:rotate-180" />
    </button>
  );

  if (selection.disabled) return trigger;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        ref={providerMenu}
        align="start"
        side="top"
        sideOffset={4}
        className={`${menuClassName} w-60`}
      >
        <DropdownMenuItem
          role="menuitemradio"
          aria-checked={selection.followsDefault}
          className="min-h-10 justify-between rounded-none px-3 hover:bg-ods-menu-hover focus:bg-ods-menu-hover"
          onSelect={selection.chooseDefault}
        >
          Use Default Model
          {selection.followsDefault && <CheckFillIcon aria-hidden className="text-ods-accent" />}
        </DropdownMenuItem>
        {selection.providers.length > 0 && <DropdownMenuSeparator className="m-0" />}
        {selection.providers.map(option => (
          <ProviderModels key={option.provider} selection={option} providerMenu={providerMenu} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
