# Over-the-air web bundles

The mobile shells will update their web bundle without a store release, the way the desktop app
takes `updater.json`. This page covers the release side, which is in place; the shells' updater
(`NativeUpdate`) is not built yet, so nothing on a phone reads these files today. Design:
vault `OpenFrame/Mobile - OTA Web Bundle Updates (plan)`.

## What a release publishes

Every release dispatch of `.github/workflows/release.yml` attaches two files to the `x.y.z` release:

| File | What it is |
|---|---|
| `openframe-mobile-<x.y.z>.tar.xz` | The web static export as a ustar archive in one xz stream, with no `window.__ENV` in it. One bundle for every environment: a phone copies the `window.__ENV` script of its own built-in bundle into it, so each app keeps its shared host and dev-ticket setting. The committed `apps/web/.env.local` still loads at build time, as for the desktop and store bundles; the app reads its values from `window.__ENV` at runtime, so only build-time output such as `og:url` carries them. |
| `mobile.json` | Its manifest: `{keyId, payload, signature}`. `payload` is base64 of `{format, version, bridgeLevel, url, size, sha256}`; `signature` is ECDSA P-256 / SHA-256 over those payload bytes, DER, base64. |

- The `build_mobile_ota` job builds the export, packs and signs it, then checks the result
  against `apps/mobile/ota/keys.json`. A failure fails the release, like a desktop leg. It sets
  no environment's values, only `NEXT_PUBLIC_APP_MODE=saas-tenant`, the mode every mobile lane
  builds with, because the root layout prerenders by it (the sidebar width it seeds). Only the
  pack step is given the signing key, but it shares the job, and so the workspace, with `npm ci`
  and the build: the key is as safe as the dependencies those run (the desktop's
  `TAURI_SIGNING_PRIVATE_KEY` is in the same position).
- `bridgeLevel` is `REQUIRED_BRIDGE_LEVEL` in `apps/web/src/lib/native-shell.ts`.
- `keyId` is the first 16 lowercase hex digits of SHA-256 over the signing key's public SPKI
  DER, in its one 91-byte form (named curve, uncompressed point), the only one `ota-verify.mjs`
  accepts.

### Why one tar.xz

The export's HTML pages and RSC `.txt` payloads change on every release (they carry the build id
and the chunk URLs) and are near-copies of each other, so only a compression stream that spans
files shrinks them. Measured on 1.0.213:

| Packing | Size |
|---|---|
| zip, each file deflated on its own | 21.6 MB |
| tar.gz (32 KB window) | 21.1 MB |
| **tar.xz `-6`, social preview images left out** | **4.5 MB** |

- `scripts/ota-tar.mjs` writes it: ustar, regular files only, plain-ASCII paths, mode 644,
  owner 0, mtime 0, sorted, then `xz -6 -T1` (an 8 MiB dictionary, about 9 MiB to decode;
  single-threaded so every xz version writes one block). With the same xz build, the same export
  packs to the same bytes.
- **ustar limits:** a path of at most 255 bytes, and a file name (its last part) of at most 100.
  Next names each RSC payload file after its whole route (`__next.<segments>.txt`, 67 bytes at
  most on 1.0.213), so a route of about 72 characters would stop the release at "Build Mobile OTA
  Bundle" until it is shortened or the format learns pax path records.
- `assets/openframe/og-image.png` and `twitter-image.png` stay out (`LEFT_OUT` in
  `ota-pack.mjs`): byte-identical, and only link-preview meta tags point at them, by an absolute
  URL on the web host.
- The shells decode xz with Apple's Compression framework (`COMPRESSION_LZMA`; it decoded a
  1.0.213 bundle byte for byte on macOS) and XZ for Java (`org.tukaani:xz`) on Android, then read
  the tar with the checks `readTar` and `checkBundleContents` make, held to the same outcomes by
  the shared test cases below.

The scripts are `scripts/ota-pack.mjs`, `ota-verify.mjs`, `ota-keygen.mjs`, `ota-tar.mjs`,
`ota-env.mjs` (the `window.__ENV` element, shared with `inject-env.mjs`), `ota-error.mjs` and
`ota-fixtures.mjs`. `npm run test:ota` in `apps/mobile` runs their tests (it needs `xz` and
`tar`).

