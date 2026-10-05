/**
 * File transfer through the mobile shell's native layer (openframe-mobile:
 * NativeFilesPlugin.swift / NativeFilesPlugin.java), for the two things a
 * WebView cannot do.
 *
 * SAVING. Neither shell WebView has a download handler — Capacitor implements
 * no WKDownloadDelegate on iOS and never calls setDownloadListener on Android —
 * so the web idiom
 *
 *     const url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click()
 *
 * is a SILENT no-op there: the click returns, no error is thrown, and nothing is
 * saved. `window.open(blobUrl)` returns null for the same reason. Saving a file
 * fetched from a URL therefore goes through `downloadFileToDevice`, which takes
 * the native route when there is one and falls back to that idiom otherwise.
 * Call sites that save a locally-generated blob (CSV export, the installer
 * script, the MeshCentral file manager) are still on the broken idiom and would
 * need a native method that accepts bytes — see openframe-mobile's CLAUDE.md.
 *
 * UPLOADING. Attachment upload URLs are presigned GCS URLs, and the shell's page
 * origin is `capacitor://localhost` (iOS) / `https://localhost` (Android), which
 * a bucket CORS policy has to name explicitly. `pickFiles` returns native file
 * PATHS rather than `File` objects so `uploadFile` can stream from disk — no
 * CORS to satisfy, and no base64-encoded attachment crossing the bridge.
 *
 * Off mobile every helper falls back to (or reports) the web behavior, so the
 * same call sites work unchanged in the browser and the desktop shell.
 */

import { nativeFilesPlugin } from './native-shell';

/**
 * A file the user picked through the OS picker, staged in app storage.
 *
 * The MIME field is `type`, not the plugin's `mimeType`: that makes this
 * structurally a `File` minus the bytes, so it satisfies core's
 * `FileUploadCandidate` and can flow through the same `FileUpload` validation
 * and the same `UploadSource` union as a browser `File`.
 */
export interface NativePickedFile {
  /** Absolute native path — pass to `uploadFile`, not to `fetch`. */
  path: string;
  name: string;
  type: string;
  size: number;
}

/** True when this shell can save and upload natively — i.e. when it must. */
export function hasNativeFiles(): boolean {
  return nativeFilesPlugin() !== null;
}

/**
 * How the file reached the user. Callers need this to decide what to say when it
 * lands: a browser download and a share sheet are both visible events, but a
 * silent write to the device's Downloads is not — announcing that one is the
 * caller's job.
 */
export type DownloadOutcome = 'browser' | 'shared' | 'saved';

/**
 * Save a remote file to the device. Uses the native fetch-and-hand-off when the
 * shell has one, and otherwise the browser blob download. Throws on a native
 * failure so callers surface it exactly like a failed fetch.
 *
 * The native fetch can run for many seconds with nothing on screen — callers are
 * expected to show progress across the await, or the app looks frozen.
 */
export async function downloadFileToDevice(url: string, fileName: string): Promise<DownloadOutcome> {
  const plugin = nativeFilesPlugin();
  if (plugin) {
    const { savedToDownloads } = await plugin.downloadFile({ url, fileName });
    return savedToDownloads ? 'saved' : 'shared';
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch file');
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
  return 'browser';
}

/**
 * Open the OS file picker. Returns null off mobile (the caller keeps its
 * `<input type="file">`) and an empty array when the user cancels.
 */
export async function pickNativeFiles(options: { multiple?: boolean } = {}): Promise<NativePickedFile[] | null> {
  const plugin = nativeFilesPlugin();
  if (!plugin) return null;
  const { files } = await plugin.pickFiles({ multiple: options.multiple ?? false });
  return files.map(({ mimeType, ...rest }) => ({ ...rest, type: mimeType }));
}

/**
 * A `pickFiles` prop for core's `FileUpload`, or undefined where the built-in
 * `<input type="file">` is the right answer. Undefined during prerender too —
 * which is safe only because `FileUpload` renders the same tree either way.
 *
 * Yields only native handles, never `UploadSource`: `FileUpload` adds `File` to
 * the callback type itself, because a drop stays a browser drop whatever the
 * picker returns. So the consumer's `onChange` still takes `UploadSource`.
 */
export function nativeFilePicker(
  options: { multiple?: boolean } = {},
): (() => Promise<NativePickedFile[]>) | undefined {
  if (!hasNativeFiles()) return undefined;
  return async () => (await pickNativeFiles(options)) ?? [];
}

/**
 * The two things an attachment upload can start from: a browser `File` from an
 * `<input type="file">`, or a native pick. They carry the same metadata (which
 * is why both satisfy core's `FileUploadCandidate`) and differ only in how the
 * bytes reach the presigned URL.
 */
export type UploadSource = File | NativePickedFile;

function isNativePickedFile(source: UploadSource): source is NativePickedFile {
  return 'path' in source;
}

export function uploadSourceMeta(source: UploadSource): {
  fileName: string;
  contentType: string;
  fileSize: number;
} {
  return {
    fileName: source.name,
    // The OS picker can return an empty type for an unrecognized extension, the
    // same as an `<input type="file">` does.
    contentType: source.type || 'application/octet-stream',
    fileSize: source.size,
  };
}

/**
 * Send `source` to a presigned URL with PUT, natively when it came from a native
 * pick. Throws on a non-2xx status either way.
 *
 * The native branch is why `pickFiles` exists: the presigned URL is on
 * storage.googleapis.com, so the bucket's own CORS policy would have to name the
 * shell's page origin for a WebView `fetch` to reach it. Streaming from a native
 * path has no origin to allow.
 */
export async function putUploadSource(source: UploadSource, uploadUrl: string): Promise<void> {
  // The same contentType the backend signed the URL with — a mismatch here would
  // fail the signature, so both branches must send this exact value.
  const { contentType } = uploadSourceMeta(source);

  if (isNativePickedFile(source)) {
    const plugin = nativeFilesPlugin();
    if (!plugin) throw new Error('No native file bridge in this shell');
    await plugin.uploadFile({ path: source.path, url: uploadUrl, contentType });
    return;
  }

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: source,
  });
  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }
}
