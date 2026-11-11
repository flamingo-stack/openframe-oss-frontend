package ai.openframe.mobile.ota;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

public class StrictFormatTest {

    private static byte[] utf8(String text) {
        return text.getBytes(StandardCharsets.UTF_8);
    }

    private static void assertMalformed(String what, byte[] json) {
        try {
            Json.parse(json);
            fail(what + " was taken as JSON");
        } catch (Json.Malformed expected) {
        }
    }

    @Test
    public void jsonKeepsItsOwnTypes() throws Json.Malformed {
        Map<String, Object> object = Json.parseObject(utf8(
            " {\"s\":\"a\\u00e9\\ud83d\\ude00\\n\\/\",\"n\":-12.5e3,\"i\":7,\"t\":true,\"f\":false,\"z\":null,\"a\":[1,[],{}],\"o\":{\"k\":\"v\"}}\r\n\t "
        ));

        assertEquals("a\u00e9\ud83d\ude00\n/", object.get("s"));
        assertEquals("-12.5e3", ((Json.Num) object.get("n")).text);
        assertEquals(7, ((Json.Num) object.get("i")).positiveInteger());
        assertSame(Boolean.TRUE, object.get("t"));
        assertSame(Boolean.FALSE, object.get("f"));
        assertSame(Json.NULL, object.get("z"));
        assertNull("a missing member is not null", object.get("missing"));
        assertEquals(3, ((List<?>) object.get("a")).size());
        assertEquals("v", ((Map<?, ?>) object.get("o")).get("k"));
    }

    @Test
    public void jsonRefusesEverythingRfc8259DoesNotWrite() {
        String[] texts = {
            "",
            " ",
            "{",
            "{\"a\":1,}",
            "[1,]",
            "{'a':1}",
            "{a:1}",
            "{\"a\":1} x",
            "{\"a\":1}{}",
            "// c\n{}",
            "{/* c */}",
            "\ufeff{}",
            "01",
            "+1",
            "1.",
            ".5",
            "1e",
            "1e+",
            "-",
            "0x10",
            "NaN",
            "Infinity",
            "True",
            "nul",
            "\"unterminated",
            "\"tab\tin a string\"",
            "\"new\nline\"",
            "\"\\x41\"",
            "\"\\u12\"",
            "\"\\u12G4\"",
            "\"\\ud83d\"",
            "\"\\ud83dx\"",
            "\"\\ud83d\\u0041\"",
            "\"\\ude00\"",
            "{\"a\" 1}",
            "{\"a\":}",
            "[1 2]",
            "\u0661",
            "1\u0661",
        };
        for (String text : texts) {
            assertMalformed(Arrays.toString(utf8(text)) + " (" + text + ")", utf8(text));
        }
    }

    @Test
    public void jsonRefusesBytesThatAreNotUtf8() {
        assertMalformed("a lone continuation byte", new byte[] {'"', (byte) 0x80, '"'});
        assertMalformed("an overlong encoding", new byte[] {'"', (byte) 0xc0, (byte) 0xaf, '"'});
        assertMalformed("an encoded surrogate", new byte[] {'"', (byte) 0xed, (byte) 0xa0, (byte) 0x80, '"'});
        assertMalformed("a truncated sequence", new byte[] {'"', (byte) 0xe2, (byte) 0x82, '"'});
        assertMalformed("UTF-16", "{}".getBytes(StandardCharsets.UTF_16));
    }

    @Test
    public void jsonNestsToItsBoundAndNoDeeper() throws Json.Malformed {
        Json.parse(utf8(nested('[', ']', Json.MAX_DEPTH)));
        Json.parse(utf8(nested('{', '}', Json.MAX_DEPTH)));

        assertMalformed("arrays one past the bound", utf8(nested('[', ']', Json.MAX_DEPTH + 1)));
        assertMalformed("objects one past the bound", utf8(nested('{', '}', Json.MAX_DEPTH + 1)));
    }