### Known issue: unstyled pages

`npm run build:export`, which runs `next-styles build`, leaves every page but `/` and the 404
without its route stylesheet in a static export: the core library's route step reads
`prerender-manifest.json` from `dist`, while Next keeps it in `.next` for an export. Measured on
1.0.212 and 1.0.213. The plain `next build` styles every page but puts the whole stylesheet into
all of them: 355 MB on the phone instead of 96 MB, so it is no way out for these bundles. No
bundle should reach a phone before the library fixes the route step.

## How phones get it

The shared host's gateway serves it, as it serves the desktop's `updater.json`: entries beside
`desktop` under `openframe.gateway.agent-download` in openframe-saas-shared's base config
(block style: `${...}` is not valid inside a YAML flow mapping):

```yaml
assets:
  mobile:
    ios: openframe-mobile-*.tar.xz
    android: openframe-mobile-*.tar.xz
files:
  mobile:
    - mobile.json
sources:
  mobile:
    repo: openframe-oss-frontend
    tag: ${DESKTOP_VERSION:}
    public-repo: true
```

With those in place, `GET <shared host>/v0/api/assets/download?agent=mobile&file=mobile.json`
answers 302 to the `mobile.json` of the release that environment runs (`DESKTOP_VERSION` is its
`saas.frontend.image.tag`; dev's `latest` is GitHub's Latest release). The manifest names the
bundle by its direct release URL. A pinned release without `mobile.json` (any release before the
first one this job built) answers 502 on every request, uncached, so pin no such release once
phones ask for it.

**What the signature does not cover.** It proves a bundle was released, not that it is the one a
phone should run. Which release phones take comes from this config and the GitHub release
assets, as on desktop. So whoever can change those can move phones to any release that ever
carried `mobile.json`, older ones included, or make them drop their OTA bundles.

## Shared test cases

The format is implemented three times: in these scripts and in each shell's updater.
`apps/mobile/ota/fixtures` holds the cases all three must agree on, as
`apps/desktop/src-tauri/src/*.json` hold the web app and the desktop shell to one install
command. Each case is an input and its outcome: what is accepted, or the error code
(`scripts/ota-error.mjs`) of the first check that refuses it. Codes, never messages, so each
implementation words its errors as it likes.

| File | Input | Outcome |
|---|---|---|
| `manifest-cases.json` | a `mobile.json` text and the keys of `fixture-keys.json` the shell holds | the payload's known fields, or a code |
| `bundle-cases.json` | a file in `bundles/` and the `size` and `sha256` its payload gives | its files as `{path, size, sha256}` in archive order, or a code |
| `env-cases.json` | the built-in and the staged `index.html` | the staged page with the env copied in, or a code |
| `decision-cases.json` | the shell's built-in version and bridge level, its bundles, a verified payload | `download`, `nothing` or `drop` |

A case runner also derives each `keyId` in `fixture-keys.json` from its key and checks it, as
the shells derive the ids of the keys they hold.

### The rules

- **Text is compared as bytes.** Every match below (url, `<head>`, the env element, paths) is on
  the UTF-8 bytes, never on Unicode strings: Swift compares `.utf8` or `Data`, since `String`
  matches by grapheme and canonical equivalence. Lower-casing is ASCII only (`Locale.ROOT` in
  Java).
