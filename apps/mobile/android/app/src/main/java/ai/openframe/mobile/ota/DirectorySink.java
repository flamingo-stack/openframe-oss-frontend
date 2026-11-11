package ai.openframe.mobile.ota;

import java.io.Closeable;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;

/**
 * Writes a bundle's files under one directory, with the process's own
 * permissions: nothing of a tar header is applied. The reader hands it only
 * paths that stay inside the directory and collide with no other.
 */
public final class DirectorySink implements BundleReader.Sink, Closeable {

    private final File root;
    private OutputStream out;

    public DirectorySink(File root) {
        this.root = root;
    }

    @Override
    public void begin(String path, long size) throws IOException {
        File file = new File(root, path);
        File directory = file.getParentFile();
        if (directory == null || !directory.isDirectory() && !directory.mkdirs()) {
            throw new IOException("cannot create the directory of " + path);
        }
        out = new FileOutputStream(file);
    }

    @Override
    public void write(byte[] buffer, int offset, int length) throws IOException {
        out.write(buffer, offset, length);
    }

    @Override
    public void end() throws IOException {
        OutputStream file = out;
        out = null;
        file.close();
    }

    /** Closes the file the reader left open when it refused the bundle halfway through it. */
    @Override
    public void close() throws IOException {
        if (out != null) {
            end();
        }
    }
}
