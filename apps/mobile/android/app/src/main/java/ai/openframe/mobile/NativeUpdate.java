package ai.openframe.mobile;

import android.content.Context;
import android.content.res.AssetManager;
import android.os.SystemClock;

import androidx.annotation.NonNull;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;
import androidx.lifecycle.ProcessLifecycleOwner;

import com.getcapacitor.JSObject;

import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import ai.openframe.mobile.ota.Bytes;
import ai.openframe.mobile.ota.EnvCopy;
import ai.openframe.mobile.ota.Json;
import ai.openframe.mobile.ota.OtaError;
import ai.openframe.mobile.ota.OtaSession;
import ai.openframe.mobile.ota.OtaState;
import ai.openframe.mobile.ota.Version;

// The Android twin of ios/App/App/NativeUpdate.swift, with the same state and rules
// (ai.openframe.mobile.ota, shared cases in apps/mobile/ota/fixtures).
//
// A launch decides which bundle the process runs; an Activity the system created again gets the answer
// of its launch, so it neither changes the bundle under the page nor counts a second attempt against
// one on trial.
//
// The check, the download and the removal of old directories run one at a time on the worker thread,
// never on the main thread and never on the boot path.
final class NativeUpdate {

    // Bumped with any addition to the bridge (a plugin, a method, an event), in step with the iOS shell:
    // a bundle that needs a higher level is not downloaded.
    static final int BRIDGE_LEVEL = 1;

    private static final String BUILTIN_STAMP = "public/ota-builtin.json";
    private static final int BUILTIN_STAMP_LIMIT = 4 * 1024;
    private static final String BUILTIN_INDEX = "public/index.html";

    private static NativeUpdate instance;

    static synchronized NativeUpdate get(Context context) {
        if (instance == null) {
            instance = new NativeUpdate(context.getApplicationContext());
        }
        return instance;
    }

    private final ShellLog log = ShellLog.update;
    private final AssetManager assets;
    // When null, nothing here reads or writes any state.
    private final String builtinVersion;
    private final UpdateStore store;
    private final OtaSession session;
    private final UpdateChecker checker;
    // Every task catches Throwable: anything escaping an executor task reaches the default handler and
    // kills the process. An Error too, such as an OutOfMemoryError while the xz decoder allocates its
    // dictionary: nothing marks the version bad for it, so the process would die again at every launch
    // that downloads it.
    //
    // At the default priority on purpose: THREAD_PRIORITY_BACKGROUND puts the thread in the throttled
    // background group, which is starved while the foreground is busy, and a check runs at a launch.
    // A short session might then never finish an update, and the "Update required" screen waits on
    // this thread.
    private final ExecutorService worker = Executors.newSingleThreadExecutor(task -> new Thread(task, "OpenFrameUpdate"));

    private final Object envLock = new Object();
    private byte[] envElement;
    private boolean envElementRead;

    private final Object checkLock = new Object();
    private final CheckSchedule schedule = new CheckSchedule();
    private final List<Runnable> checkWaiters = new ArrayList<>();
    private boolean observersInstalled;

    private NativeUpdate(Context context) {
        assets = context.getAssets();
        builtinVersion = builtinVersion(assets);
        store = new UpdateStore(context.getNoBackupFilesDir());
        session = new OtaSession(builtinVersion, this::envElement, store);
        checker = new UpdateChecker(context, store, session, builtinVersion != null, this::envElement);
    }

    // The lane writes the stamp when it stages a release (scripts/ota-stamp.mjs). A shell that cannot say
    // what it carries takes no updates: it could not tell a newer release from an older one.
    private static String builtinVersion(AssetManager assets) {
        try (InputStream in = assets.open(BUILTIN_STAMP)) {
            byte[] stamp = Bytes.readAtMost(in, BUILTIN_STAMP_LIMIT);
            Object version = stamp == null ? null : Json.parseObject(stamp).get("version");
            return version instanceof String && Version.isValid((String) version) ? (String) version : null;
        } catch (IOException | Json.Malformed e) {
            return null;
        }
    }

    // Read when first asked for, which a process with no bundle on disk and no check to run never does:
    // the page is some 200 KB.
    private byte[] envElement() {
        synchronized (envLock) {
            if (!envElementRead) {
                envElementRead = true;
                try (InputStream in = assets.open(BUILTIN_INDEX)) {
                    envElement = EnvCopy.element(Bytes.readAtMost(in, Integer.MAX_VALUE));
                } catch (IOException | OtaError e) {
                    envElement = null;
                }
            }
            return envElement;
        }
    }

    // Null for the bundle in the APK. Not recreated is a launch, also in a process that has run the app
    // before: after Back the Activity is gone and the process stays.
    File bootDirectory(boolean recreated) {
        OtaSession.Booted before = session.booted();
        OtaSession.Booted booted = recreated ? session.recreated() : session.boot();
        if (!recreated || before == null) {
            logBoot(booted);
            if (session.isLive()) {
                execute(() -> {
                    store.wipeStaging();
                    store.removeStale(session);
                });
            }
        } else if (before.version != null && booted.version == null) {
            log.error("boot: bundle " + before.version + " is no longer usable (its index.html is gone or carries another env): the built-in bundle loads");
        }
        return booted.version == null ? null : store.bundleDir(booted.version);
    }

