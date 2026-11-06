# Over-the-air web bundles

The mobile shells will update their web bundle without a store release, the way the desktop app
takes `updater.json`. This page covers the release side, which is in place; the shells' updater
(`NativeUpdate`) is not built yet, so nothing on a phone reads these files today. Design:
vault `OpenFrame/Mobile - OTA Web Bundle Updates (plan)`.

## What a release publishes

Every release dispatch of `.github/workflows/release.yml` attaches two files to the `x.y.z` release:

| File | What it is |
|---|---|
| `openframe-mobile-<x.y.z>.zip` | The web static export, built with no `NEXT_PUBLIC_*` in the job's environment and no `window.__ENV` in it. One bundle for every environment: a phone copies the `window.__ENV` script of its own built-in bundle into it, so each app keeps its shared host and dev-ticket setting. (The committed `apps/web/.env.local` still loads at build time, as it does for the desktop and store bundles; the app reads those values from `window.__ENV` at runtime, so only build-time metadata such as `og:url` carries them.) |
| `mobile.json` | Its manifest: `{keyId, payload, signature}`. `payload` is base64 of `{format, version, bridgeLevel, url, size, sha256}`; `signature` is ECDSA P-256 / SHA-256 over those payload bytes, DER, base64. |

- `mobile_ota_build` builds the export with no secret in the job; `mobile_ota_sign` packs and
  signs it with no npm install in the job, then checks the result against
  `apps/mobile/ota/keys.json`. A failure in either fails the release, like a desktop leg.
- `bridgeLevel` is `REQUIRED_BRIDGE_LEVEL` in `apps/web/src/lib/native-shell.ts`.
- `keyId` is the first 16 hex digits of SHA-256 over the signing key's public SPKI DER.
- The zip holds regular files only, plain-ASCII names, no directories or symlinks, fixed
  timestamps (`scripts/ota-zip.mjs`); the same export packs to the same bytes.

The scripts are `scripts/ota-pack.mjs`, `scripts/ota-verify.mjs` and `scripts/ota-keygen.mjs`;
`node --test apps/mobile/scripts/ota.test.mjs` runs their tests, and the PR check
**Mobile OTA Scripts** runs them plus `ota-verify.mjs` on `keys.json`.

## How phones get it

The shared host's gateway serves it, as it serves the desktop's `updater.json`: entries beside
`desktop` under `openframe.gateway.agent-download` in openframe-saas-shared's base config
(block style: `${...}` is not valid inside a YAML flow mapping):

```yaml
assets:
  mobile:
    ios: openframe-mobile-*.zip
    android: openframe-mobile-*.zip
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
`saas.frontend.image.tag`; dev's `latest` is GitHub's Latest release). The manifest names the zip
by its direct release URL. A pinned release without `mobile.json` (any release before the first
one this job built) answers 502 on every request, uncached, so pin no such release once phones
ask for it.

## Signing keys (one-time setup)

The release signs with `MOBILE_OTA_SIGNING_KEY`, a secret of the GitHub environment
`mobile-ota`; the shells will trust the two public keys in `apps/mobile/ota/keys.json`
(`current` signs, `next` is the rotation key). The private keys never enter the repository.

1. Create both keys, each private half outside the repository:

   ```bash
   node apps/mobile/scripts/ota-keygen.mjs current ~/ota-current.pem
   node apps/mobile/scripts/ota-keygen.mjs next ~/ota-next.pem
   ```

2. Create the environment `mobile-ota` (repository Settings → Environments) with deployment
   branches limited to `main`, and store the current key in it:

   ```bash
   gh secret set MOBILE_OTA_SIGNING_KEY --env mobile-ota --repo flamingo-stack/openframe-oss-frontend < ~/ota-current.pem
   ```

3. Move `~/ota-next.pem` into the team password manager, delete both files, and commit
   `apps/mobile/ota/keys.json`.

**Rotation:** set the secret from the `next` private key (from the password manager), move the
`next` public key to `current` in `keys.json` (leaving no `next`), then create a new one with
`node apps/mobile/scripts/ota-keygen.mjs next ~/ota-next.pem` and store it as in step 3. The
phones already trust the old `next` key, so the switch needs no store release; the new `next`
key reaches them with the next store build.

## Check a release by hand

```bash
gh release download <x.y.z> --repo flamingo-stack/openframe-oss-frontend -p 'mobile.json' -p 'openframe-mobile-*.zip' -D /tmp/ota
node apps/mobile/scripts/ota-verify.mjs --manifest /tmp/ota/mobile.json --zip /tmp/ota/openframe-mobile-<x.y.z>.zip
```
