package ai.openframe.mobile.ota;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * What the shell remembers about its over-the-air bundles (state.json), and
 * every rule that changes it, as functions from one state to the next: no I/O,
 * so each is tested directly and iOS follows the same ones.
 *
 * {@code active} is the bundle that reported ready and boots from now on.
 * {@code pending} is a downloaded bundle on trial: it boots first, and
 * {@code attempts} counts the boots it has had without reporting ready.
 * {@code bad} lists the versions never to download again, oldest first.
 */
public final class OtaState {

    /** A pending bundle that has booted this often without reporting ready is marked bad at the next boot. */
    public static final int MAX_TRIAL_ATTEMPTS = 2;
    static final int MAX_BAD = 20;
    private static final String SCHEMA = "1";

    public static final OtaState EMPTY = new OtaState(null, null, 0, Collections.<String>emptyList());

    public final String active;
    public final String pending;
    /** 0 without a pending bundle. */
    public final int attempts;
    public final List<String> bad;

    /** Whether the bundle of a version is on disk as one this build can run ({@link OtaSession#isUsable}). */
    public interface Usable {
        boolean test(String version);
    }

    /** A boot decision: the state to store before the web view loads, and the bundle to load (null: the built-in one). */
    public static final class Boot {
        public final OtaState state;
        public final String version;
        /** The bundle is the pending one and has yet to report ready. */
        public final boolean trial;
        /** The pending bundle this decision marked bad, its trial used up; null when it marked none. */
        public final String reverted;

        Boot(OtaState state, String version, boolean trial, String reverted) {
            this.state = state;
            this.version = version;
            this.trial = trial;
            this.reverted = reverted;
        }
    }

    private OtaState(String active, String pending, int attempts, List<String> bad) {
        this.active = active;
        this.pending = pending;
        this.attempts = attempts;
        this.bad = Collections.unmodifiableList(bad);
    }

    /** A state of these values. Every version must be a valid one. */
    public static OtaState of(String active, String pending, int attempts, List<String> bad) {
        List<String> versions = new ArrayList<>(bad);
        if (active != null) {
            versions.add(active);
        }
        if (pending != null) {
            versions.add(pending);
        }
        for (String version : versions) {
            if (!Version.isValid(version)) {
                throw new IllegalArgumentException("not a version");
            }
        }
        if (attempts < 0 || pending == null && attempts != 0) {
            throw new IllegalArgumentException("attempts without a pending bundle");
        }
        return new OtaState(active, pending, attempts, recent(new ArrayList<>(bad)));
    }

    // ─── Boot ────────────────────────────────────────────────────────────────

    /**
     * Which bundle a process boots, and the state that goes with it.
     *
     * A bundle at or below the built-in version is forgotten (a store update
     * was installed over it), as is one that is no longer usable: its
     * directory lost its index.html, or the page carries another build's env.
     * Then the pending bundle boots as a trial, unless it has used up its
     * attempts, which marks it bad; then the active one; then the built-in.
     * A trial boot counts its attempt.
     */
    public static Boot resolveBoot(OtaState state, String builtinVersion, Usable usable) {
        String active = usable(state.active, builtinVersion, usable);
        String pending = usable(state.pending, builtinVersion, usable);
        List<String> bad = new ArrayList<>();
        for (String version : state.bad) {
            if (Version.compare(version, builtinVersion) > 0) {
                bad.add(version);
            }
        }
        String reverted = null;
        if (pending != null && state.attempts >= MAX_TRIAL_ATTEMPTS) {
            bad = withBad(bad, pending);
            reverted = pending;
            pending = null;
        }
        if (pending == null) {
            return new Boot(new OtaState(active, null, 0, bad), active, false, reverted);
        }
        int attempts = state.attempts + 1;
        return new Boot(new OtaState(active, pending, attempts, bad), pending, true, null);
    }

    private static String usable(String version, String builtinVersion, Usable usable) {
        return version != null && Version.compare(version, builtinVersion) > 0 && usable.test(version) ? version : null;
    }

    /**
     * The booted bundle reported ready. A trial becomes the active bundle. A
     * pending bundle downloaded during this session, which the page that
     * reported did not boot from, is not confirmed by it.
     */
    public static OtaState applyReady(OtaState state, String bootedVersion, boolean bootedTrial) {
        if (bootedTrial && state.pending != null && state.pending.equals(bootedVersion)) {
            return new OtaState(state.pending, null, 0, state.bad);
        }
        return state;
    }

    // ─── After a decision ────────────────────────────────────────────────────

    /** {@link Decision#DROP}: no over-the-air bundle boots again. What is bad stays bad. */
    public static OtaState applyDrop(OtaState state) {
        return new OtaState(null, null, 0, state.bad);
    }

    /**
     * {@link Decision#NOTHING}. When the release is the active bundle's while
     * another one is pending, the environment went back to the active bundle,
     * and a pending one that has not booted yet must not: it is forgotten.
     * Not the bundle this process booted as a trial, which is running.
     */
    public static OtaState applyNothing(OtaState state, String payloadVersion, String bootedVersion, boolean bootedTrial) {
        boolean pendingIsOnTrial = bootedTrial && state.pending != null && state.pending.equals(bootedVersion);
        if (payloadVersion.equals(state.active) && state.pending != null && !pendingIsOnTrial) {
            return new OtaState(state.active, null, 0, state.bad);
        }
        return state;
    }

