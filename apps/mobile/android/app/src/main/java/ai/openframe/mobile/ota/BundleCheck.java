package ai.openframe.mobile.ota;

import java.security.MessageDigest;

/**
 * The first two checks on a bundle, made on its compressed bytes before any
 * of them is decoded: its length, then its SHA-256, against the signed
 * payload (docs/ota.md, "The bundle"). {@link BundleReader#readVerified} runs
 * both on the downloaded file; the download itself uses {@link #update} alone,
 * to stop at the first byte too many.
 */
public final class BundleCheck {

    private final long size;
    private final String sha256;
    private final MessageDigest digest = Bytes.sha256();
    private long received;

    public BundleCheck(long size, String sha256) {
        this.size = size;
        this.sha256 = sha256;
    }

    /** Takes the next bytes. Refuses (SIZE) the first one past the payload's size, so a download stops there. */
    public void update(byte[] bytes, int offset, int length) throws OtaError {
        received += length;
        if (received > size) {
            throw new OtaError(OtaError.Code.SIZE, "the bundle is longer than the " + size + " bytes its manifest gives");
        }
        digest.update(bytes, offset, length);
    }

    /** The bundle has ended: it is refused unless it is as long (SIZE) and hashes (SHA256) as the payload says. */
    public void finish() throws OtaError {
        if (received != size) {
            throw new OtaError(OtaError.Code.SIZE, "the bundle is " + received + " bytes, its manifest gives " + size);
        }
        if (!Bytes.hex(digest.digest()).equals(sha256)) {
            throw new OtaError(OtaError.Code.SHA256, "the bundle's SHA-256 is not the one its manifest gives");
        }
    }
}
