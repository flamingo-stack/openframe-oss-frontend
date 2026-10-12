'use client';

import { ClapperboardIcon, Loading01Icon, PlayIcon } from '@flamingo-stack/openframe-frontend-core/components/icons-v2';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import type { UseRecordingPlayerResult } from './use-recording-player';

interface RecordingPlayerProps {
  player: UseRecordingPlayerResult;
  /** Why there is nothing to play (still processing, deleted, expired); null while there may be. */
  unavailableNote: string | null;
  className?: string;
}

/**
 * The playback surface per Figma 758-46350: a black letterbox hosting either
 * the KVM canvas (protocol 2) or the xterm terminal (protocol 1), with a
 * dimming overlay while a seek replays, a preview with a centred Play button
 * until playback first starts, and the "Session recording unavailable" empty
 * state (775-50606) with the reason when there are no bytes to play.
 *
 * Both hosts stay mounted regardless of protocol - `useRecordingPlayer` picks
 * which one to render into when a buffer loads, and remounting the canvas
 * mid-session would detach the decoder.
 */
export function RecordingPlayer({ player, unavailableNote, className }: RecordingPlayerProps) {
  const { canvasRef, terminalHostRef, protocol, state, togglePlay } = player;
  const showEmptyState = unavailableNote !== null && state === 'empty';

  return (
    <div className={cn('relative w-full overflow-hidden bg-black', className)}>
      <canvas
        ref={canvasRef}
        className={cn('absolute inset-0 h-full w-full object-contain', protocol === 2 ? 'visible' : 'invisible')}
      />
      <div
        ref={terminalHostRef}
        className={cn('absolute inset-0 p-[var(--spacing-system-xsf)]', protocol === 1 ? 'visible' : 'invisible')}
      />
      {state === 'seeking' && (
        <div className="absolute inset-0 flex items-center justify-center bg-ods-overlay">
          <Loading01Icon className="h-8 w-8 animate-spin text-ods-text-secondary" />
        </div>
      )}
      {/* `ready` holds only between the load and the first play. */}
      {state === 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-ods-card to-ods-border-hover">
          <button
            type="button"
            aria-label="Play recording"
            onClick={togglePlay}
            className="flex size-[100px] items-center justify-center rounded-full bg-ods-card text-ods-text-primary outline-none transition-colors hover:bg-ods-bg-hover focus-visible:ring-2 focus-visible:ring-ods-focus"
          >
            <PlayIcon className="h-6 w-6" />
          </button>
        </div>
      )}
      {showEmptyState && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[var(--spacing-system-xsf)]">
          <ClapperboardIcon className="h-6 w-6 text-ods-text-secondary" />
          <span className="text-ods-text-secondary text-h6">Session recording unavailable</span>
          <span className="text-ods-text-muted text-h6">{unavailableNote}</span>
        </div>
      )}
    </div>
  );
}
