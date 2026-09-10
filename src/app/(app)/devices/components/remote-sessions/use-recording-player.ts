'use client';

import type { Terminal } from '@xterm/xterm';
import { useEffect, useRef, useState } from 'react';
import {
  DesktopRecordingRenderer,
  McrecPlayer,
  parseMcrec,
  type RecordingPlaybackSpeed,
  type RecordingPlayerState,
  TerminalRecordingRenderer,
} from '@/lib/meshcentral/recording';

const SPEEDS: RecordingPlaybackSpeed[] = [0.5, 1, 2, 4];

export interface UseRecordingPlayerResult {
  state: RecordingPlayerState;
  currentMs: number;
  durationMs: number;
  speed: RecordingPlaybackSpeed;
  /** Protocol of the loaded recording; null until one is loaded. */
  protocol: 1 | 2 | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  terminalHostRef: React.RefObject<HTMLDivElement | null>;
  /** Parse a `.mcrec` buffer, build the matching renderer, and rewind. */
  loadBuffer: (buffer: ArrayBuffer) => Promise<void>;
  togglePlay: () => void;
  seek: (ms: number) => void;
  stepBack: () => void;
  stepForward: () => void;
  setSpeed: (speed: RecordingPlaybackSpeed) => void;
  cycleSpeed: () => void;
}

/**
 * Owns one `McrecPlayer` for the recording page. The player instance lives in
 * a ref; React state mirrors only what the controls render (state, time,
 * duration, speed). The renderer is created on `loadBuffer` from the parsed
 * protocol: desktop draws into `canvasRef`, terminal lazily boots xterm into
 * `terminalHostRef` (read-only, `disableStdin`).
 */
export function useRecordingPlayer(): UseRecordingPlayerResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<McrecPlayer | null>(null);
  const terminalRef = useRef<Terminal | null>(null);

  const [state, setState] = useState<RecordingPlayerState>('empty');
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [speed, setSpeedState] = useState<RecordingPlaybackSpeed>(1);
  const [protocol, setProtocol] = useState<1 | 2 | null>(null);

  useEffect(() => {
    const player = new McrecPlayer({
      onState: setState,
      onTime: setCurrentMs,
      onDuration: setDurationMs,
    });
    playerRef.current = player;
    return () => {
      player.dispose();
      playerRef.current = null;
      terminalRef.current?.dispose();
      terminalRef.current = null;
    };
  }, []);

  const loadBuffer = async (buffer: ArrayBuffer) => {
    const player = playerRef.current;
    if (!player) return;

    const recording = parseMcrec(buffer);

    if (recording.protocol === 2) {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Player canvas is not mounted');
      player.attachRenderer(new DesktopRecordingRenderer(canvas));
    } else {
      const host = terminalHostRef.current;
      if (!host) throw new Error('Terminal host is not mounted');
      if (!terminalRef.current) {
        const [{ Terminal: XtermTerminal }, { FitAddon }] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
        ]);
        const term = new XtermTerminal({
          fontFamily: 'monospace',
          theme: { background: '#000000' },
          disableStdin: true,
        });
        const fit = new FitAddon();
        term.loadAddon(fit);
        term.open(host);
        try {
          fit.fit();
        } catch {
          // The host can lack layout on the first frame; the size is cosmetic.
        }
        terminalRef.current = term;
      }
      player.attachRenderer(new TerminalRecordingRenderer(terminalRef.current));
    }

    setProtocol(recording.protocol);
    player.loadParsed(recording);
  };

  const togglePlay = () => {
    const player = playerRef.current;
    if (!player) return;
    if (player.state === 'playing') player.pause();
    else player.play();
  };

  const seek = (ms: number) => {
    void playerRef.current?.seek(ms);
  };

  const setSpeed = (next: RecordingPlaybackSpeed) => {
    playerRef.current?.setSpeed(next);
    setSpeedState(next);
  };

  const cycleSpeed = () => {
    const index = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(index + 1) % SPEEDS.length]);
  };

  return {
    state,
    currentMs,
    durationMs,
    speed,
    protocol,
    canvasRef,
    terminalHostRef,
    loadBuffer,
    togglePlay,
    seek,
    stepBack: () => {
      void playerRef.current?.stepBack();
    },
    stepForward: () => {
      void playerRef.current?.stepForward();
    },
    setSpeed,
    cycleSpeed,
  };
}
