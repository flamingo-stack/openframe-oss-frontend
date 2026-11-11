package ai.openframe.mobile;

import android.content.Context;
import android.net.ConnectivityManager;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.PublicKey;
import java.util.Collections;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import ai.openframe.mobile.ota.Base64Strict;
import ai.openframe.mobile.ota.BundleCheck;
import ai.openframe.mobile.ota.BundleReader;
import ai.openframe.mobile.ota.Decision;
import ai.openframe.mobile.ota.DirectorySink;
import ai.openframe.mobile.ota.EnvCopy;
import ai.openframe.mobile.ota.Manifest;
import ai.openframe.mobile.ota.OtaError;
import ai.openframe.mobile.ota.OtaKeys;
import ai.openframe.mobile.ota.OtaSession;
import okhttp3.CookieJar;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;

/**
 * One check for a newer web bundle: ask the shared gateway which release this
 * environment runs, verify its signed manifest, and when that release is not
 * on the phone yet, download, verify and unpack it as the pending bundle. All
 * of it in the background; the bundle only ever boots at a later launch, or
 * through applyPending.
 *
 * Nothing here comes from the web view. The gateway is the shared host this
 * binary was compiled with (never the one the page pushes with setTenantHost),
 * the keys are compiled in, and the env an unpacked bundle gets is the one of
 * the built-in bundle. The format rules are in apps/mobile/docs/ota.md.
 */
final class UpdateChecker {

    /**
     * Asked once by a check that has a bundle to download. Under Data Saver
     * on a metered network the shell's own check leaves the download for
     * later; one the page asked for, with the user looking at the "Update
     * required" screen, downloads all the same.
     */
    interface DownloadPermit {
        boolean granted(boolean dataSaverRestricts);
    }

    private static final String HTTPS = "https://";
    private static final String MANIFEST_PATH = "/v0/api/assets/download?agent=mobile&file=mobile.json";
    private static final int MANIFEST_LIMIT = 64 * 1024;
    private static final String INDEX = "index.html";

    /** A check that ends without an update, for a reason worded here: safe to log, unlike a transport error's own text. */
    private static final class NoUpdate extends Exception {
        NoUpdate(String message) {
            super(message);
        }
    }

    private final ShellLog log = ShellLog.update;
    private final Context context;
    private final UpdateStore store;
    private final OtaSession session;
    private final boolean hasBuiltinVersion;
    /** The env element of the built-in page, which every unpacked bundle gets; null when the page has none. */
    private final Supplier<byte[]> envElement;
    /** Null unless this binary was compiled with a shared host that is a bare https origin. */
    private final HttpUrl manifestUrl;
    private final Map<String, PublicKey> keys;
    private final OkHttpClient manifestClient;
    private final OkHttpClient bundleClient;

    UpdateChecker(Context context, UpdateStore store, OtaSession session, boolean hasBuiltinVersion, Supplier<byte[]> envElement) {
        this.context = context;
        this.store = store;
        this.session = session;
        this.hasBuiltinVersion = hasBuiltinVersion;
        this.envElement = envElement;
        this.manifestUrl = manifestUrl(BuildConfig.OPENFRAME_SHARED_HOST_URL);
        this.keys = compiledKeys();
        // No cookie and no credential: Capacitor bridges a process-wide CookieHandler to the web view's
        // jar, which HttpURLConnection would send. Redirects are followed (the gateway answers 302 to
        // the release asset), but never off https: with followSslRedirects off, OkHttp hands back a
        // 3xx that names another scheme, and a 3xx is no update.
        this.manifestClient = new OkHttpClient.Builder()
            .cookieJar(CookieJar.NO_COOKIES)
            .followRedirects(true)
            .followSslRedirects(false)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .callTimeout(15, TimeUnit.SECONDS)
            .build();
        this.bundleClient = manifestClient.newBuilder().callTimeout(10, TimeUnit.MINUTES).build();
    }

