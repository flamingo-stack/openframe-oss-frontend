package ai.openframe.mobile.ota;

/**
 * A refusal of the over-the-air format, named by the code the shared cases in
 * apps/mobile/ota/fixtures expect (apps/mobile/docs/ota.md, "Shared test
 * cases"). The message is this shell's own wording, for its log only.
 */
public final class OtaError extends Exception {

    public enum Code {
        ENVELOPE,
        UNKNOWN_KEY,
        SIGNATURE,
        PAYLOAD,
        SIZE,
        SHA256,
        XZ,
        TAR,
        ENTRY_TYPE,
        ENTRY_NAME,
        DUPLICATE,
        NO_INDEX,
        NO_ENV,
        HAS_ENV,
        NO_HEAD
    }

    public final Code code;

    public OtaError(Code code, String message) {
        super(message);
        this.code = code;
    }

    /**
     * Whether a bundle whose bytes matched its signed payload was refused for
     * what it holds. The same release would be refused at every check, so its
     * version is marked bad. A size or SHA-256 mismatch is the download's
     * fault, and the next check tries again.
     */
    public boolean isContentRefusal() {
        switch (code) {
            case XZ:
            case TAR:
            case ENTRY_TYPE:
            case ENTRY_NAME:
            case DUPLICATE:
            case NO_INDEX:
            case HAS_ENV:
            case NO_HEAD:
                return true;
            default:
                return false;
        }
    }
}
