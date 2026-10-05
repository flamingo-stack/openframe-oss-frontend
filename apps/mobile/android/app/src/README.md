# Per-environment source sets

The `env` flavor dimension (`android/app/build.gradle`) declares three flavors that
install side-by-side via `applicationIdSuffix`:

| flavor  | applicationId              |
|---------|----------------------------|
| `prod`  | `ai.openframe.mobile`      |
| `stage` | `ai.openframe.mobile.stage`|
| `dev`   | `ai.openframe.mobile.dev`  |

Each binds to its own Firebase project.

## google-services.json (per env — GITIGNORED, supply out-of-band)

There are **3 Firebase projects** (prod / stage / dev). Drop each project's config at:

```
android/app/src/prod/google-services.json
android/app/src/stage/google-services.json
android/app/src/dev/google-services.json
```

These files carry the Firebase **API key + project IDs**, so they are **gitignored**
(`google-services.json` in `android/.gitignore`) and must NOT be committed — the repo may
be public. Supply them at build/CI time (secret store / CI artifact, or drop in locally
for a device build). A `google-services.json` is a client identifier bundle (no private
key), but it's kept out of version control as a precaution; a missing file only disables
push for that flavor.

The `com.google.gms.google-services` plugin is applied **conditionally** in
`app/build.gradle`: only when a `google-services.json` exists at the module root or in one
of these flavor source sets. This keeps `assembleDebug` / `assembleDevDebug` buildable
before the files land; once a flavor's file is added, building **that** flavor consumes it
(building a flavor whose file is still absent then fails at the plugin's own check).

## Release signing (secrets — NOT committed)

The `release` buildType signs only when all of these are supplied via
`android/gradle.properties`, `~/.gradle/gradle.properties`, or environment variables
(env wins over gradle props). When any are missing, `release` builds fall back to the
default (debug-key / unsigned) path so debug/CI builds keep working:

| gradle property          | env var                   | meaning                    |
|--------------------------|---------------------------|----------------------------|
| `OF_UPLOAD_STORE_FILE`   | `OF_UPLOAD_STORE_FILE`    | path to the keystore (.jks)|
| `OF_UPLOAD_STORE_PASSWORD`| `OF_UPLOAD_STORE_PASSWORD`| keystore password          |
| `OF_UPLOAD_KEY_ALIAS`    | `OF_UPLOAD_KEY_ALIAS`     | signing key alias          |
| `OF_UPLOAD_KEY_PASSWORD` | `OF_UPLOAD_KEY_PASSWORD`  | key password               |

The keystore file itself and any `gradle.properties` carrying these values are gitignored
(`*.jks`, `*.keystore`, `keystore.properties`, `signing.properties`). No keystore is
committed or generated here — create one with `keytool` and point `OF_UPLOAD_STORE_FILE`
at it.

Example (build a signed release AAB for stage):

```
OF_UPLOAD_STORE_FILE=$HOME/keys/openframe-upload.jks \
OF_UPLOAD_STORE_PASSWORD=… OF_UPLOAD_KEY_ALIAS=upload OF_UPLOAD_KEY_PASSWORD=… \
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
./gradlew bundleStageRelease
```