    /**
     * The manifest's address on {@code sharedHost}, or null unless that is a
     * bare https origin: a host, a port at most, and nothing else once its
     * trailing slashes are off. The address is built on it as text, so a
     * path, a query or a fragment would not be where the manifest is asked
     * for, and a user name would be a credential sent with every check.
     */
    static HttpUrl manifestUrl(String sharedHost) {
        String origin = sharedHost;
        while (origin.endsWith("/")) {
            origin = origin.substring(0, origin.length() - 1);
        }
        if (!origin.startsWith(HTTPS)) {
            return null;
        }
        // The host starts right after the scheme: OkHttp skips any further slash, either way round,
        // and would read "https:///a/b" as host "a", where iOS reads no host at all.
        String authority = origin.substring(HTTPS.length());
        if (authority.isEmpty() || authority.charAt(0) == '/' || authority.charAt(0) == '\\') {
            return null;
        }
        HttpUrl url = HttpUrl.parse(origin);
        if (url == null
            || !url.username().isEmpty()
            || !url.password().isEmpty()
            || !url.encodedPath().equals("/")
            || url.encodedQuery() != null
            || url.encodedFragment() != null) {
            return null;
        }
        return HttpUrl.parse(origin + MANIFEST_PATH);
    }

    private Map<String, PublicKey> compiledKeys() {
        byte[] current = Base64Strict.decode(BuildConfig.OTA_PUBLIC_KEY_CURRENT);
        byte[] next = Base64Strict.decode(BuildConfig.OTA_PUBLIC_KEY_NEXT);
        try {
            if (current == null || next == null) {
                throw new IllegalArgumentException("not base64");
            }
            return OtaKeys.of(current, next);
        } catch (IllegalArgumentException e) {
            // The build checks keys.json, so this is a build gone wrong: with no key, every manifest is refused.
            log.error("the compiled update keys do not load: " + e.getMessage());
            return Collections.emptyMap();
        }
    }

    /** Why this build takes no over-the-air updates, or null when it does. */
    String disabledReason() {
        if (!hasBuiltinVersion) {
            return "the built-in bundle carries no release version";
        }
        if (manifestUrl == null) {
            return "no shared host is compiled in as a bare https origin";
        }
        if (envElement.get() == null) {
            return "the built-in index.html has no window.__ENV script";
        }
        return null;
    }

    /**
     * One check, for a build that takes updates ({@link #disabledReason} is
     * null) in a process that has booted. The manifest is asked for whatever
     * the network: it is at most 64 KiB, and a rollback or a kill is all in
     * it. Only the bundle's download waits on {@code permit}.
     */
    void run(String trigger, DownloadPermit permit) {
        log.notice("check (" + trigger + "): asking the shared gateway which release this environment runs");
        store.wipeStaging();
        try {
            Manifest.Payload payload = Manifest.verify(fetchManifest(), keys);
            Decision decision = session.decide(NativeUpdate.BRIDGE_LEVEL, payload.version, payload.bridgeLevel);
            log.notice("check: the environment runs " + payload.version + ", bridge level " + payload.bridgeLevel + ": " + decision);
            switch (decision) {
                case DROP:
                    session.drop();
                    break;
                case NOTHING:
                    session.nothing(payload.version);
                    break;
                case DOWNLOAD:
                    download(payload, permit);
                    break;
            }
        } catch (NoUpdate e) {
            log.notice("check: no update: " + e.getMessage());
        } catch (OtaError e) {
            log.error("check: refused, " + e.code + ": " + e.getMessage());
        } catch (IOException e) {
            log.error("check: failed: " + e.getMessage());
        } finally {
            store.wipeStaging();
        }
    }

    private boolean dataSaverRestricts() {
        ConnectivityManager connectivity = context.getSystemService(ConnectivityManager.class);
        return connectivity != null
            && connectivity.isActiveNetworkMetered()
            && connectivity.getRestrictBackgroundStatus() == ConnectivityManager.RESTRICT_BACKGROUND_STATUS_ENABLED;
    }

    private byte[] fetchManifest() throws NoUpdate {
        try (Response response = get(manifestClient, manifestUrl, "the manifest")) {
            ByteArrayOutputStream manifest = new ByteArrayOutputStream();
            InputStream in = body(response).byteStream();
            byte[] chunk = new byte[8 * 1024];
            for (int read; (read = in.read(chunk)) != -1; ) {
                if (manifest.size() + read > MANIFEST_LIMIT) {
                    throw new NoUpdate("the manifest is over " + MANIFEST_LIMIT + " bytes");
                }
                manifest.write(chunk, 0, read);
            }
            return manifest.toByteArray();
        } catch (IOException e) {
            throw broken("the manifest", e);
        }
    }

