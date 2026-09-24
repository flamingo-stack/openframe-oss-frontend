package ai.openframe.mobile;

/**
 * E2E probe for the hub's multi-repo change sets (flamingo-stack/multi-platform-hub#1381).
 * A public definition that exists ONLY on this pull request's branch; a sibling PR imports it.
 * Removed again after the test.
 */
public final class ChangeSetProbe {
    private ChangeSetProbe() {}

    public static String shout(String name) {
        return label(name).toUpperCase();
    }

    public static String label(String name) {
        return "change-set probe: " + name;
    }
}
