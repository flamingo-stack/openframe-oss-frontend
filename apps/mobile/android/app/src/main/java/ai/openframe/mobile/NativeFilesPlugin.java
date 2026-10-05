package ai.openframe.mobile;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import androidx.activity.result.ActivityResult;
import androidx.annotation.RequiresApi;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Android port of the iOS NativeFilesPlugin (ios/App/App/NativeFilesPlugin.swift).
 * Same jsName ("NativeFiles") and JS contract, so the frontend
 * (openframe-frontend: src/lib/native-files.ts) works unchanged.
 *
 * - downloadFile: Capacitor's Android WebView never calls setDownloadListener, so
 *   the web pattern (URL.createObjectURL + `<a download>.click()`) is a SILENT
 *   no-op — same as iOS. Fetch over HttpURLConnection and write into the public
 *   Downloads collection instead.
 * - pickFiles / uploadFile: presigned upload URLs point at storage.googleapis.com
 *   and the WebView sends `Origin: https://localhost`, which a bucket CORS policy
 *   would have to name explicitly. Picking natively yields a file PATH, so the
 *   upload streams from disk — no CORS to satisfy, and no base64-encoded file
 *   crossing the JS bridge.
 *
 * ACTION_OPEN_DOCUMENT already surfaces Photos alongside Files, so this needs no
 * separate photo picker (unlike iOS) and no storage permission.
 */
@CapacitorPlugin(name = "NativeFiles")
public class NativeFilesPlugin extends Plugin {

    private static final String STAGING_DIR = "openframe-files";

    /**
     * Every task submitted here catches {@code Exception}, not {@code IOException}:
     * an unchecked throw escaping an executor task reaches the default handler and
     * kills the process instead of rejecting the call.
     */
    private final ExecutorService io = Executors.newSingleThreadExecutor();

    /** Guards against a second pick overwriting Capacitor's single saved call id. */
    private boolean pickInFlight;

    // ─── Pick ────────────────────────────────────────────────────────────────

    /**
     * Opens the system document picker and resolves with staged copies of the
     * selection: {@code { files: [{ path, name, mimeType, size }] }}. A cancelled
     * pick resolves with an empty array rather than rejecting — the caller's job
     * is simply to attach nothing.
     */
    @PluginMethod
    public void pickFiles(PluginCall call) {
        // Capacitor keys the activity result off ONE lastPluginCallId per plugin,
        // so a second pick before the first result overwrites it and strands the
        // first JS promise forever. Mirrors the iOS ALREADY_PRESENTING guard.
        synchronized (this) {
            if (pickInFlight) {
                call.reject("A file picker is already open", "ALREADY_PRESENTING");
                return;
            }
            pickInFlight = true;
        }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        if (Boolean.TRUE.equals(call.getBoolean("multiple", false))) {
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        }
        startActivityForResult(call, intent, "handlePickResult");
    }

    @ActivityCallback
    private void handlePickResult(PluginCall call, ActivityResult result) {
        synchronized (this) {
            pickInFlight = false;
        }
        if (call == null) {
            return;
        }
        JSObject empty = new JSObject();
        empty.put("files", new JSArray());
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            call.resolve(empty);
            return;
        }

        List<Uri> uris = new ArrayList<>();
        ClipData clip = data.getClipData();
        if (clip != null) {
            for (int i = 0; i < clip.getItemCount(); i++) {
                uris.add(clip.getItemAt(i).getUri());
            }
        } else if (data.getData() != null) {
            uris.add(data.getData());
        }
        if (uris.isEmpty()) {
            call.resolve(empty);
            return;
        }

