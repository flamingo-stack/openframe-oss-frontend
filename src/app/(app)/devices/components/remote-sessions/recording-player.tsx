'use client';

import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { Clapperboard, Loader2 } from 'lucide-react';
import type { UseRecordingPlayerResult } from './use-recording-player';

interface RecordingPlayerProps {
  player: UseRecordingPlayerResult;
  /** True while the recording has no playable bytes (processing / fetch failed). */
  unavailable: boolean;
  className?: string;
}

/**
 * The playback surface per Figma 758-46350: a black letterbox hosting either
 * the KVM canvas (protocol 2) or the xterm terminal (protocol 1), with a
 * dimming overlay while a seek replays, and the "still being processed" empty
 * state (775-50606) when there are no bytes to play.
 *
 * Both hosts stay mounted regardless of protocol - `useRecordingPlayer` picks
 * which one to render into when a buffer loads, and remounting the canvas
 * mid-session would detach the decoder.
 */
export function RecordingPlayer({ player, unavailable, className }: RecordingPlayerProps) {
  const { canvasRef, terminalHostRef, protocol, state } = player;
  const showEmptyState = unavailable && state === 'empty';

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
          <Loader2 className="h-8 w-8 animate-spin text-ods-text-secondary" />
        </div>
      )}
      {showEmptyState && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[var(--spacing-system-xsf)]">
          <Clapperboard className="h-6 w-6 text-ods-text-secondary" />
          <span className="text-ods-text-secondary text-h6">Session recording unavailable</span>
          <span className="text-ods-text-muted text-h6">
            The video is still being processed, check back in a moment
          </span>
        </div>
      )}
    </div>
  );
}
