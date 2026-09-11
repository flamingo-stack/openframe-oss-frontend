import type { Terminal } from '@xterm/xterm';
import { MeshDesktop } from '@/lib/meshcentral/meshcentral-desktop';
import type { RecordingRenderer } from './mcrec-types';

/**
 * Replays protocol-2 (desktop/KVM) payloads onto a canvas through the same
 * `MeshDesktop` decoder the live viewer uses. `reset()` swaps in a FRESH
 * decoder instance: the player seeks by replaying from record zero, and a new
 * instance guarantees no jumbo-frame accumulator, tile queue, or display state
 * leaks across seeks. Attached render-only, so no input listeners are bound
 * and nothing is ever sent (no `setSender` call - `send()` is a no-op).
 */
export class DesktopRecordingRenderer implements RecordingRenderer {
  private desktop: MeshDesktop | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {}

  reset(): void {
    this.desktop?.detach();
    this.desktop = new MeshDesktop();
    this.desktop.attachRenderOnly(this.canvas);
  }

  feed(data: Uint8Array): void {
    void this.desktop?.onBinaryFrame(data);
  }

  waitForIdle(): Promise<void> {
    return this.desktop?.waitForIdle() ?? Promise.resolve();
  }

  dispose(): void {
    this.desktop?.detach();
    this.desktop = null;
  }
}

/**
 * Replays protocol-1 (terminal) payloads into an xterm instance the caller
 * owns (created with `disableStdin: true`). Payloads are raw terminal bytes -
 * `Terminal.write` accepts `Uint8Array` directly in xterm 6.
 */
export class TerminalRecordingRenderer implements RecordingRenderer {
  constructor(private readonly terminal: Terminal) {}

  reset(): void {
    this.terminal.reset();
  }

  feed(data: Uint8Array): void {
    this.terminal.write(data);
  }

  waitForIdle(): Promise<void> {
    // xterm buffers writes internally; a write callback resolves once the
    // last chunk fed so far has been processed.
    return new Promise(resolve => {
      this.terminal.write(new Uint8Array(0), resolve);
    });
  }

  dispose(): void {
    // The terminal is owned by the caller (page component) - nothing to do.
  }
}
