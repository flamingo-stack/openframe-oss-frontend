'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  type Modifier,
  PointerSensor,
  type ScreenReaderInstructions,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DraggerIcon, TrashIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { Button, Checkbox, Input, Label, ModalV2Title } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { useToast } from '@flamingo-stack/openframe-frontend-core/hooks';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { useEffect, useId, useState } from 'react';
import { SimpleModal } from '@/app/components/shared/simple-modal';
import {
  buildCombo,
  comboLabel,
  normalizeKeyToken,
  type RemoteShortcut,
  SHORTCUT_MODIFIERS,
  type ShortcutModifier,
} from './remote-shortcuts';

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const dragInstructions: ScreenReaderInstructions = {
  draggable:
    'To reorder this shortcut, press Space or Enter to pick it up, then Arrow Up / Arrow Down to move it. ' +
    'Press Space or Enter again to drop it, or Escape to cancel.',
};

const MODIFIER_LABELS: Record<ShortcutModifier, string> = {
  shift: 'Shift',
  alt: 'Alt',
  ctrl: 'Ctrl',
  win: 'Win',
};

interface ShortcutRowProps {
  shortcut: RemoteShortcut;
  onRemove: () => void;
}

function ShortcutRow({ shortcut, onRemove }: ShortcutRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: shortcut.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-sf)]',
        'border-b border-ods-border bg-ods-bg last:border-b-0',
        isDragging && 'relative z-10 opacity-80',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${comboLabel(shortcut.combo)}`}
        className="cursor-grab text-ods-text-secondary hover:text-ods-text-primary active:cursor-grabbing"
      >
        <DraggerIcon className="w-6 h-6" />
      </button>
      <span className="flex-1 min-w-0 truncate text-h4 text-ods-text-primary">{comboLabel(shortcut.combo)}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Delete ${comboLabel(shortcut.combo)}`}
        className="text-ods-error hover:opacity-80"
      >
        <TrashIcon className="w-6 h-6" />
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
  const dndId = useId();

  const [draft, setDraft] = useState<RemoteShortcut[]>(shortcuts);
  const [modifiers, setModifiers] = useState<ShortcutModifier[]>([]);
  const [keyInput, setKeyInput] = useState('');

  // Re-seed the working copy each time the modal opens; edits stay local until Save.
  useEffect(() => {
    if (open) {
      setDraft(shortcuts);
      setModifiers([]);
      setKeyInput('');
    }
  }, [open, shortcuts]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setDraft(current => {
      const from = current.findIndex(s => s.id === active.id);
      const to = current.findIndex(s => s.id === over.id);
      return from === -1 || to === -1 ? current : arrayMove(current, from, to);
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
        <div className="rounded-[6px] border border-ods-border bg-ods-bg overflow-hidden">
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            accessibility={{ screenReaderInstructions: dragInstructions }}
          >
            <SortableContext items={draft.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {draft.map(shortcut => (
                <ShortcutRow
                  key={shortcut.id}
                  shortcut={shortcut}
                  onRemove={() => setDraft(current => current.filter(s => s.id !== shortcut.id))}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}

      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <p className="text-h5 text-ods-text-secondary">Add New Shortcut</p>
        <div className="flex flex-col gap-[var(--spacing-system-xs)] rounded-[6px] border border-ods-border bg-ods-bg p-[var(--spacing-system-m)]">
          <div className="flex overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
            {SHORTCUT_MODIFIERS.map((modifier, index) => (
              <label
                key={modifier}
                htmlFor={`shortcut-mod-${modifier}`}
                className={cn(
                  'flex flex-1 min-w-0 cursor-pointer items-center gap-[var(--spacing-system-s)] p-[var(--spacing-system-sf)]',
                  index < SHORTCUT_MODIFIERS.length - 1 && 'border-r border-ods-border',
                )}
              >
                <Checkbox
                  id={`shortcut-mod-${modifier}`}
                  checked={modifiers.includes(modifier)}
                  onCheckedChange={checked => toggleModifier(modifier, !!checked)}
                />
                <span className="truncate text-h4 text-ods-text-primary">{MODIFIER_LABELS[modifier]}</span>
              </label>
            ))}
          </div>
          <div className="flex items-end gap-[var(--spacing-system-xs)]">
            <div className="flex flex-1 min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
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