    @Test
    public void aManifestOfAMillionBracketsIsRefusedAndOverflowsNoStack() {
        byte[] brackets = new byte[1_000_000];
        Arrays.fill(brackets, (byte) '[');

        assertMalformed("a million open brackets", brackets);
        try {
            Manifest.verify(brackets, OtaKeys.of());
            fail("a million open brackets were taken as a manifest");
        } catch (OtaError e) {
            assertEquals(OtaError.Code.ENVELOPE, e.code);
        }
    }

    private static String nested(char open, char close, int depth) {
        StringBuilder text = new StringBuilder();
        for (int i = 0; i < depth; i++) {
            text.append(open);
            if (open == '{' && i < depth - 1) {
                text.append("\"a\":");
            }
        }
        for (int i = 0; i < depth; i++) {
            text.append(close);
        }
        return text.toString();
    }

    @Test
    public void aNumberIsAPositiveIntegerOnlyWhenWrittenAsOne() throws Json.Malformed {
        assertEquals(1, number("1").positiveInteger());
        assertEquals(999_999_999_999_999_999L, number("999999999999999999").positiveInteger());
        for (String text : new String[] {"0", "-1", "-0", "1.0", "1e0", "1E2", "1.5", "1000000000000000000", "99999999999999999999"}) {
            assertEquals(text, -1, number(text).positiveInteger());
        }
    }

    private static Json.Num number(String text) throws Json.Malformed {
        return (Json.Num) Json.parse(utf8(text));
    }

    @Test
    public void base64DecodesWhatAnEncoderWrites() {
        assertArrayEquals(new byte[0], Base64Strict.decode(""));
        assertArrayEquals(utf8("f"), Base64Strict.decode("Zg=="));
        assertArrayEquals(utf8("fo"), Base64Strict.decode("Zm8="));
        assertArrayEquals(utf8("foo"), Base64Strict.decode("Zm9v"));
        assertArrayEquals(utf8("foobar"), Base64Strict.decode("Zm9vYmFy"));
        assertArrayEquals(new byte[] {(byte) 0xfb, (byte) 0xff, (byte) 0xfe}, Base64Strict.decode("+//+"));
    }

    @Test
    public void base64RefusesEverythingElse() {
        String[] texts = {
            "Zg",
            "Zg=",
            "Zm8",
            "Zh==",
            "Zm9=",
            "-__-",
            "Zm9v\n",
            " Zm9v",
            "Zm9v ",
            "Zm 9v",
            "Zm9\u0661",
            "====",
            "Z===",
            "=m9v",
            "Zg==Zg==",
            "Zm8=Zm8=",
            "Zm9v=",
            "Z",
        };
        for (String text : texts) {
            assertNull(text, Base64Strict.decode(text));
        }
    }

    @Test
    public void aVersionIsThreePlainNumbers() {
        for (String version : new String[] {"0.0.0", "1.2.3", "10.20.30", "999999999.999999999.999999999"}) {
            assertTrue(version, Version.isValid(version));
        }
        String[] others = {
            null, "", "1", "1.2", "1.2.3.4", "1.2.3.", ".1.2.3", "1..3", "01.2.3", "1.02.3", "1.2.03", "+1.2.3", "-1.2.3",
            "1.2.3-rc.1", "1.2.3 ", " 1.2.3", "1.2.3\n", "v1.2.3", "1.2.1000000000", "1.2.\u0663", "1,2,3", "../1.2.3",
        };
        for (String other : others) {
            assertFalse(String.valueOf(other), Version.isValid(other));
        }
    }

    @Test
    public void versionsCompareAsNumbers() {
        assertEquals(0, Version.compare("1.2.3", "1.2.3"));
        assertTrue(Version.compare("1.10.0", "1.9.0") > 0);
        assertTrue(Version.compare("1.9.0", "1.10.0") < 0);
        assertTrue(Version.compare("2.0.0", "1.99.99") > 0);
        assertTrue(Version.compare("1.2.10", "1.2.9") > 0);
        assertTrue(Version.compare("999999999.0.0", "999999998.999999999.999999999") > 0);
    }

