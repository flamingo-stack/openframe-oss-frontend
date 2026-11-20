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

// Close immediately so a previous menu cannot restore focus into a newly opened one.
const menuClassName =
  'rounded-md border-[color:var(--ods-borders-default)] bg-ods-menu p-0 shadow-[0_8px_32px_rgba(0,0,0,0.5)] data-[state=closed]:hidden';
const menuTopInset = 64;
const menuEdgePadding = 12;
// Popper anchors to the provider row, one pixel inside the menu border.
const submenuGap = 5;
const initialPlacement = { alignOffset: 0, maxHeight: 0, maxWidth: 440 };

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
  open,
  onOpenChange,
}: {
  selection: ProviderSelection;
  providerMenu: RefObject<HTMLDivElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [placement, setPlacement] = useState(initialPlacement);
  const trigger = useRef<HTMLDivElement>(null);
  const retentionNote = useRef<HTMLDivElement>(null);
  const noteReturnFocus = useRef<HTMLElement>(null);
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
      const rowBounds = row.getBoundingClientRect();
      const alignOffset = Math.round(bottom - rowBounds.top - height);
      const availableSide = Math.max(rowBounds.left, document.documentElement.clientWidth - rowBounds.right);
      const maxWidth = Math.max(0, Math.floor(availableSide - menuEdgePadding - submenuGap));
      setPlacement(previous =>
        previous.alignOffset === alignOffset && previous.maxHeight === maxHeight && previous.maxWidth === maxWidth
          ? previous
          : { alignOffset, maxHeight, maxWidth },
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
  const menuMaxHeight =
    placement.maxHeight > 0
      ? `min(${placement.maxHeight}px, var(--radix-popper-available-height))`
      : 'var(--radix-popper-available-height)';
  return (
    <DropdownMenuSub open={open} onOpenChange={onOpenChange}>
      <DropdownMenuSubTrigger
        ref={trigger}
        aria-current={current || undefined}
        onPointerEnter={event => {
          // A direct hover on another provider switches menus even when
          // Radix is keeping the previous submenu open for diagonal movement.
          if (event.pointerType === 'mouse') onOpenChange(true);
        }}
        onPointerLeave={event => {
          // The portalled submenu may open to the left in a right-hand dock.
          // Moving directly into it must not send focus back to the provider menu.
          if (event.relatedTarget instanceof Node && submenu?.contains(event.relatedTarget)) event.preventDefault();
        }}
        className="min-h-10 gap-1 rounded-none px-2 font-body text-sm font-medium hover:bg-ods-menu-hover focus:bg-ods-menu-hover data-[state=open]:bg-ods-menu-hover sm:gap-2 sm:px-3 sm:text-base [&_svg]:size-4 sm:[&_svg]:size-5"
      >
        <NamedIcon icon={LLM_PROVIDER_ICON[provider]} className="size-5" />
        <span className="min-w-0 flex-1 truncate">{LLM_PROVIDER_LABEL[provider]}</span>
        {current && <CheckFillIcon aria-hidden className="text-ods-accent" />}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent
        ref={setSubmenu}
        sideOffset={submenuGap}
        alignOffset={placement.alignOffset}
        collisionBoundary={[]}
        collisionPadding={{ top: menuTopInset, right: menuEdgePadding, bottom: menuEdgePadding, left: menuEdgePadding }}
        className={`${menuClassName} flex w-[440px] min-w-0 flex-col overflow-hidden`}
        onKeyDown={event => {
          const note = retentionNote.current;
          if (event.key !== 'Tab' || !note || note.scrollHeight <= note.clientHeight) return;
          // Radix manages Tab inside menus. Give the separately scrollable note a focus path when it overflows.
          if (event.target === note && event.shiftKey) {
            event.preventDefault();
            noteReturnFocus.current?.focus();
          } else if (event.target !== note && !event.shiftKey && event.target instanceof HTMLElement) {
            event.preventDefault();
            noteReturnFocus.current = event.target;
            note.focus();
          }
        }}
        style={{
          maxWidth: placement.maxWidth,
          maxHeight: menuMaxHeight,
        }}
      >
        <div className="min-h-12 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] sm:min-h-14">
          {models.map(model => (
            <DropdownMenuItem
              key={model.id}
              role="menuitemradio"
              aria-checked={model.current}
              className="min-h-12 justify-between rounded-none border-b border-[color:var(--ods-borders-subtle)] px-4 py-2 font-body text-base font-medium last:border-b-0 hover:bg-ods-menu-hover focus:bg-ods-menu-hover sm:min-h-14"
              onSelect={model.choose}
            >
              <span className="min-w-0 break-words">{model.label}</span>
              {model.current && <CheckFillIcon aria-hidden className="text-ods-accent" />}
            </DropdownMenuItem>
          ))}
        </div>
        <div
          ref={retentionNote}
          role="region"
          aria-label="Model data retention"
          tabIndex={-1}
          className="flex shrink-0 items-start gap-2 overflow-y-auto overscroll-contain border-t border-[color:var(--ods-borders-subtle)] px-4 py-3 font-body text-xs text-ods-text-secondary [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-focus"
          // Leave room for a model row even when a narrow viewport wraps the note.
          style={{ maxHeight: `max(0px, calc(${menuMaxHeight} - 4rem - 2px))` }}
        >
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [openProvider, setOpenProvider] = useState<ProviderSelection['provider'] | null>(null);
  // Keep the trigger mounted and focusable when saving the model.
  // A lock closes an open menu without making it reopen after the save.
  if (selection.disabled && menuOpen) {
    setMenuOpen(false);
    setOpenProvider(null);
  }
  const label = name ?? 'Chat Model';
  return (
    <DropdownMenu
      modal={false}
      open={menuOpen}
      onOpenChange={open => {
        if (open && selection.disabled) return;
        setMenuOpen(open);
        setOpenProvider(null);
      }}
    >
      <DropdownMenuTrigger
        type="button"
        aria-label={`Change chat model: ${label}`}
        aria-disabled={selection.disabled || undefined}
        className="group inline-flex h-6 min-w-0 items-center gap-1.5 rounded-sm py-0.5 pl-1.5 pr-1 text-sm font-medium leading-5 text-ods-text-secondary hover:bg-[var(--ods-backgrounds-openframe-background-hover)] hover:text-ods-text-primary focus-visible:outline-2 focus-visible:outline-ods-focus aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent data-[state=open]:bg-[var(--ods-backgrounds-openframe-background-action)] data-[state=open]:text-ods-text-primary"
      >
        <ModelProviderLogo provider={provider} />
        <span className="truncate font-body">{label}</span>
        <Chevron02DownIcon aria-hidden size={16} className="shrink-0 group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        ref={providerMenu}
        align="start"
        side="top"
        sideOffset={4}
        className={`${menuClassName} w-60 max-w-[calc((100vw+24px)/2)]`}
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
          <ProviderModels
            key={option.provider}
            selection={option}
            providerMenu={providerMenu}
            open={openProvider === option.provider}
            onOpenChange={open =>
              setOpenProvider(previous => {
                if (open) return option.provider;
                return previous === option.provider ? null : previous;
              })
            }
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
