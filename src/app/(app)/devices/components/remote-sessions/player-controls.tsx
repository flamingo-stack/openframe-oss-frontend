'use client';

import { Button } from '@flamingo-stack/openframe-frontend-core/components/ui';
import { cn } from '@flamingo-stack/openframe-frontend-core/utils';
import { FastForward, Maximize, Minimize, Pause, Play, Rewind } from 'lucide-react';
import { useState } from 'react';
import type { RecordingPlaybackSpeed, RecordingPlayerState } from '@/lib/meshcentral/recording';
import { formatTimecodeMs } from './format';

const SPEED_OPTIONS: RecordingPlaybackSpeed[] = [0.5, 1, 2, 4];

interface PlayerControlsProps {
  state: RecordingPlayerState;
  currentMs: number;
  durationMs: number;
  speed: RecordingPlaybackSpeed;
  isFullscreen: boolean;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onSetSpeed: (speed: RecordingPlaybackSpeed) => void;
  onToggleFullscreen: () => void;
}

/**
 * Playback controls per Figma 758-46350 / 758-45143: progress bar, transport
 * buttons with the "MM:SS / MM:SS" clock, speed toggle group, fullscreen.
 * Purely presentational - all state lives in `useRecordingPlayer` and the
 * page's fullscreen effect.
 *
 * The progress bar keeps a local value while the user drags and only commits
 * the seek on release, so the rAF-driven `currentMs` updates don't fight the
 * thumb mid-drag.
 */
export function PlayerControls({
  state,
  currentMs,
  durationMs,
  speed,
  isFullscreen,
  onTogglePlay,
  onSeek,
  onStepBack,
  onStepForward,
  onSetSpeed,
  onToggleFullscreen,
}: PlayerControlsProps) {
  const [dragMs, setDragMs] = useState<number | null>(null);
  const disabled = state === 'empty' || state === 'seeking';
  const shownMs = dragMs ?? currentMs;
  const progress = durationMs > 0 ? Math.min(shownMs / durationMs, 1) : 0;

  const commitDrag = () => {
    if (dragMs !== null) {
      onSeek(dragMs);
      setDragMs(null);
    }
  };

  return (
    <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
      {/* Custom track per the mockup (8px bordered track, darker played fill,
          16px thumb); the invisible native range on top keeps pointer drags
          and keyboard seeking accessible. */}
      <div className="relative h-2 w-full">
        <div className="absolute inset-0 rounded-[6px] border border-ods-border bg-ods-bg" />
        {progress > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-[6px] border border-ods-border bg-ods-open-yellow-secondary"
            style={{ width: `${(progress * 100).toFixed(2)}%` }}
          />
        )}
        <div
          className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 rounded-full bg-ods-accent"
          style={{ left: `clamp(0px, calc(${(progress * 100).toFixed(2)}% - 8px), calc(100% - 16px))` }}
        />
        <input
          type="range"
          min={0}
          max={Math.max(durationMs, 1)}
          step={100}
          value={Math.min(shownMs, durationMs)}
          disabled={disabled || durationMs === 0}
          aria-label="Playback position"
          onChange={e => setDragMs(Number(e.target.value))}
          onPointerUp={commitDrag}
          onKeyUp={e => {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') commitDrag();
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
        />
      </div>
      <div className="flex items-center gap-[var(--spacing-system-xs)]">
        <Button
          variant="transparent"
          size="icon"
          aria-label={state === 'playing' ? 'Pause' : 'Play'}
          onClick={onTogglePlay}
          disabled={disabled}
          leftIcon={state === 'playing' ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        />
        <Button
          variant="transparent"
          size="icon"
          aria-label="Back 10 seconds"
          onClick={onStepBack}
          disabled={disabled}
          leftIcon={<Rewind className="h-6 w-6" />}
        />
        <Button
          variant="transparent"
          size="icon"
          aria-label="Forward 10 seconds"
          onClick={onStepForward}
          disabled={disabled}
          leftIcon={<FastForward className="h-6 w-6" />}
        />
        <span className="min-w-0 flex-1 truncate text-ods-text-primary text-h4">
          {formatTimecodeMs(shownMs)}
          <span className="text-ods-text-secondary"> / {formatTimecodeMs(durationMs)}</span>
        </span>
        <div className="flex overflow-hidden rounded-[6px] border border-ods-border bg-ods-card">
          {SPEED_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => onSetSpeed(option)}
              disabled={disabled}
              className={cn(
                'flex h-8 items-center justify-center px-[var(--spacing-system-xs)] text-h5',
                option === speed
                  ? 'bg-ods-accent text-ods-text-on-accent'
                  : 'border-r border-ods-border text-ods-text-primary last:border-r-0 hover:bg-ods-bg-hover',
              )}
            >
              {option}X
            </button>
          ))}
        </div>
        <Button
          variant="transparent"
          size="icon"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={onToggleFullscreen}
          leftIcon={isFullscreen ? <Minimize className="h-6 w-6" /> : <Maximize className="h-6 w-6" />}
        />
      </div>
    </div>
  );
}