    private void logBoot(OtaSession.Booted booted) {
        if (booted.reverted != null) {
            logReverted("boot", booted.reverted);
        }
        if (builtinVersion == null) {
            log.notice("boot: the built-in bundle, which carries no release version: over-the-air updates are off");
        } else if (!session.isLive()) {
            log.error("boot: the built-in bundle " + builtinVersion + ": the update state is left alone for this launch");
        } else if (booted.version == null) {
            log.notice("boot: the built-in bundle " + builtinVersion);
        } else if (booted.trial) {
            OtaState state = session.state();
            log.notice("boot: bundle " + booted.version + " on trial, attempt " + state.attempts + " of " + OtaState.MAX_TRIAL_ATTEMPTS);
        } else {
            log.notice("boot: bundle " + booted.version);
        }
    }

    private void logReverted(String step, String version) {
        log.error(step + ": bundle " + version + " never reported ready in " + OtaState.MAX_TRIAL_ATTEMPTS + " boots: marked bad");
    }

    JSObject state() {
        OtaSession.Booted booted = session.booted();
        OtaState state = session.state();
        JSObject js = new JSObject();
        js.put("enabled", checker.disabledReason() == null);
        js.put("builtinVersion", orNull(builtinVersion));
        js.put("bridgeLevel", BRIDGE_LEVEL);
        js.put("bootedVersion", orNull(booted == null ? null : booted.version));
        js.put("trial", booted != null && booted.trial);
        js.put("activeVersion", orNull(state.active));
        js.put("pendingVersion", orNull(state.pending));
        return js;
    }

    // JSObject drops a key put with a Java null; the page is promised the key, holding null.
    private static Object orNull(String value) {
        return value == null ? JSONObject.NULL : value;
    }

    void notifyReady() {
        try {
            if (!session.notifyReady()) {
                return;
            }
        } catch (IOException e) {
            return;
        }
        log.notice("bundle " + session.state().active + " reported ready: it is the active bundle now");
        execute(() -> store.removeStale(session));
    }

    // Null also when the switch could not be written to the state: the state and its pending bundle are
    // then as they were.
    File applyPending() {
        OtaSession.Applied applied;
        try {
            applied = session.applyPending();
        } catch (IOException e) {
            return null;
        }
        if (applied.reverted != null) {
            logReverted("applyPending", applied.reverted);
        }
        if (applied.version == null) {
            log.notice("applyPending: no pending bundle to switch to");
            return null;
        }
        log.notice("applyPending: bundle " + applied.version + " loads now, on trial, attempt " + session.state().attempts + " of " + OtaState.MAX_TRIAL_ATTEMPTS);
        return store.bundleDir(applied.version);
    }

    void installObservers() {
        if (observersInstalled) {
            return;
        }
        observersInstalled = true;
        ProcessLifecycleOwner.get().getLifecycle().addObserver(new DefaultLifecycleObserver() {
            @Override
            public void onStart(@NonNull LifecycleOwner owner) {
                check("the app came to the foreground", null);
            }
        });
    }

    void check(String trigger, Runnable whenSettled) {
        boolean fromPage = whenSettled != null;
        CheckSchedule.Asked asked;
        synchronized (checkLock) {
            asked = schedule.ask(fromPage, SystemClock.elapsedRealtime());
            if (fromPage && asked != CheckSchedule.Asked.ANSWERED) {
                checkWaiters.add(whenSettled);
            }
        }
        if (fromPage && asked == CheckSchedule.Asked.ANSWERED) {
            whenSettled.run();
        }
        if (asked == CheckSchedule.Asked.STARTED) {
            runCheck(trigger);
        }
    }

    private void runCheck(String trigger) {
        execute(() -> {
            try {
                String skipped = checker.disabledReason();
                if (skipped == null && !session.isLive()) {
                    // Before the boot there is no saying which state a check would change; after
                    // one that could not read the state, this process writes none.
                    skipped = "this launch has not read the update state";
                }
                if (skipped != null) {
                    log.notice("check (" + trigger + ") skipped: " + skipped);
                } else {
                    checker.run(trigger, this::mayDownload);
                    store.removeStale(session);
                }
            } finally {
                finishCheck();
            }
        });
    }

    private boolean mayDownload(boolean dataSaverRestricts) {
        synchronized (checkLock) {
            return schedule.mayDownload(dataSaverRestricts);
        }
    }

    private void finishCheck() {
        List<Runnable> waiters;
        synchronized (checkLock) {
            if (schedule.finish(SystemClock.elapsedRealtime())) {
                waiters = null;
            } else {
                waiters = new ArrayList<>(checkWaiters);
                checkWaiters.clear();
            }
        }
        if (waiters == null) {
            runCheck("the page asked");
            return;
        }
        for (Runnable waiter : waiters) {
            waiter.run();
        }
    }

    private void execute(Runnable task) {
        worker.execute(() -> {
            try {
                task.run();
            } catch (Throwable e) {
                // The kind and the place only: an exception's own text is not ours to vouch for.
                StackTraceElement[] stack = e.getStackTrace();
                log.error("a background step failed: " + e.getClass().getName() + (stack.length > 0 ? " at " + stack[0] : ""));
            }
        });
    }
}
