package ai.openframe.mobile.ota;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;

public class BytesTest {

    private static byte[] bytes(int length) {
        byte[] bytes = new byte[length];
        for (int i = 0; i < length; i++) {
            bytes[i] = (byte) i;
        }
        return bytes;
    }

    private static final class ShortReads extends InputStream {
        private final byte[] bytes;
        private final int step;
        private int position;

        ShortReads(byte[] bytes, int step) {
            this.bytes = bytes;
            this.step = step;
        }

        @Override
        public int read() {
            return position < bytes.length ? bytes[position++] & 0xff : -1;
        }

        @Override
        public int read(byte[] buffer, int offset, int length) {
            if (position == bytes.length) {
                return -1;
            }
            int read = Math.min(Math.min(length, step), bytes.length - position);
            System.arraycopy(bytes, position, buffer, offset, read);
            position += read;
            return read;
        }

        int left() {
            return bytes.length - position;
        }
    }

    @Test
    public void aStreamAtTheLimitIsReadWhole() throws IOException {
        byte[] stream = bytes(4096);

        assertArrayEquals(stream, Bytes.readAtMost(new ByteArrayInputStream(stream), 4096));
    }

    @Test
    public void oneBytePastTheLimitIsNull() throws IOException {
        assertNull(Bytes.readAtMost(new ByteArrayInputStream(bytes(4097)), 4096));
        assertNull("a limit of nothing", Bytes.readAtMost(new ByteArrayInputStream(bytes(1)), 0));
    }

    @Test
    public void anEmptyStreamIsAnEmptyArray() throws IOException {
        assertArrayEquals(new byte[0], Bytes.readAtMost(new ByteArrayInputStream(new byte[0]), 0));
    }

    @Test
    public void shortReadsAddUp() throws IOException {
        byte[] stream = bytes(20_000);

        assertArrayEquals("a byte a read", stream, Bytes.readAtMost(new ShortReads(stream, 1), 20_000));
        assertArrayEquals("reads that straddle the buffer's end", stream, Bytes.readAtMost(new ShortReads(stream, 3_000), 20_000));
        assertNull("the read that crosses the limit is a short one", Bytes.readAtMost(new ShortReads(stream, 1), 19_999));
    }

    @Test
    public void nothingIsReadPastTheReadThatCrossesTheLimit() throws IOException {
        ShortReads stream = new ShortReads(bytes(1_000_000), 100);

        assertNull(Bytes.readAtMost(stream, 1_000));
        assertEquals(1_000_000 - 1_100, stream.left());
    }

    @Test
    public void noLimitOfItsOwnReadsEverything() throws IOException {
        byte[] stream = bytes(200_000);

        assertArrayEquals(stream, Bytes.readAtMost(new ShortReads(stream, 7_000), Integer.MAX_VALUE));
    }
}