    /** {@link Decision#DOWNLOAD}, once the bundle is verified and in place: it is the pending one, yet to boot. */
    public static OtaState applyDownloaded(OtaState state, String version) {
        return new OtaState(state.active, version, 0, state.bad);
    }

    /** The release of {@code version} is never downloaded again. */
    public static OtaState markBad(OtaState state, String version) {
        return new OtaState(state.active, state.pending, state.attempts, withBad(state.bad, version));
    }

    private static List<String> withBad(List<String> bad, String version) {
        List<String> next = new ArrayList<>(bad);
        next.remove(version);
        next.add(version);
        return recent(next);
    }

    private static List<String> recent(List<String> bad) {
        return bad.size() <= MAX_BAD ? bad : new ArrayList<>(bad.subList(bad.size() - MAX_BAD, bad.size()));
    }

    // ─── Directories ─────────────────────────────────────────────────────────

    /**
     * The directories of {@code bundles/} to delete: every one that is not the
     * active bundle's, the pending one's, or the one this process booted from,
     * which its web view is still served from.
     */
    public static List<String> staleDirectories(Collection<String> names, OtaState state, String bootedVersion) {
        List<String> stale = new ArrayList<>();
        for (String name : names) {
            if (!name.equals(state.active) && !name.equals(state.pending) && !name.equals(bootedVersion)) {
                stale.add(name);
            }
        }
        return stale;
    }

    // ─── state.json ──────────────────────────────────────────────────────────

    /** Versions are digits and dots, so nothing here needs escaping. */
    public byte[] toJson() {
        StringBuilder json = new StringBuilder("{\"schema\":").append(SCHEMA).append(",\"active\":");
        json.append(active == null ? "null" : '"' + active + '"').append(",\"pending\":");
        if (pending == null) {
            json.append("null");
        } else {
            json.append("{\"version\":\"").append(pending).append("\",\"attempts\":").append(attempts).append('}');
        }
        json.append(",\"bad\":[");
        for (int i = 0; i < bad.size(); i++) {
            json.append(i == 0 ? "\"" : ",\"").append(bad.get(i)).append('"');
        }
        return json.append("]}\n").toString().getBytes(StandardCharsets.US_ASCII);
    }

    /** The state {@code json} holds, or {@link #EMPTY} when it is anything but a whole state of this schema. */
    public static OtaState parse(byte[] json) {
        try {
            Map<String, Object> fields = Json.parseObject(json);
            Object schema = fields.get("schema");
            if (!(schema instanceof Json.Num) || !SCHEMA.equals(((Json.Num) schema).text)) {
                return EMPTY;
            }
            String active = optionalVersion(fields.get("active"));
            String pending = null;
            int attempts = 0;
            Object pendingField = fields.get("pending");
            if (pendingField instanceof Map) {
                Map<?, ?> pendingFields = (Map<?, ?>) pendingField;
                pending = version(pendingFields.get("version"));
                attempts = count(pendingFields.get("attempts"));
            } else if (pendingField != Json.NULL) {
                return EMPTY;
            }
            Object badField = fields.get("bad");
            if (!(badField instanceof List)) {
                return EMPTY;
            }
            List<String> bad = new ArrayList<>();
            for (Object version : (List<?>) badField) {
                bad.add(version(version));
            }
            return new OtaState(active, pending, attempts, recent(bad));
        } catch (Json.Malformed e) {
            return EMPTY;
        }
    }

    private static String version(Object value) throws Json.Malformed {
        if (!(value instanceof String) || !Version.isValid((String) value)) {
            throw new Json.Malformed("not a version");
        }
        return (String) value;
    }

    private static String optionalVersion(Object value) throws Json.Malformed {
        return value == Json.NULL ? null : version(value);
    }

    private static int count(Object value) throws Json.Malformed {
        if (value instanceof Json.Num) {
            String text = ((Json.Num) value).text;
            if (text.equals("0")) {
                return 0;
            }
            long count = ((Json.Num) value).positiveInteger();
            if (count >= 1 && count <= Integer.MAX_VALUE) {
                return (int) count;
            }
        }
        throw new Json.Malformed("not a count");
    }

    // ─── Value ───────────────────────────────────────────────────────────────

    @Override
    public boolean equals(Object other) {
        if (!(other instanceof OtaState)) {
            return false;
        }
        OtaState that = (OtaState) other;
        return equal(active, that.active) && equal(pending, that.pending) && attempts == that.attempts && bad.equals(that.bad);
    }

    @Override
    public int hashCode() {
        return toString().hashCode();
    }

    @Override
    public String toString() {
        return new String(toJson(), StandardCharsets.US_ASCII).trim();
    }

    private static boolean equal(String a, String b) {
        return a == null ? b == null : a.equals(b);
    }
}
