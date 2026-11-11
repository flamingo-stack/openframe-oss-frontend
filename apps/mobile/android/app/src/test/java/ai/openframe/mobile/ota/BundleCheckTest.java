package ai.openframe.mobile.ota;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.fail;

import org.junit.Test;

/** The download is given up at the first byte past the signed size: nothing longer is ever kept, hashed or decoded. */
public class BundleCheckTest {

    private static final String SHA256_OF_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

    @Test
    public void bytesOfTheSignedSizeAndHashPass() throws OtaError {
        BundleCheck check = new BundleCheck(3, SHA256_OF_ABC);

        check.update(new byte[] {'a', 'b'}, 0, 2);
        check.update(new byte[] {'x', 'c'}, 1, 1);
        check.finish();
    }

    @Test
    public void theFirstByteTooManyIsRefusedAsItArrives() throws OtaError {
        BundleCheck check = new BundleCheck(3, SHA256_OF_ABC);
        check.update(new byte[] {'a', 'b', 'c'}, 0, 3);

        try {
            check.update(new byte[] {'d'}, 0, 1);
            fail("a fourth byte of three was taken");
        } catch (OtaError e) {
            assertEquals(OtaError.Code.SIZE, e.code);
        }
    }

    @Test
    public void aShortDownloadIsRefusedBySizeBeforeItsHash() throws OtaError {
        BundleCheck check = new BundleCheck(3, SHA256_OF_ABC);
        check.update(new byte[] {'a', 'b'}, 0, 2);

        try {
            check.finish();
            fail("two bytes of three were taken");
        } catch (OtaError e) {
            assertEquals(OtaError.Code.SIZE, e.code);
        }
    }

    @Test
    public void otherBytesOfTheSameSizeAreRefusedByHash() throws OtaError {
        BundleCheck check = new BundleCheck(3, SHA256_OF_ABC);
        check.update(new byte[] {'a', 'b', 'd'}, 0, 3);

        try {
            check.finish();
            fail("other bytes were taken");
        } catch (OtaError e) {
            assertEquals(OtaError.Code.SHA256, e.code);
        }
    }
}