    @Test
    public void onlyTheOneDerEncodingOfASignatureIsTaken() {
        assertTrue("r and s of one byte", Manifest.isStrictDer(der(0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x7f)));
        assertTrue("a leading zero that keeps a high bit positive", Manifest.isStrictDer(der(0x30, 0x07, 0x02, 0x02, 0x00, 0x80, 0x02, 0x01, 0x01)));

        assertFalse("empty", Manifest.isStrictDer(new byte[0]));
        assertFalse("not a sequence", Manifest.isStrictDer(der(0x31, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01)));
        assertFalse("a negative r", Manifest.isStrictDer(der(0x30, 0x06, 0x02, 0x01, 0x80, 0x02, 0x01, 0x01)));
        assertFalse("a negative s", Manifest.isStrictDer(der(0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0xff)));
        assertFalse("a needless leading zero", Manifest.isStrictDer(der(0x30, 0x07, 0x02, 0x02, 0x00, 0x01, 0x02, 0x01, 0x01)));
        assertFalse("an empty integer", Manifest.isStrictDer(der(0x30, 0x05, 0x02, 0x00, 0x02, 0x01, 0x01)));
        assertFalse("a long-form sequence length", Manifest.isStrictDer(der(0x30, 0x81, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01)));
        assertFalse("a long-form integer length", Manifest.isStrictDer(der(0x30, 0x07, 0x02, 0x81, 0x01, 0x01, 0x02, 0x01, 0x01)));
        assertFalse("a byte after the sequence", Manifest.isStrictDer(der(0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01, 0x00)));
        assertFalse("a byte after s inside the sequence", Manifest.isStrictDer(der(0x30, 0x07, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01, 0x00)));
        assertFalse("one integer", Manifest.isStrictDer(der(0x30, 0x03, 0x02, 0x01, 0x01)));
        assertFalse("three integers", Manifest.isStrictDer(der(0x30, 0x09, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01, 0x02, 0x01, 0x01)));
        assertFalse("an integer running past the end", Manifest.isStrictDer(der(0x30, 0x06, 0x02, 0x01, 0x01, 0x02, 0x05, 0x01)));
        assertFalse("raw r and s", Manifest.isStrictDer(new byte[64]));
    }

    private static byte[] der(int... bytes) {
        byte[] der = new byte[bytes.length];
        for (int i = 0; i < bytes.length; i++) {
            der[i] = (byte) bytes[i];
        }
        return der;
    }

    @Test(expected = IllegalArgumentException.class)
    public void aKeyThatIsNotA91ByteP256SpkiIsNotHeld() {
        OtaKeys.of(new byte[91]);
    }

    @Test
    public void onlyARefusalOfTheSignedBytesMarksAReleaseBad() {
        List<OtaError.Code> bad = Arrays.asList(
            OtaError.Code.XZ, OtaError.Code.TAR, OtaError.Code.ENTRY_TYPE, OtaError.Code.ENTRY_NAME,
            OtaError.Code.DUPLICATE, OtaError.Code.NO_INDEX, OtaError.Code.HAS_ENV, OtaError.Code.NO_HEAD
        );
        for (OtaError.Code code : OtaError.Code.values()) {
            assertEquals(code.name(), bad.contains(code), new OtaError(code, "").isContentRefusal());
        }
    }

    @Test
    public void aBundlePathStaysInsideItsDirectory() {
        for (String path : new String[] {"index.html", "a/b/c.js", "_next/static/chunks/[id]-(group)~!@$%^&()+=,;'.js"}) {
            assertTrue(path, BundleReader.isSafePath(path));
        }
        String[] unsafe = {
            "", "/", "/a", "a/", "a//b", ".", "..", "./a", "a/.", "a/..", "../a", "a/../b", "a\\b", "a b", "a\tb", "a\u0000b",
            "a\u007fb", "caf\u00e9", "C:\\a", "\\\\host\\share",
        };
        for (String path : unsafe) {
            assertFalse(path, BundleReader.isSafePath(path));
        }
        assertTrue("255 bytes", BundleReader.isSafePath(repeat('a', 255)));
        assertFalse("256 bytes", BundleReader.isSafePath(repeat('a', 256)));
    }

    private static String repeat(char c, int count) {
        char[] chars = new char[count];
        Arrays.fill(chars, c);
        return new String(chars);
    }
}
