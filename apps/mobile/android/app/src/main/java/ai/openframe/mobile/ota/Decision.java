package ai.openframe.mobile.ota;

/** What a shell does about the release a verified manifest names (docs/ota.md, "The decision"). */
public enum Decision {
    DOWNLOAD,
    NOTHING,
    /** Every over-the-air bundle goes; the built-in one boots at the next launch. */
    DROP;

    public static Decision decide(
        String builtinVersion,
        int bridgeLevel,
        OtaState state,
        String payloadVersion,
        int payloadBridgeLevel
    ) {
        if (Version.compare(payloadVersion, builtinVersion) <= 0) {
            return DROP;
        }
        // Versions have one spelling each, so the same text is the same version.
        if (payloadVersion.equals(state.active) || payloadVersion.equals(state.pending) || state.bad.contains(payloadVersion)) {
            return NOTHING;
        }
        if (payloadBridgeLevel > bridgeLevel) {
            return NOTHING;
        }
        return DOWNLOAD;
    }
}
