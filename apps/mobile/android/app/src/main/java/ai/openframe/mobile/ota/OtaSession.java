package ai.openframe.mobile.ota;

import java.io.IOException;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.function.Supplier;

/**
 * One process's view of its over-the-air bundles: the state on disk, and the
 * bundle the process runs, decided at each launch and kept until the next.
 * A launch is a cold start, and also a start of the Activity from nothing in
 * a process the system kept ({@link #boot}); an Activity the system creates
 * again is none, and runs the bundle it ran ({@link #recreated}).
 *
 * Every change is written to the {@link Store} before it takes effect here,
 * and every method that reads or changes it holds this object's lock, so the
 * changes are one at a time whichever thread they come from: the boot on the
 * main thread, the bridge's calls, the background check.
 */
public final class OtaSession {

    /** Where the state and the bundles live. */
    public interface Store {
        /**
         * The stored state: {@link OtaState#EMPTY} when there is none or it does not parse.
         *
         * @throws IOException the state is there and cannot be read right now
         */
        OtaState read() throws IOException;

        /** Replaces the stored state, atomically. */
        void write(OtaState state) throws IOException;

        /** The index.html of the bundle of {@code version}, or null when its directory holds none that can be read. */
        byte[] index(String version);
    }

    /** The bundle a process runs: {@code version} null for the built-in one. */
    public static final class Booted {
        public final String version;
        /** A downloaded bundle that has yet to report ready. */
        public final boolean trial;
        /** The bundle this launch marked bad instead of booting it, its trial used up; null when it marked none. */
        public final String reverted;

        Booted(String version, boolean trial, String reverted) {
            this.version = version;
            this.trial = trial;
            this.reverted = reverted;
        }
    }

    /** What {@link #applyPending} did. */
    public static final class Applied {
        /** The version to load now, or null when there is no pending bundle to switch to. */
        public final String version;
        /** The pending bundle marked bad instead, its trial used up; null when none was. */
        public final String reverted;

        Applied(String version, String reverted) {
            this.version = version;
            this.reverted = reverted;
        }
    }

    private static final Booted BUILTIN = new Booted(null, false, null);
    private static final Applied NOT_APPLIED = new Applied(null, null);

    private final String builtinVersion;
    private final Supplier<byte[]> envElement;
    private final Store store;
    private OtaState state = OtaState.EMPTY;
    private Booted booted;
    /** Booted, with a state that was read: before that, and without it, nothing here writes the store. */
    private boolean live;

    /**
     * @param builtinVersion the release the built-in bundle was built from, or null when the binary carries no valid stamp
     * @param envElement     the built-in page's env element, or null when it has none; asked for only when a bundle is looked at
     */
    public OtaSession(String builtinVersion, Supplier<byte[]> envElement, Store store) {
        this.builtinVersion = builtinVersion;
        this.envElement = envElement;
        this.store = store;
    }

    /**
     * Whether the bundle of {@code version} is on disk as one this build can
     * run: its index.html is there and holds this build's env element. Every
     * bundle got that element when it was unpacked, so one without it was
     * unpacked by a build with another env, before a store update: run here,
     * it would talk to that build's hosts.
     */
    public boolean isUsable(String version) {
        byte[] element = envElement.get();
        byte[] index = element == null ? null : store.index(version);
        return index != null && EnvCopy.carries(index, element);
    }

    /**
     * A launch: decides which bundle boots, from the state as the store holds
     * it now. A trial is counted in the store before this returns, so before
     * the web view loads it. Without a built-in version, or with a state that
     * cannot be read right now, the built-in bundle boots and the store is
     * left alone until the next launch.
     *
     * The first call of a process is a cold start. A later one is the user
     * coming back after leaving with Back, in a process the system kept: it
     * decides again exactly as a cold start would, or a downloaded bundle, a
     * revert and a drop would all wait for the process to die, which can take
     * days.
     */
    public synchronized Booted boot() {
        booted = BUILTIN;
        live = false;
        state = OtaState.EMPTY;
        if (builtinVersion == null) {
            return booted;
        }
        try {
            state = store.read();
        } catch (IOException e) {
            return booted;
        }
        live = true;
        OtaState.Boot boot = OtaState.resolveBoot(state, builtinVersion, this::isUsable);
        try {
            commit(boot.state);
            booted = new Booted(boot.version, boot.trial, boot.reverted);
        } catch (IOException e) {
            // A trial that cannot be counted could fail at every launch and never be reverted,
            // so it does not boot: the active bundle does, or the built-in one.
            booted = new Booted(boot.state.active, false, null);
        }
        return booted;
    }