    private void download(Manifest.Payload payload, DownloadPermit permit) throws NoUpdate, IOException {
        String version = payload.version;
        if (session.isUsable(version)) {
            // Left by a process that died between the move into place and the state write, or still
            // here as the directory this process booted from. Either way it was verified before the move,
            // and by a build with this env.
            log.notice("check: bundle " + version + " is on the phone already: pending without a download");
            session.downloaded(version);
            return;
        }
        if (!permit.granted(dataSaverRestricts())) {
            log.notice("check: bundle " + version + " is not downloaded now: Data Saver is on and the network is metered");
            return;
        }
        File staging = store.staging();
        File archive = new File(staging, Manifest.bundleName(version));
        File unpacked = new File(staging, version);
        try {
            fetchBundle(payload, archive);
            byte[] index;
            try (DirectorySink sink = new DirectorySink(unpacked)) {
                index = BundleReader.readVerified(archive, payload.size, payload.sha256, sink);
            }
            log.notice("check: bundle " + version + " downloaded, " + payload.size + " bytes, SHA-256 as signed");
            try (OutputStream out = new FileOutputStream(new File(unpacked, INDEX))) {
                out.write(EnvCopy.insert(envElement.get(), index));
            }
            store.install(unpacked, version);
            session.downloaded(version);
            log.notice("check: bundle " + version + " unpacked and pending: it boots at the next launch");
        } catch (OtaError e) {
            log.error("check: bundle " + version + " refused, " + e.code + ": " + e.getMessage());
            if (e.isContentRefusal()) {
                // Its bytes are the signed ones, so the next download would be refused the same way.
                session.markBad(version);
                log.error("check: bundle " + version + " marked bad: it is not downloaded again");
            }
        }
    }

    /**
     * Streams the bundle to {@code archive}, giving up at the first byte past
     * its signed size. Nothing else is settled here: whether the file is as
     * long and hashes as signed is {@link BundleReader#readVerified}'s to say,
     * before it decodes a byte.
     */
    private void fetchBundle(Manifest.Payload payload, File archive) throws NoUpdate, OtaError, IOException {
        HttpUrl url = HttpUrl.parse(payload.url);
        if (url == null) {
            throw new NoUpdate("the manifest's url does not parse");
        }
        BundleCheck cap = new BundleCheck(payload.size, payload.sha256);
        try (Response response = get(bundleClient, url, "the bundle"); OutputStream out = new FileOutputStream(archive)) {
            InputStream in = body(response).byteStream();
            byte[] chunk = new byte[64 * 1024];
            for (;;) {
                int read;
                try {
                    read = in.read(chunk);
                } catch (IOException e) {
                    throw broken("the bundle", e);
                }
                if (read == -1) {
                    break;
                }
                cap.update(chunk, 0, read);
                out.write(chunk, 0, read);
            }
        }
    }

    /** A 2xx answer over https, redirects followed. */
    private static Response get(OkHttpClient client, HttpUrl url, String what) throws NoUpdate {
        Response response;
        try {
            response = client.newCall(new Request.Builder().url(url).build()).execute();
        } catch (IOException e) {
            throw broken(what, e);
        }
        if (!response.isSuccessful() || !response.request().url().isHttps()) {
            int status = response.code();
            response.close();
            throw new NoUpdate(what + " was answered with HTTP " + status);
        }
        return response;
    }

    private static ResponseBody body(Response response) throws NoUpdate {
        ResponseBody body = response.body();
        if (body == null) {
            throw new NoUpdate("an answer without a body");
        }
        return body;
    }

    /** Only the kind of a transport error is logged: its text can quote the URL of a redirect, query and all. */
    private static NoUpdate broken(String what, IOException e) {
        return new NoUpdate(what + " could not be fetched (" + e.getClass().getSimpleName() + ")");
    }
}
