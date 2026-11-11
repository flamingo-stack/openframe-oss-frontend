package ai.openframe.mobile.ota;

import java.io.ByteArrayOutputStream;

// A store build's lane writes the window.__ENV script element into the built-in index.html
// (scripts/inject-env.mjs), and the shell copies it, as it is, into an over-the-air bundle's page, so a
// bundle runs with the env of the binary it lands in and can never bring its own. All of it on bytes,
// with literal matches: fixtures/env-cases.json pins every outcome.
public final class EnvCopy {

    private static final byte[] ELEMENT_START = Bytes.ascii("<script>window.__ENV");
    private static final byte[] ELEMENT_END = Bytes.ascii("</script>");
    private static final byte[] HEAD_TAG = Bytes.ascii("<head>");

    private EnvCopy() {
    }

    public static byte[] element(byte[] builtinHtml) throws OtaError {
        int start = Bytes.indexOf(builtinHtml, ELEMENT_START, 0);
        int end = start == -1 ? -1 : Bytes.indexOf(builtinHtml, ELEMENT_END, start + ELEMENT_START.length);
        if (end == -1) {
            throw new OtaError(OtaError.Code.NO_ENV, "the built-in index.html has no window.__ENV script");
        }
        byte[] element = new byte[end + ELEMENT_END.length - start];
        System.arraycopy(builtinHtml, start, element, 0, element.length);
        return element;
    }

    public static void assertTarget(byte[] stagedHtml) throws OtaError {
        if (Bytes.indexOf(stagedHtml, ELEMENT_START, 0) != -1) {
            throw new OtaError(OtaError.Code.HAS_ENV, "the bundle already carries window.__ENV");
        }
        if (Bytes.indexOf(stagedHtml, HEAD_TAG, 0) == -1) {
            throw new OtaError(OtaError.Code.NO_HEAD, "the bundle's index.html has no <head>");
        }
    }

    public static byte[] insert(byte[] element, byte[] stagedHtml) throws OtaError {
        assertTarget(stagedHtml);
        int afterHead = Bytes.indexOf(stagedHtml, HEAD_TAG, 0) + HEAD_TAG.length;
        ByteArrayOutputStream out = new ByteArrayOutputStream(stagedHtml.length + element.length);
        out.write(stagedHtml, 0, afterHead);
        out.write(element, 0, element.length);
        out.write(stagedHtml, afterHead, stagedHtml.length - afterHead);
        return out.toByteArray();
    }

    public static boolean carries(byte[] html, byte[] element) {
        return Bytes.indexOf(html, element, 0) != -1;
    }

    // In the order the shared cases pin: NO_ENV, then HAS_ENV, then NO_HEAD.
    public static byte[] copy(byte[] builtinHtml, byte[] stagedHtml) throws OtaError {
        return insert(element(builtinHtml), stagedHtml);
    }
}
