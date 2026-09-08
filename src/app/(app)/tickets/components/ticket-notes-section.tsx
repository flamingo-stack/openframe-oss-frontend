'use client';

import {
  CheckCircleIcon,
  Ellipsis01Icon,
  PenEditIcon,
  PlusCircleIcon,
  TrashIcon,
} from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import {
  ActionsMenuDropdown,
  Button,
  SquareAvatar,
  Textarea,
  TruncateText,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type KeyboardEvent, useState } from 'react';
import { formatDateTime } from '@/lib/format-date';

export interface TicketNoteItem {
  id: string;
  text: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  isOwn: boolean;
}

interface TicketNotesSectionProps {
  notes: TicketNoteItem[];
  /** Disables the editor while a note is being created */
  isAddingNote?: boolean;
  onAddNote: (text: string) => void;
  onEditNote: (id: string, text: string) => void;
  onDeleteNote: (id: string) => void;
}

interface NoteEditorProps {
  initialText?: string;
  isPending?: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
}

function NoteEditor({ initialText = '', isPending, onSave, onCancel }: NoteEditorProps) {
  const [draft, setDraft] = useState(initialText);

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed || isPending) return;
    onSave(trimmed);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
  };

  return (
    <div className="flex w-full flex-col gap-[var(--spacing-system-xxs)]">
      <Textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter Note Here"
        autoFocus
        disabled={isPending}
      />
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="small"
          leftIcon={<CheckCircleIcon />}
          onClick={save}
          disabled={!draft.trim() || isPending}
        >
          Save Note
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="text-ods-text-secondary underline transition-colors text-h6 hover:text-ods-text-primary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface NoteCardProps {
  note: TicketNoteItem;
  onEdit: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

function NoteCard({ note, onEdit, onDelete }: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  if (isEditing) {
    return (
      <NoteEditor
        initialText={note.text}
        onSave={text => {
          onEdit(note.id, text);
          setIsEditing(false);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <div className="group flex flex-col gap-[var(--spacing-system-xs)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-s)]">
      <div className="flex w-full items-center gap-[var(--spacing-system-xs)]">
        <SquareAvatar
          src={note.authorAvatar}
          alt={note.authorName}
          fallback={note.authorName}
          size="sm"
          variant="round"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <TruncateText className="text-ods-open-yellow">{note.authorName}</TruncateText>
          <TruncateText variant="h6" tone="secondary">
            {formatDateTime(note.createdAt)}
          </TruncateText>
        </div>
        {note.isOwn && (
          <span
            className={cn(
              'shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100',
              menuOpen && 'opacity-100',
            )}
          >
            <ActionsMenuDropdown
              open={menuOpen}
              onOpenChange={setMenuOpen}
              customTrigger={
                <button
                  type="button"
                  aria-label="Note actions"
                  className="flex items-center justify-center text-ods-text-secondary transition-colors hover:text-ods-text-primary"
                >
                  <Ellipsis01Icon size={24} />
                </button>
              }
              groups={[
                {
                  items: [
                    {
                      id: 'edit',
                      label: 'Edit',
                      icon: <PenEditIcon className="text-ods-text-secondary" />,
                      onClick: () => setIsEditing(true),
                    },
                    {
                      id: 'delete',
                      label: 'Delete',
                      icon: <TrashIcon className="text-ods-error" />,
                      danger: true,
                      onClick: () => onDelete(note.id),
                    },
                  ],
                },
              ]}
            />
          </span>
        )}
      </div>

      <p className="break-words text-ods-text-primary text-h4">{note.text}</p>
    </div>
  );
}

export function TicketNotesSection({
  notes,
  isAddingNote,
  onAddNote,
  onEditNote,
  onDeleteNote,
}: TicketNotesSectionProps) {
  const [isAdding, setIsAdding] = useState(false);

  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <p className="text-ods-text-secondary text-h5">Notes</p>
      {notes.map(note => (
        <NoteCard key={note.id} note={note} onEdit={onEditNote} onDelete={onDeleteNote} />
      ))}
      {isAdding ? (
        <NoteEditor
          isPending={isAddingNote}
          onSave={text => {
            onAddNote(text);
            setIsAdding(false);
          }}
          onCancel={() => setIsAdding(false)}
        />
      ) : (
        <Button
          variant="outline"
          size="small"
          className="w-fit"
          leftIcon={<PlusCircleIcon />}
          onClick={() => setIsAdding(true)}
        >
          Add Note
        </Button>
      )}
    </section>
  );
}
