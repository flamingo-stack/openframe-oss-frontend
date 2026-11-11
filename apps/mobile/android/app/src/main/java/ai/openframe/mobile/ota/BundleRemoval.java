package ai.openframe.mobile.ota;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Deletes a directory of the updater: an unpacked bundle, or its work area.
 * A bundle's root index.html goes first. A deletion cut short, by the process
 * dying halfway through some 4,200 files, then leaves a directory without the
 * one file that makes it a bundle, never one that still passes for whole.
 */
public final class BundleRemoval {

    private static final String INDEX = "index.html";

    private BundleRemoval() {
    }

    /** Everything under {@code directory} was written by the updater: plain files and directories, no links. */
    public static void remove(File directory) {
        for (File each : order(directory)) {
            each.delete();
        }
    }

    /** {@code directory} and all it holds, in the order they are deleted: its index.html, then each directory after what it holds. */
    static List<File> order(File directory) {
        List<File> order = new ArrayList<>();
        File index = new File(directory, INDEX);
        if (index.isFile()) {
            order.add(index);
        }
        collect(directory, index, order);
        return order;
    }

    private static void collect(File file, File first, List<File> order) {
        File[] children = file.listFiles();
        if (children != null) {
            for (File child : children) {
                if (!child.equals(first)) {
                    collect(child, first, order);
                }
            }
        }
        order.add(file);
    }
}
