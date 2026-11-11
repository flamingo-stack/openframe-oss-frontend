package ai.openframe.mobile.ota;

// The rules are those of docs/ota.md, "The decision".
public enum Decision {
    DOWNLOAD,
    NOTHING,
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
