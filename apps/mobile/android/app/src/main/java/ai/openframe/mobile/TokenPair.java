package ai.openframe.mobile;

import com.getcapacitor.JSObject;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Objects;

import okhttp3.Response;

/**
 * The session's token pair as the shell holds it — the Android twin of
 * {@code TokenPair} in ios/App/App/TokenStore.swift. Either half may be absent
 * (a rotation response can carry one token or both), and {@link #merge} is how
 * an arrival carrying one is applied without blanking the other.
 *
 * {@link #ACCESS_KEY} / {@link #REFRESH_KEY} are the one spelling of the two
 * halves on every surface: the bridge (a getTokens/setTokens result, the
 * tokenUpdate event) AND the stored blob, deliberately — so renaming a bridge
 * field is a storage migration for every installed session, not a rename.
 */
final class TokenPair {

    static final String ACCESS_KEY = "accessToken";
    static final String REFRESH_KEY = "refreshToken";

    static final TokenPair EMPTY = new TokenPair(null, null);

    final String access;
    final String refresh;

    TokenPair(String access, String refresh) {
        this.access = blankToNull(access);
        this.refresh = blankToNull(refresh);
    }

    boolean isEmpty() {
        return access == null && refresh == null;
    }

    /** This pair with the present halves of {@code incoming} applied over it. */
    TokenPair merge(TokenPair incoming) {
        return new TokenPair(
            incoming.access != null ? incoming.access : access,
            incoming.refresh != null ? incoming.refresh : refresh);
    }

    /** The stored blob — the same JSON as the bridge payload; an absent half is omitted, never nulled. */
    String encode() {
        return toJS().toString();
    }

    /** The pair as the gateway returns it — the Access-Token / Refresh-Token response headers of an exchange or a refresh. */
    static TokenPair fromHeaders(Response response) {
        return new TokenPair(response.header("Access-Token"), response.header("Refresh-Token"));
    }

    /** The pair in a stored blob; empty when null or unparseable. */
    static TokenPair decode(String blob) {
        if (blob == null) {
            return EMPTY;
        }
        try {
            JSONObject json = new JSONObject(blob);
            return new TokenPair(json.optString(ACCESS_KEY, null), json.optString(REFRESH_KEY, null));
        } catch (JSONException e) {
            return EMPTY;
        }
    }

    JSObject toJS() {
        JSObject result = new JSObject();
        if (access != null) {
            result.put(ACCESS_KEY, access);
        }
        if (refresh != null) {
            result.put(REFRESH_KEY, refresh);
        }
        return result;
    }

    @Override
    public boolean equals(Object other) {
        if (!(other instanceof TokenPair)) {
            return false;
        }
        TokenPair that = (TokenPair) other;
        return Objects.equals(access, that.access) && Objects.equals(refresh, that.refresh);
    }

    @Override
    public int hashCode() {
        return Objects.hash(access, refresh);
    }

    private static String blankToNull(String value) {
        return value == null || value.isEmpty() ? null : value;
    }
}
