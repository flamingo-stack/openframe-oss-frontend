package ai.openframe.mobile;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;

import androidx.browser.customtabs.CustomTabsIntent;

import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Opens external web pages in a Custom Tab instead of the default browser.
 * Capacitor asks every plugin first ({@code Bridge.launchIntent}); its own fallback
 * for an off-origin URL is a plain ACTION_VIEW. Mirrors iOS {@code ExternalLinksPlugin.swift}
 * (SFSafariViewController).
 *
 * <p>Still left to the system: store pages, links whose default handler is an installed
 * app (Android 11+), and every non-web scheme ({@code mailto:}, {@code tel:}, the update
 * screen's {@code market:}, the OAuth callback).
 */
@CapacitorPlugin(name = "ExternalLinks")
public class ExternalLinksPlugin extends Plugin {
    /**
     * A Custom Tab would render these as a web page instead of opening the store. Must
     * cover the host of {@code GOOGLE_PLAY_URL} in {@code apps/web/src/lib/mobile-app-links.ts}:
     * the update screen's https fallback arrives here through {@code location.assign}. Kept
     * identical to iOS {@code systemHosts}; the other platform's store renders as a web page
     * either way.
     */
    private static final List<String> SYSTEM_HOSTS = Arrays.asList("apps.apple.com", "itunes.apple.com", "play.google.com");

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        String scheme = url.getScheme();
        String host = url.getHost();
        if (scheme == null || host == null) {
            return null;
        }
        scheme = scheme.toLowerCase(Locale.ROOT);
        host = host.toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            return null;
        }
        if (SYSTEM_HOSTS.contains(host) || isAppUrl(scheme, host)) {
            return null;
        }
        if (openInDefaultApp(url)) {
            return true;
        }
        try {
            new CustomTabsIntent.Builder().build().launchUrl(getActivity(), url);
        } catch (ActivityNotFoundException e) {
            // No browser at all: Capacitor's own ACTION_VIEW gets the same answer.
            return null;
        }
        return true;
    }

    /**
     * The test {@code Bridge.launchIntent} applies before it hands a URL out of the WebView,
     * repeated because Capacitor exposes no predicate: re-check it on a Capacitor bump.
     */
    private boolean isAppUrl(String scheme, String host) {
        Uri app = Uri.parse(bridge.getAppUrl());
        return (host.equalsIgnoreCase(app.getHost()) && scheme.equalsIgnoreCase(app.getScheme()))
            || bridge.getAppAllowNavigationMask().matches(host);
    }

    /**
     * Android 11+: an app that is the default handler for the link (Teams, Zoom, …) opens
     * it, as it would from the browser. From Android 12 only an app approved for the domain
     * (a verified App Link, or one the user picked in its settings) can be that default.
     * {@code FLAG_ACTIVITY_REQUIRE_DEFAULT} keeps a chooser out of it: on Android 11 an
     * unverified app also matches, and a dismissed chooser would drop the link.
     */
    private boolean openInDefaultApp(Uri url) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            return false;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, url)
            .addCategory(Intent.CATEGORY_BROWSABLE)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_REQUIRE_NON_BROWSER
                | Intent.FLAG_ACTIVITY_REQUIRE_DEFAULT);
        try {
            getActivity().startActivity(intent);
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        }
    }
}
