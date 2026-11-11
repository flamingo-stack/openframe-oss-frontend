package ai.openframe.mobile.ota;

import java.io.IOException;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.function.Supplier;

// Every change is written to the Store before it takes effect here, and every method that reads or
// changes it holds this object's lock, so the changes are one at a time whichever thread they come
// from: the boot on the main thread, the bridge's calls, the background check.
public final class OtaSession {

    public interface Store {
        // EMPTY when there is no state or it does not parse; an IOException only when the state is there and
        // cannot be read right now.
        OtaState read() throws IOException;

        // Replaces the stored state, atomically.
        void write(OtaState state) throws IOException;

        byte[] index(String version);
    }

    // version is null for the built-in bundle.
    public static final class Booted {
        public final String version;
        public final boolean trial;
        public final String reverted;

        Booted(String version, boolean trial, String reverted) {
            this.version = version;
            this.trial = trial;
            this.reverted = reverted;
        }
    }

    public static final class Applied {
        public final String version;
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
    // Booted, with a state that was read: before that, and without it, nothing here writes the store.
    private boolean live;

    public OtaSession(String builtinVersion, Supplier<byte[]> envElement, Store store) {
        this.builtinVersion = builtinVersion;
        this.envElement = envElement;
        this.store = store;
    }

    // Every bundle got this build's env element when it was unpacked, so one without it was unpacked by a
    // build with another env, before a store update: run here, it would talk to that build's hosts.
    public boolean isUsable(String version) {
        byte[] element = envElement.get();
        byte[] index = element == null ? null : store.index(version);
        return index != null && EnvCopy.carries(index, element);
    }

    // A trial is counted in the store before this returns, so before the web view loads it. Without a
    // built-in version, or with a state that cannot be read right now, the built-in bundle boots and the
    // store is left alone until the next launch.
    //
    // A call after the first of a process is the user coming back after leaving with Back, in a process
    // the system kept: it decides again exactly as a cold start would, or a downloaded bundle, a revert
    // and a drop would all wait for the process to die, which can take days.
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

    // An Activity the system created again (a configuration change, a task it restored) runs the bundle
    // the process runs, with nothing decided again and no attempt counted. Unless that bundle is no longer
    // usable. A web view cannot load it then, so the built-in bundle does, and is what the process runs
    // from here on: a ready report from its page confirms nothing. The state is left for the next launch
    // to settle.
    //
    // In a process that has not booted, which the system started to restore the Activity into, this is
    // its boot.
    public synchronized Booted recreated() {
        if (booted == null) {
            return boot();
        }
        if (booted.version != null && !isUsable(booted.version)) {
            booted = BUILTIN;
        }
        return booted;
    }

    public synchronized Booted booted() {
        return booted;
    }

    public synchronized boolean isLive() {
        return live;
    }

    public synchronized OtaState state() {
        return state;
    }

    // True when a trial was confirmed.
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

    // With the bookkeeping of a boot: an attempt counted, or the bundle marked bad when it has none left.
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

    // Only for a live session.
    public synchronized Decision decide(int bridgeLevel, String payloadVersion, int payloadBridgeLevel) {
        return Decision.decide(builtinVersion, bridgeLevel, state, payloadVersion, payloadBridgeLevel);
    }

    public synchronized void drop() throws IOException {
        if (live) {
            commit(OtaState.applyDrop(state));
        }
    }

    public synchronized void nothing(String payloadVersion) throws IOException {
        if (live) {
            commit(OtaState.applyNothing(state, payloadVersion, booted.version, booted.trial));
        }
    }

    // Only once the verified bundle of version is in its directory.
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
