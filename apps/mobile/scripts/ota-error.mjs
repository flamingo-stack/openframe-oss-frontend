// Every refusal of the over-the-air format carries one of these codes. The shared cases in
// apps/mobile/ota/fixtures expect codes, never messages, so the release scripts and both shells
// can word their errors as they like and still be held to the same outcome.
export const CODES = [
  // mobile.json
  'ENVELOPE', // not JSON, a missing envelope field, non-canonical base64
  'UNKNOWN_KEY', // signed by a key id the shell does not hold
  'SIGNATURE', // the signature does not verify (including non-DER encodings)
  'PAYLOAD', // the signed payload is not JSON, or a field is missing or invalid
  // the bundle
  'SIZE', // its length differs from the payload's
  'SHA256', // its SHA-256 differs from the payload's
  'XZ', // not exactly one intact xz stream with nothing after it
  'TAR', // a malformed ustar archive: header, checksum, size field, truncation, trailing bytes
  'ENTRY_TYPE', // an entry that is not a regular file
  'ENTRY_NAME', // a path a shell must not write
  'DUPLICATE', // a path colliding with another, ignoring ASCII case: the same one, or a file where a directory goes
  'NO_INDEX', // no index.html at the root
  'HAS_ENV', // an index.html that already carries the literal <script>window.__ENV
  // the env copy
  'NO_ENV', // the built-in index.html has no window.__ENV script
  'NO_HEAD', // an index.html without the literal <head> to put it after (the release checks it too)
  // keys.json
  'KEYS',
];

export class OtaError extends Error {
  constructor(code, message) {
    if (!CODES.includes(code)) throw new Error(`unknown OTA error code ${code}`);
    super(message);
    this.code = code;
  }
}