    /**
     * The bundle of an Activity the system created again (a configuration
     * change, a task it restored): the one the process runs, with nothing
     * decided again and no attempt counted. Unless that bundle is no longer
     * usable. A web view cannot load it then, so the built-in bundle does,
     * and is what the process runs from here on: a ready report from its
     * page confirms nothing. The state is left for the next launch to settle.
     *
     * In a process that has not booted, which the system started to restore
     * the Activity into, this is its boot.
     */
    public synchronized Booted recreated() {
        if (booted == null) {
            return boot();
        }
        if (booted.version != null && !isUsable(booted.version)) {
            booted = BUILTIN;
        }
        return booted;
    }

    /** The bundle the process runs, or null before its first launch. */
    public synchronized Booted booted() {
        return booted;
    }

    /** Whether this process may change the store: it has booted, with a built-in version and a state it could read. */
    public synchronized boolean isLive() {
        return live;
    }

    public synchronized OtaState state() {
        return state;
    }

    /**
     * The booted bundle works. A trial becomes the active bundle; from the
     * built-in or the active bundle there is nothing to do.
     *
     * @return whether a trial was confirmed
     */
    public synchronized boolean notifyReady() throws IOException {
        if (!live) {
            return false;
        }
        OtaState next = OtaState.applyReady(state, booted.version, booted.trial);
        if (next.equals(state)) {
            return false;
        }
        commit(next);
        booted = new Booted(booted.version, false, null);
        return true;
    }

    /**
     * Makes the pending bundle the booted one, as a trial, with the
     * bookkeeping of a boot: an attempt counted, or the bundle marked bad when
     * it has none left.
     */
    public synchronized Applied applyPending() throws IOException {
        if (!live || state.pending == null || state.pending.equals(booted.version)) {
            return NOT_APPLIED;
        }
        OtaState.Boot boot = OtaState.resolveBoot(state, builtinVersion, this::isUsable);
        commit(boot.state);
        if (!boot.trial) {
            return new Applied(null, boot.reverted);
        }
        booted = new Booted(boot.version, true, null);
        return new Applied(boot.version, null);
    }

    /** What to do about the release a verified manifest names. Only for a live session. */
    public synchronized Decision decide(int bridgeLevel, String payloadVersion, int payloadBridgeLevel) {
        return Decision.decide(builtinVersion, bridgeLevel, state, payloadVersion, payloadBridgeLevel);
    }

    public synchronized void drop() throws IOException {
        if (live) {
            commit(OtaState.applyDrop(state));
        }
    }

    /** A check that decided {@link Decision#NOTHING} about {@code payloadVersion}. */
    public synchronized void nothing(String payloadVersion) throws IOException {
        if (live) {
            commit(OtaState.applyNothing(state, payloadVersion, booted.version, booted.trial));
        }
    }

    /** The verified bundle of {@code version} is in its directory. */
    public synchronized void downloaded(String version) throws IOException {
        if (live) {
            commit(OtaState.applyDownloaded(state, version));
        }
    }

    public synchronized void markBad(String version) throws IOException {
        if (live) {
            commit(OtaState.markBad(state, version));
        }
    }

    /** Of the directories {@code names}, those no longer needed; none unless the session is live. */
    public synchronized List<String> staleDirectories(Collection<String> names) {
        if (!live) {
            return Collections.emptyList();
        }
        return OtaState.staleDirectories(names, state, booted.version);
    }

    private void commit(OtaState next) throws IOException {
        if (!next.equals(state)) {
            store.write(next);
            state = next;
        }
    }
}