- **The manifest**, checked in this order:
  1. `ENVELOPE`: strict JSON (RFC 8259, valid UTF-8, no byte order mark, nothing but whitespace
     after the value) holding an object whose `keyId`, `payload` and `signature` are strings,
     `payload` and `signature` in canonical base64: decode, re-encode, compare. Java's decoder
     takes a missing `=` and non-zero padding bits, Node's also the URL-safe alphabet, and
     `java.util.Base64` needs API 26 where the app supports 24, so Android writes its own strict
     decoder.
  2. `UNKNOWN_KEY`: `keyId` is not the id of a key the shell holds (exact, case-sensitive).
  3. `SIGNATURE`: the DER signature does not verify over the payload's bytes. The high-S form
     verifies (as in Node, CryptoKit and JCA). A needless leading zero, a negative integer, a
     long-form length, a trailing byte or raw r‖s is refused, whether the verifier returns false
     or throws. SunEC accepts a negative r, so Android's tests run Conscrypt, the device's
     provider, as the first security provider, and check that it is the one in use.
  4. `PAYLOAD`: the payload bytes are valid UTF-8 and, parsed by the same strict JSON, an object
     with these fields; types are JSON's, so `true` is not the number 1, which
     `JSONSerialization` would make it:
     - `format`: the integer 1;
     - `version`: the whole string is three parts joined by `.`, each `0` or an ASCII 1-9 followed
       by at most eight ASCII digits, so each fits a 32-bit int (no sign, no suffix, no line
       terminator; Swift's `\d` and Java's `Integer.parseInt` take any Unicode digit);
     - `bridgeLevel` and `size`: integers of at least 1;
     - `sha256`: exactly 64 lowercase hex digits;
     - `url`: starts with `https://`, holds no `?` or `#`, and ends with
       `/openframe-mobile-<version>.tar.xz`, compared as text, never parsed. Any host: the
       signature covers it.

  In the envelope and the payload alike, fields this format does not know are ignored, which
  keeps `format: 1` open to optional additions (delta archives, for one) without breaking the
  shells already installed.