        // A content:// URI is only readable while the picker grant lasts, and it
        // carries no path an upload can stream from, so copy each selection into
        // our own cache before returning.
        io.execute(() -> {
            JSArray files = new JSArray();
            try {
                for (Uri uri : uris) {
                    files.put(stageSelection(uri));
                }
            } catch (Exception e) {
                // A third-party DocumentsProvider can throw SecurityException or
                // IllegalArgumentException from query/openInputStream.
                call.reject("Could not read the selected file: " + describe(e));
                return;
            }
            JSObject response = new JSObject();
            response.put("files", files);
            call.resolve(response);
        });
    }

    private JSObject stageSelection(Uri uri) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        String name = displayName(resolver, uri);
        File destination = prepareStagingFile(name);

        try (InputStream in = resolver.openInputStream(uri);
             OutputStream out = new FileOutputStream(destination)) {
            if (in == null) {
                throw new IOException("cannot open " + uri);
            }
            copy(in, out);
        }

        String mimeType = resolver.getType(uri);
        JSObject entry = new JSObject();
        entry.put("path", destination.getAbsolutePath());
        entry.put("name", destination.getName());
        entry.put("mimeType", mimeType != null ? mimeType : guessMimeType(destination.getName()));
        entry.put("size", destination.length());
        return entry;
    }

    private String displayName(ContentResolver resolver, Uri uri) {
        try (Cursor cursor = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst() && !cursor.isNull(0)) {
                return safeFileName(cursor.getString(0));
            }
        }
        return safeFileName(uri.getLastPathSegment());
    }

    // ─── Upload ──────────────────────────────────────────────────────────────

    /**
     * Streams a staged file to a presigned URL with PUT. Fixed-length streaming
     * keeps a large attachment out of memory — nothing is buffered whole.
     */
    @PluginMethod
    public void uploadFile(PluginCall call) {
        String path = call.getString("path");
        String urlString = call.getString("url");
        if (path == null || path.isEmpty()) {
            call.reject("Missing 'path'");
            return;
        }
        if (urlString == null || urlString.isEmpty()) {
            call.reject("Missing or invalid 'url'");
            return;
        }
        String contentType = call.getString("contentType");

        io.execute(() -> {
            File file = new File(path);
            HttpURLConnection conn = null;
            try {
                // `path` arrives from JS, gets streamed to an arbitrary URL and then
                // deleted, so refuse anything this plugin did not stage itself.
                // Mirrors isStaged() in NativeFilesPlugin.swift.
                if (!isStaged(file)) {
                    call.reject("'path' is not a staged file");
                    return;
                }
                conn = (HttpURLConnection) new URL(urlString).openConnection();
                conn.setRequestMethod("PUT");
                conn.setDoOutput(true);
                conn.setFixedLengthStreamingMode(file.length());
                conn.setRequestProperty(
                    "Content-Type",
                    contentType != null ? contentType : guessMimeType(file.getName())
                );

                try (InputStream in = new FileInputStream(file);
                     OutputStream out = conn.getOutputStream()) {
                    copy(in, out);
                }

                int status = conn.getResponseCode();
                if (status < 200 || status >= 300) {
                    call.reject("Upload failed with status " + status);
                    return;
                }
                // The staged copy exists only to be uploaded; the attachment now
                // lives in the bucket.
                deleteStagingEntry(file);
                JSObject result = new JSObject();
                result.put("status", status);
                call.resolve(result);
            } catch (Exception e) {
                // The HttpURLConnection cast throws ClassCastException for a
                // non-http(s) URL.
                call.reject("Upload failed: " + describe(e));
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    // ─── Download ────────────────────────────────────────────────────────────

    /** Fetches {@code url} natively and hands the bytes to {@link #deliver}. */
    @PluginMethod
    public void downloadFile(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("Missing or invalid 'url'");
            return;
        }
        String fileName = safeFileName(call.getString("fileName"));

        io.execute(() -> {
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(urlString).openConnection();
                conn.setRequestMethod("GET");
                conn.setInstanceFollowRedirects(true);
                int status = conn.getResponseCode();
                if (status < 200 || status >= 300) {
                    call.reject("Download failed with status " + status);
                    return;
                }
                boolean savedToDownloads;
                try (InputStream in = conn.getInputStream()) {
                    savedToDownloads = deliver(in, fileName, resolveMimeType(fileName, conn.getContentType()));
                }
                // The caller announces a silent save; a share chooser announces
                // itself, so it must not be double-reported.
                JSObject result = new JSObject();
                result.put("savedToDownloads", savedToDownloads);
                call.resolve(result);
            } catch (Exception e) {
                // The HttpURLConnection cast and MediaStore.insert both throw
                // unchecked.
                call.reject("Download failed: " + describe(e));
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    /**
     * Puts a stream where the user can get at it: the public Downloads
     * collection, which needs no permission from API 29. Below that, MediaStore
     * has no Downloads collection, so the file is staged and handed to a share
     * chooser instead — which is what iOS does at every API level.
     */
    private boolean deliver(InputStream in, String fileName, String mimeType) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveToDownloads(in, fileName, mimeType);
            return true;
        }
        File staged = prepareStagingFile(fileName);
        try (OutputStream out = new FileOutputStream(staged)) {
            copy(in, out);
        }
        shareFile(staged, mimeType);
        return false;
    }

    // The SDK_INT guard lives in deliver(), which lint cannot see across the call,
    // so without this the NewApi check fails every release lane (lintVital runs in
    // the bundle/assemble-release task graph, not in assembleDebug).
    @RequiresApi(Build.VERSION_CODES.Q)
    private void saveToDownloads(InputStream in, String fileName, String mimeType) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
        values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
        // IS_PENDING hides the row until the bytes are all written, so nothing
        // can open a half-downloaded attachment.
        values.put(MediaStore.Downloads.IS_PENDING, 1);

        Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
        Uri item = resolver.insert(collection, values);
        if (item == null) {
            throw new IOException("could not create a Downloads entry");
        }
        try {
            try (OutputStream out = resolver.openOutputStream(item)) {
                if (out == null) {
                    throw new IOException("could not open the Downloads entry");
                }
                copy(in, out);
            }
            values.clear();
            values.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(item, values, null, null);
        } catch (IOException | RuntimeException e) {
            // A row abandoned at IS_PENDING=1 is invisible to the user and only
            // reclaimed by MediaStore days later, so a repeatedly-failing download
            // would silently burn storage nobody can find. The un-pend update is
            // inside the guard too — failing there strands the row just the same.
            resolver.delete(item, null, null);
            throw e;
        }
    }

    private void shareFile(File file, String mimeType) {
        Uri uri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            file
        );
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType(mimeType);
        send.putExtra(Intent.EXTRA_STREAM, uri);
        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent chooser = Intent.createChooser(send, null);
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(chooser);
    }

    // ─── Staging ─────────────────────────────────────────────────────────────

    /**
     * Staging path for {@code fileName}, in a per-file directory so two
     * attachments with the same name don't clobber each other while both are
     * pending upload. Lives under the app cache dir, which file_paths.xml already
     * exposes to the FileProvider.
     */
    private File prepareStagingFile(String fileName) throws IOException {
        File directory = new File(stagingRoot(), UUID.randomUUID().toString());
        if (!directory.mkdirs() && !directory.isDirectory()) {
            throw new IOException("could not create the staging directory");
        }
        return new File(directory, fileName);
    }

    private File stagingRoot() {
        return new File(getContext().getCacheDir(), STAGING_DIR);
    }

    /**
     * Whether {@code file} sits under the staging root. Guards the upload-and-delete
     * in {@code uploadFile}, whose path comes from JS: staging is the only tree this
     * plugin may read from or remove. The canonical form collapses {@code ../} and
     * resolves symlinks, the way {@code resolvingSymlinksInPath()} does on iOS.
     */
    private boolean isStaged(File file) {
        try {
            return file.getCanonicalPath().startsWith(stagingRoot().getCanonicalPath() + File.separator);
        } catch (IOException e) {
            return false;
        }
    }

    private void deleteStagingEntry(File file) {
        File directory = file.getParentFile();
        if (file.delete() && directory != null && directory.getParentFile() != null
            && STAGING_DIR.equals(directory.getParentFile().getName())) {
            directory.delete();
        }
    }

    /**
     * Collapses anything a server (Content-Disposition) or the JS layer supplies
     * into a single path component, so a {@code ../} in a file name cannot escape
     * the staging directory.
     */
    private static String safeFileName(String raw) {
        if (raw == null) {
            return "download";
        }
        String candidate = new File(raw).getName().trim();
        return candidate.isEmpty() || ".".equals(candidate) || "..".equals(candidate) ? "download" : candidate;
    }

    /**
     * MIME for a downloaded file, preferring the name's extension and falling back
     * to the response's own Content-Type — an attachment stored without an
     * extension would otherwise land in Downloads as octet-stream and not open.
     */
    private static String resolveMimeType(String fileName, String contentType) {
        String guessed = guessMimeType(fileName);
        if (!"application/octet-stream".equals(guessed) || contentType == null) {
            return guessed;
        }
        String bare = contentType.split(";")[0].trim();
        return bare.isEmpty() ? guessed : bare;
    }

    /** getMessage() is null for NPE and some SecurityExceptions, which would reach the user as "…: null". */
    private static String describe(Exception e) {
        return e.getMessage() != null ? e.getMessage() : e.toString();
    }

    private static String guessMimeType(String fileName) {
        // getFileExtensionFromUrl returns "" rather than null, and ROOT keeps a
        // Turkish-locale device from lowercasing "I" to a dotless "ı" and missing
        // the lookup.
        String extension = MimeTypeMap.getFileExtensionFromUrl(Uri.encode(fileName));
        String mimeType = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension.toLowerCase(Locale.ROOT));
        return mimeType != null ? mimeType : "application/octet-stream";
    }

    private static void copy(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) != -1) {
            out.write(buffer, 0, read);
        }
        out.flush();
    }
}
