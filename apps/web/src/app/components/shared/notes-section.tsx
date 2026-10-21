'use client';

import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';
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
  useLoadingScope,
} from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { type KeyboardEvent, type ReactNode, useState } from 'react';
import { formatDateTime } from '@/lib/format-date';
import { ConfirmDialog } from './confirm-dialog';

export interface NoteItem {
  id: string;
  text: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  isOwn: boolean;
}

interface NotesSectionProps {
  notes: NoteItem[];
  /** Disables the editor while a note is being created */
  isAddingNote?: boolean;
  onAddNote: (text: string) => void;
  onEditNote: (id: string, text: string) => void;
  /** Fired once the user has confirmed the delete — the section owns the confirmation step. */
  onDeleteNote: (id: string) => void;
  /** The notes have not been read yet (a client read); inside a loading scope the section switches itself. */
  loading?: boolean;
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

const NOTE_CARD_CLASS =
  'flex flex-col gap-[var(--spacing-system-xs)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-s)]';
const NOTE_HEADER_CLASS = 'flex w-full items-center gap-[var(--spacing-system-xs)]';
const NOTE_AUTHOR_CLASS = 'flex min-w-0 flex-1 flex-col';
const NOTE_TEXT_CLASS = 'break-words text-ods-text-primary text-h4';

interface NoteCardProps {
  note: NoteItem;
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
    <div data-loading-item className={cn('group', NOTE_CARD_CLASS)}>
      <div className={NOTE_HEADER_CLASS}>
        <SquareAvatar
          src={note.authorAvatar}
          alt={note.authorName}
          fallback={note.authorName}
          size="sm"
          variant="round"
        />
        <div className={NOTE_AUTHOR_CLASS}>
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

      <p className={NOTE_TEXT_CLASS}>{note.text}</p>
    </div>
  );
}

/** The section's shell: the "Notes" heading over its content. */
function NotesSectionFrame({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <p className="text-ods-text-secondary text-h5">Notes</p>
      {children}
    </section>
  );
}

function AddNoteButton({ disabled, onClick }: { disabled?: boolean; onClick?: () => void }) {
  return (
    <Button
      variant="outline"
      size="small"
      className="w-fit"
      leftIcon={<PlusCircleIcon />}
      onClick={onClick}
      disabled={disabled}
    >
      Add Note
    </Button>
  );
}

export function NotesSection({
  notes,
  isAddingNote,
  onAddNote,
  onEditNote,
  onDeleteNote,
  loading: loadingProp,
}: NotesSectionProps) {
  const loading = useLoadingScope() || !!loadingProp;
  const [isAdding, setIsAdding] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // While the notes are read: the heading and the real, disabled "Add Note", and no note card. Notes are optional
  // and a record usually has none, so the typical loaded section is exactly that.
  if (loading)
    return (
      <LoadingRegion className="contents" label="Loading notes">
        <NotesSectionFrame>
          <AddNoteButton disabled />
        </NotesSectionFrame>
      </LoadingRegion>
    );

  const confirmDelete = () => {
    if (noteToDelete) onDeleteNote(noteToDelete);
    setNoteToDelete(null);
  };

  return (
    <NotesSectionFrame>
      {notes.map(note => (
        <NoteCard key={note.id} note={note} onEdit={onEditNote} onDelete={setNoteToDelete} />
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
        <AddNoteButton onClick={() => setIsAdding(true)} />
      )}
      <ConfirmDialog
        open={noteToDelete !== null}
        onOpenChange={open => !open && setNoteToDelete(null)}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        confirmLabel="Delete Note"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </NotesSectionFrame>
  );
}
