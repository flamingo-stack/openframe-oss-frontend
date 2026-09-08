'use client';

import {
  SortableList,
  SortableMoveButtons,
  useSortableItem,
} from '@flamingo-stack/openframe-frontend-core/components/features';
import { DraggerIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Checkbox, Input, Label, ModalV2Title } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import {
  buildCombo,
  comboLabel,
  normalizeKeyToken,
  type RemoteShortcut,
  SHORTCUT_MODIFIERS,
  type ShortcutModifier,
} from './remote-shortcuts';

const MODIFIER_LABELS: Record<ShortcutModifier, string> = {
  shift: 'Shift',
  alt: 'Alt',
  ctrl: 'Ctrl',
  win: 'Win',
};

interface ShortcutRowProps {
  shortcut: RemoteShortcut;
  index: number;
  count: number;
  onRemove: () => void;
}

function ShortcutRow({ shortcut, index, count, onRemove }: ShortcutRowProps) {
  const { itemRef, dragHandleProps, isDragging, dragAndDropEnabled } = useSortableItem();
  const label = comboLabel(shortcut.combo);

  return (
    <div
      ref={itemRef}
      className={cn(
        'flex items-center gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-sf)]',
        'border-b border-ods-border bg-ods-bg last:border-b-0',
        isDragging && 'relative z-10 opacity-80',
      )}
    >
      {dragAndDropEnabled ? (
        <button
          type="button"
          {...dragHandleProps}
          aria-label={`Reorder ${label}`}
          className="cursor-grab text-ods-text-secondary hover:text-ods-text-primary active:cursor-grabbing"
        >
          <DraggerIcon className="h-6 w-6" />
        </button>
      ) : (
        <SortableMoveButtons index={index} count={count} label={label} />
      )}
      <span className="min-w-0 flex-1 truncate text-ods-text-primary text-h4">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Delete ${label}`}
        className="text-ods-error hover:opacity-80"
      >
        <TrashIcon className="h-6 w-6" />
      </button>
    </div>
  );
}

interface ShortcutsSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts: RemoteShortcut[];
  onSave: (shortcuts: RemoteShortcut[]) => void;
}

export function ShortcutsSettingsModal({ open, onOpenChange, shortcuts, onSave }: ShortcutsSettingsModalProps) {
  const { toast } = useToast();

  // The caller mounts this component only while the modal is open, so the
  // working copy seeds from props on mount and edits stay local until Save.
  const [draft, setDraft] = useState<RemoteShortcut[]>(shortcuts);
  const [modifiers, setModifiers] = useState<ShortcutModifier[]>([]);
  const [keyInput, setKeyInput] = useState('');

  const handleReorder = (from: number, to: number) => {
    setDraft(current => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const toggleModifier = (modifier: ShortcutModifier, checked: boolean) => {
    setModifiers(current => (checked ? [...current, modifier] : current.filter(m => m !== modifier)));
  };

  const handleAdd = () => {
    const keyToken = normalizeKeyToken(keyInput);
    if (!keyToken) {
      toast({
        title: 'Invalid Key',
        description: 'Use a letter, digit, F1-F24, or Esc / Tab / Enter / Space / Del / arrow keys',
        variant: 'destructive',
      });
      return;
    }
    const combo = buildCombo(modifiers, keyToken);
    if (draft.some(s => s.combo === combo)) {
      toast({
        title: 'Duplicate Shortcut',
        description: `${comboLabel(combo)} is already in the list`,
        variant: 'destructive',
      });
      return;
    }
    setDraft(current => [...current, { id: `custom-${combo}`, combo }]);
    setModifiers([]);
    setKeyInput('');
  };

  const handleSave = () => {
    onSave(draft);
    toast({ title: 'Shortcuts Saved', description: 'Shortcut list updated', variant: 'success', duration: 2000 });
    onOpenChange(false);
  };

  return (
    <SimpleModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      className="md:max-w-[600px]"
      header={<ModalV2Title>Shortcuts Settings</ModalV2Title>}
      contentClassName="flex flex-col gap-[var(--spacing-system-l)]"
      footer={
        <>
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            Save Shortcuts
          </Button>
        </>
      }
    >
      {draft.length > 0 && (
        <SortableList
          onReorder={handleReorder}
          getItemLabel={index => (draft[index] ? comboLabel(draft[index].combo) : undefined)}
          className="overflow-hidden rounded-[6px] border border-ods-border bg-ods-bg"
        >
          {draft.map((shortcut, index) => (
            <ShortcutRow
              key={shortcut.id}
              shortcut={shortcut}
              index={index}
              count={draft.length}
              onRemove={() => setDraft(current => current.filter(s => s.id !== shortcut.id))}
            />
          ))}
        </SortableList>
      )}

      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <p className="text-ods-text-secondary text-h5">Add New Shortcut</p>
        <div className="flex flex-col gap-[var(--spacing-system-xs)] rounded-[6px] border border-ods-border bg-ods-bg p-[var(--spacing-system-m)]">
          <div className="flex overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
            {SHORTCUT_MODIFIERS.map((modifier, index) => (
              <label
                key={modifier}
                htmlFor={`shortcut-mod-${modifier}`}
                className={cn(
                  'flex min-w-0 flex-1 cursor-pointer items-center gap-[var(--spacing-system-s)] p-[var(--spacing-system-sf)]',
                  index < SHORTCUT_MODIFIERS.length - 1 && 'border-r border-ods-border',
                )}
              >
                <Checkbox
                  id={`shortcut-mod-${modifier}`}
                  checked={modifiers.includes(modifier)}
                  onCheckedChange={checked => toggleModifier(modifier, !!checked)}
                />
                <span className="truncate text-ods-text-primary text-h4">{MODIFIER_LABELS[modifier]}</span>
              </label>
            ))}
          </div>
          <div className="flex items-end gap-[var(--spacing-system-xs)]">
            <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
              <Label htmlFor="shortcut-key">Key</Label>
              <Input
                id="shortcut-key"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                placeholder="Enter Key Here"
                className="bg-ods-card"
              />
            </div>
            <Button variant="outline" onClick={handleAdd}>
              Add
            </Button>
          </div>
        </div>
      </div>
    </SimpleModal>
  );
}
