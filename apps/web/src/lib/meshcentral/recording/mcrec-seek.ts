import type { McrecRecord, ParsedRecording, SeekFrame, SeekTile } from './mcrec-types';

// Rebuilds the desktop screen at a seek target from the tiles still visible on it, without decoding any JPEG.

const CMD_TILE = 3;
const CMD_SCREEN_SIZE = 7;
const CMD_JUMBO = 27;
/** Same cap as `MeshDesktop`: a larger pending buffer is dropped there, so it is dropped here too. */
const MAX_PENDING_BYTES = 16 * 1024 * 1024;
/** Coverage grid cell in pixels: agent tiles start on a 32 px grid, but their sizes are multiples of 16. */
const CELL = 16;

interface TileCommand extends SeekTile {
  kind: 'tile';
  record: number;
  /** 0 when the JPEG header cannot be read: such a tile is always drawn and hides nothing. */
  width: number;
  height: number;
}

interface ScreenSizeCommand {
  kind: 'size';
  record: number;
  width: number;
  height: number;
}

type Command = TileCommand | ScreenSizeCommand;

interface FileIndex {
  /** The commands that draw or clear, in stream order. */
  commands: Command[];
  /** Records after which the decoder still holds part of a command. */
  midCommand: Set<number>;
}

const indexes = new WeakMap<readonly McrecRecord[], Map<number, FileIndex>>();

/** Width and height from a JPEG's frame header; null when the bytes are not a readable JPEG. */
export function readJpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    if (isFrameHeader(marker)) {
      if (i + 8 >= bytes.length) return null;
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

/** SOF0-SOF15, minus DHT (C4), JPG (C8) and DAC (CC), which share the range. */
function isFrameHeader(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

/** The screen after agent records `from` (a restart point) to `to`; null when only a replay can rebuild it. */
export function seekFrame(recording: ParsedRecording, from: number, to: number): SeekFrame | null {
  const { commands, midCommand } = fileIndex(recording, from);
  if (midCommand.has(to)) return null;

  let last = commands.length - 1;
  while (last >= 0 && commands[last].record > to) last--;
  let size = last;
  while (size >= 0 && commands[size].kind !== 'size') size--;
  if (size < 0) return null;
  const { width, height } = commands[size];

  const columns = Math.ceil(width / CELL);
  const rows = Math.ceil(height / CELL);
  const covered = new Uint8Array(columns * rows);
  let uncovered = columns * rows;
  const visible: SeekTile[] = [];
  for (let k = last; k > size && uncovered > 0; k--) {
    const command = commands[k];
    if (command.kind !== 'tile') continue;
    if (command.width === 0) {
      visible.push(command);
      continue;
    }
    const left = command.x;
    const top = command.y;
    const right = left + command.width;
    const bottom = top + command.height;
    const firstColumn = Math.floor(left / CELL);
    const firstRow = Math.floor(top / CELL);
    const lastColumn = Math.min(columns - 1, Math.ceil(right / CELL) - 1);
    const lastRow = Math.min(rows - 1, Math.ceil(bottom / CELL) - 1);

    let shows = false;
    for (let row = firstRow; row <= lastRow && !shows; row++) {
      for (let column = firstColumn; column <= lastColumn; column++) {
        if (!covered[row * columns + column]) {
          shows = true;
          break;
        }
      }
    }
    if (!shows) continue;
    visible.push(command);

    // Only cells the tile paints whole (clipped to the screen) hide what is under them.
    for (let row = firstRow; row <= lastRow; row++) {
      if (top > row * CELL || bottom < Math.min((row + 1) * CELL, height)) continue;
      for (let column = firstColumn; column <= lastColumn; column++) {
        if (left > column * CELL || right < Math.min((column + 1) * CELL, width)) continue;
        if (!covered[row * columns + column]) {
          covered[row * columns + column] = 1;
          uncovered--;
        }
      }
    }
  }

  return { width, height, tiles: visible.reverse().map(({ x, y, jpeg }) => ({ x, y, jpeg })) };
}

/** The index of the file that starts at agent record `from`, built on first use. */
function fileIndex(recording: ParsedRecording, from: number): FileIndex {
  let byFile = indexes.get(recording.agentRecords);
  if (!byFile) {
    byFile = new Map();
    indexes.set(recording.agentRecords, byFile);
  }
  let index = byFile.get(from);
  if (!index) {
    const next = (recording.restartIndices ?? []).find(start => start > from);
    index = indexFile(recording.agentRecords, from, next ?? recording.agentRecords.length);
    byFile.set(from, index);
  }
  return index;
}

/** Splits records into commands the way `MeshDesktop.onBinaryFrame` does, keeping the ones that draw or clear. */
function indexFile(records: readonly McrecRecord[], start: number, end: number): FileIndex {
  const commands: Command[] = [];
  const midCommand = new Set<number>();
  let pending: Uint8Array | null = null;

  for (let record = start; record < end; record++) {
    const data = records[record].data;
    const buffer: Uint8Array = pending ? concat(pending, data) : data;
    pending = null;
    if (buffer.length > MAX_PENDING_BYTES) continue;

    let offset = 0;
    let dropped = false;
    while (offset + 4 <= buffer.length) {
      let cmd = (buffer[offset] << 8) | buffer[offset + 1];
      let size = (buffer[offset + 2] << 8) | buffer[offset + 3];
      let skip = 0;
      if (cmd === CMD_JUMBO && size === 8) {
        if (buffer.length - offset < 10) break;
        size = (buffer[offset + 5] << 16) | (buffer[offset + 6] << 8) | buffer[offset + 7];
        cmd = (buffer[offset + 8] << 8) | buffer[offset + 9];
        skip = 8;
        if (buffer.length - offset < skip + size) break;
      } else if (buffer.length - offset < size) {
        break;
      }
      if (size < 4) {
        dropped = true;
        break;
      }

      const frame = buffer.subarray(offset + skip, offset + skip + size);
      if (frame.length >= 8) {
        const x = (frame[4] << 8) | frame[5];
        const y = (frame[6] << 8) | frame[7];
        if (cmd === CMD_SCREEN_SIZE && x > 0 && y > 0) {
          commands.push({ kind: 'size', record, width: x, height: y });
        } else if (cmd === CMD_TILE) {
          const jpeg = frame.subarray(8);
          const tileSize = readJpegSize(jpeg);
          commands.push({
            kind: 'tile',
            record,
            x,
            y,
            jpeg,
            width: tileSize?.width ?? 0,
            height: tileSize?.height ?? 0,
          });
        }
      }
      offset += skip + size;
    }

    if (!dropped && offset < buffer.length) {
      pending = buffer.slice(offset);
      midCommand.add(record);
    }
  }
  return { commands, midCommand };
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