- **The bundle.** `SIZE`, then `SHA256`, against the payload before anything is decompressed;
  then these groups, and with several faults the first group that has one gives the code:
  1. `XZ`: one xz stream from the first byte to the last. It opens with the magic
     `FD 37 7A 58 5A 00` and nothing follows it, not even stream padding. `xz` decodes every
     concatenated stream, while Apple's `COMPRESSION_LZMA` stops after the first without an
     error, and also decodes the legacy `.lzma` container, which has no magic. So iOS checks the
     magic, then that the decoder ended the stream and consumed every input byte; Android reads
     with `SingleXZInputStream` and checks for the end of input.
  2. `TAR`: the magic `ustar\0` and version `00`; the checksum six octal digits, NUL, space,
     equal to the unsigned sum of the header's 512 bytes with its own 8 counted as spaces; the
     size eleven octal digits, NUL (ASCII `0`-`7` only: no sign, no space); no entry running past
     the end; after the last entry two or more whole zero blocks and nothing else. Every other
     header byte (mode, owner, times, link name, user and group names, device numbers, the
     unused tail) and the padding after the data is ignored and never applied: the shell writes
     files with its own permissions.
  3. Entries, the first fault in archive order, each entry checked in this order:
     - `ENTRY_TYPE`: the type byte is `0` (a NUL type is refused too);
     - `ENTRY_NAME`: the path is the name field, or `prefix/name` when the prefix field is not
       empty, each field read up to its first NUL. It is 1 to 255 bytes, each 0x21-0x7E except
       `\` (0x5C), and split on `/` no segment is empty, `.` or `..` (`isSafeEntryName`);
     - `DUPLICATE`: it collides with no other path, ignoring ASCII case: neither the same path
       nor a file where another path needs a directory. The iOS Simulator's volume ignores case.
  4. `NO_INDEX`: no `index.html` at the root, in that exact case; then the env copy's own
     checks on it, `HAS_ENV` and `NO_HEAD` (below). The release makes them too, so it never
     publishes what the phones' env copy refuses.

  A shell that decodes and reads the tar as it goes stops checking entries after its first entry
  fault but reads the tar on to its end, because a TAR fault further on outranks it. After a TAR
  fault it stops reading the tar. Either way it drains the xz stream to its end, because an XZ
  fault outranks both.
- **The env copy** (`scripts/ota-env.mjs`), in this order: `NO_ENV` unless the built-in page
  holds the element, the first match of the literal `<script>window.__ENV` through the next
  `</script>` (no attributes); `HAS_ENV` if the staged page holds the literal
  `<script>window.__ENV`; `NO_HEAD` unless it holds the literal `<head>`. Then the element goes,
  as it is, right after the first `<head>`. As it is: no replacement-pattern API (`$&` in Java's
  `replaceFirst` and JS's `replace` would be read as a pattern).
- **The decision**, once a manifest verifies, in this order:
  1. `drop` (every OTA bundle) if the version is at or below the built-in one;
  2. `nothing` if it is the active or the pending bundle's version, or marked bad;
  3. `nothing` if its `bridgeLevel` is above the shell's;
  4. else `download`.

  Versions compare as three numbers everywhere, so 1.10.0 is above 1.9.0. **The built-in
  version** is the `x.y.z` of the web release the shell's built-in bundle was built from, stamped
  into the binary at build time. It is never the store version (`versionName`,
  `CFBundleShortVersionString`), which counts something else.

### Not pinned

The release never writes these, and the SHA-256 in a signed payload leaves no one else to:
- numbers spelled `1.0` or `1e0`; `bridgeLevel` above 2^31 - 1 and `size` above 2^53;
- a key twice in the payload;
- xz filter chains other than LZMA2 alone, check types other than CRC64, a limit on the
  dictionary or the decoded size.

In the unsigned envelope, a key twice, a lone surrogate escape, invalid UTF-8 (which a case,
stored as a JSON string, cannot carry) and deep nesting are not pinned either: whatever a shell
makes of them, the signature must still verify over the same payload bytes, so nothing is gained
by them. A shell must not crash on them, though: it parses without recursion or refuses nesting
past a bound with `ENVELOPE`. Only whoever can already write `mobile.json` can send them.

### Running and changing them

- **Run them** with `npm run test:ota` in `apps/mobile`. `ota-fixtures.test.mjs` also fails when
  the committed outcomes, the payload of each manifest or what each bundle decodes to differ from
  what the generator writes (its keys, signatures and compressed bytes change on every run). The
  shells' unit tests are to read the same files once their updater exists: iOS from a SwiftPM
  package through `swift test`, Android as JVM tests with `apps/mobile/ota/fixtures` as a
  resource directory (the Conscrypt uber jar, 2.5.2, ships natives for linux-x86_64 and
  osx-x86_64, none for Apple Silicon).
- **To change a case**, edit `scripts/ota-fixtures.mjs` (manifest and bundle cases) or the two
  hand-written files, run `npm run ota:fixtures` in `apps/mobile`, and commit everything it
  writes, in the same PR as the change to the scripts and both shells. The generator states each
  outcome itself instead of asking `ota-verify.mjs`, and writes its malformed headers with its
  own checksum, so a bug in the reader fails a case instead of becoming one. The only format code
  it shares with the scripts is `writeTar` (for the well-formed bundles), the xz settings and
  `keyIdOf`, and the test works the key ids out again on its own. Every run makes new keys, whose private halves it
  does not keep, and new signatures.

## Signing keys (one-time setup)

The release signs with `MOBILE_OTA_SIGNING_KEY`, a repository secret like the desktop's
`TAURI_SIGNING_PRIVATE_KEY`; the shells will trust the two public keys in
`apps/mobile/ota/keys.json` (`current` signs, `next` is the rotation key). The private keys never
enter a repository: `ota-keygen.mjs` refuses a path inside any git work tree, and
`ota-verify.mjs` refuses a `keys.json` that holds anything but PEM public keys.

1. Create both keys, each private half outside every repository (if your home directory is a git
   work tree, keygen refuses it: pick a directory that is not):

   ```bash
   node apps/mobile/scripts/ota-keygen.mjs current ~/ota-current.pem
   node apps/mobile/scripts/ota-keygen.mjs next ~/ota-next.pem
   ```

2. Store the current key as a repository secret:

   ```bash
   gh secret set MOBILE_OTA_SIGNING_KEY --repo flamingo-stack/openframe-oss-frontend < ~/ota-current.pem
   ```

3. Move `~/ota-next.pem` into the team password manager, delete both files, and commit
   `apps/mobile/ota/keys.json`.

**Rotation:** set the secret from the `next` private key (from the password manager), move the
`next` public key to `current` in `keys.json` (leaving no `next`), then create a new one with
`node apps/mobile/scripts/ota-keygen.mjs next ~/ota-next.pem` and store it as in step 3. The
phones already trust the old `next` key, so the switch needs no store release; the new `next`
key reaches them with the next store build.

## Check a release by hand

It needs the `xz` CLI (`brew install xz` on macOS).

```bash
gh release download <x.y.z> --repo flamingo-stack/openframe-oss-frontend -p 'mobile.json' -p 'openframe-mobile-*.tar.xz' -D /tmp/ota
node apps/mobile/scripts/ota-verify.mjs --manifest /tmp/ota/mobile.json --bundle /tmp/ota/openframe-mobile-<x.y.z>.tar.xz
```
