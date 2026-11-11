package ai.openframe.mobile.ota;

import java.security.MessageDigest;

// BundleReader.readVerified runs the length check, then the SHA-256 check, on the downloaded file,
// before any of it is decoded; the download itself uses update alone, to stop at the first byte too many.
public final class BundleCheck {

    private final long size;
    private final String sha256;
    private final MessageDigest digest = Bytes.sha256();
    private long received;

    public BundleCheck(long size, String sha256) {
        this.size = size;
        this.sha256 = sha256;
    }

    public void update(byte[] bytes, int offset, int length) throws OtaError {
        received += length;
        if (received > size) {
            throw new OtaError(OtaError.Code.SIZE, "the bundle is longer than the " + size + " bytes its manifest gives");
        }
        digest.update(bytes, offset, length);
    }

    public void finish() throws OtaError {
        if (received != size) {
            throw new OtaError(OtaError.Code.SIZE, "the bundle is " + received + " bytes, its manifest gives " + size);
        }
        if (!Bytes.hex(digest.digest()).equals(sha256)) {
            throw new OtaError(OtaError.Code.SHA256, "the bundle's SHA-256 is not the one its manifest gives");
        }
    }
}
