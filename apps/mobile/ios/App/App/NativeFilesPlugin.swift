import Capacitor
import Foundation
import PhotosUI
import UIKit
import UniformTypeIdentifiers

/**
 * Local Capacitor plugin backing the frontend's `NativeFiles` bridge
 * (openframe-frontend: src/lib/native-files.ts), mirrored on Android by
 * NativeFilesPlugin.java. Attachment bytes never travel through the WebView:
 *
 * - downloadFile: WKWebView has no download delegate here — Capacitor implements
 *   neither WKDownloadDelegate nor `didBecome download:`, and its
 *   decidePolicyFor hands any non-app top-level navigation to
 *   UIApplication.open, which cannot open a `blob:` URL. So the web pattern
 *   (URL.createObjectURL + `<a download>.click()`) is a SILENT no-op: the click
 *   returns, no error is thrown, and nothing is saved. Fetch over URLSession and
 *   hand the file to a share sheet instead.
 * - pickFiles / uploadFile: presigned upload URLs point at
 *   storage.googleapis.com and the WebView sends `Origin: capacitor://localhost`,
 *   which a bucket CORS policy would have to name explicitly. Picking natively
 *   yields a file PATH, so the upload streams from disk — no CORS to satisfy,
 *   and no base64-encoded file crossing the JS bridge.
 *
 * Picked and downloaded files are staged in a subdirectory of the app's tmp
 * directory, which the OS reclaims on its own schedule; uploadFile also removes
 * its source on success, which is the whole lifetime of a picked attachment.
 */
@objc(NativeFilesPlugin)
public class NativeFilesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeFilesPlugin"
    public let jsName = "NativeFiles"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "uploadFile", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadFile", returnType: CAPPluginReturnPromise)
    ]

    private var pendingPickCall: CAPPluginCall?

    private static let stagingDirectoryName = "openframe-files"

    private static func stagingDirectory() throws -> URL {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(stagingDirectoryName, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    /// Collapses anything a server (Content-Disposition) or the JS layer supplies
    /// into a single path component, so a `../` in a file name cannot escape the
    /// staging directory.
    private static func safeFileName(_ raw: String?) -> String {
        let candidate = (raw as NSString?)?.lastPathComponent ?? ""
        let trimmed = candidate.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty || trimmed == "." || trimmed == ".." ? "download" : trimmed
    }

    /// Staging path for `fileName`, in a per-file directory so two attachments
    /// with the same name don't clobber each other while both are pending upload.
    private static func prepareStagingURL(for fileName: String) throws -> URL {
        let directory = try stagingDirectory().appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory.appendingPathComponent(fileName)
    }

    private static func mimeType(for url: URL) -> String {
        UTType(filenameExtension: url.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
    }

    private static func fileEntry(for url: URL) -> JSObject {
        let attributes = try? FileManager.default.attributesOfItem(atPath: url.path)
        var entry = JSObject()
        entry["path"] = url.path
        entry["name"] = url.lastPathComponent
        entry["mimeType"] = mimeType(for: url)
        entry["size"] = (attributes?[.size] as? Int) ?? 0
        return entry
    }

    /// Moves (or copies, for a source the system still owns) a picked file into
    /// staging. Every picker delegate lands here, so the name-sanitizing and the
    /// per-file directory happen in exactly one place.
    private static func stageURL(_ source: URL, copying: Bool) throws -> URL {
        let destination = try prepareStagingURL(for: safeFileName(source.lastPathComponent))
        if copying {
            try FileManager.default.copyItem(at: source, to: destination)
        } else {
            try FileManager.default.moveItem(at: source, to: destination)
        }
        return destination
    }

    /// `stageURL` plus the JS-facing description of the result. Always a move —
    /// only the PHPicker path needs a copy, and it calls `stageURL` directly.
    private static func stage(_ source: URL) throws -> JSObject {
        fileEntry(for: try stageURL(source, copying: false))
    }

    /// `..` collapsed and symlinks resolved, so two paths naming the same file
    /// compare equal. `standardizedFileURL` owns the `..` removal;
    /// `resolvingSymlinksInPath` owns the /private prefix on tmp.
    private static func canonical(_ url: URL) -> String {
        url.standardizedFileURL.resolvingSymlinksInPath().path
    }

    /// Whether `url` is a file this plugin staged — exactly `<root>/<uuid>/<name>`.
    /// Guards both the read and the recursive delete in `uploadFile`, whose `path`
    /// comes from JS. The depth is load-bearing: a path directly in the root would
    /// pass a mere prefix test and then take the entire staging tree, and every
    /// other in-flight pick with it.
    private static func isStaged(_ url: URL) -> Bool {
        guard let root = try? stagingDirectory() else { return false }
        return canonical(url.deletingLastPathComponent().deletingLastPathComponent()) == canonical(root)
    }

    /// Drops a staged file and the per-file directory around it. Every caller
    /// passes a URL this plugin minted or one `isStaged` has verified.
    private static func discardStaged(_ url: URL) {
        try? FileManager.default.removeItem(at: url.deletingLastPathComponent())
    }

    // MARK: - Pick

    /// Presents the OS file picker and resolves with staged copies of the
    /// selection: `{ files: [{ path, name, mimeType, size }] }`. A cancelled pick
    /// resolves with an empty array rather than rejecting — the caller's job is
    /// simply to attach nothing.
    ///
    /// Three sources, offered through an action sheet in the same order as the
    /// WKWebView picker this replaces: Photos (PHPicker, out-of-process — needs no
    /// NSPhotoLibraryUsageDescription), the camera, and Files (document picker).
    /// The camera arm depends on NSCameraUsageDescription and
    /// NSMicrophoneUsageDescription being in Info.plist — without them iOS
    /// terminates the app on capture rather than returning an error.
    @objc func pickFiles(_ call: CAPPluginCall) {
        let multiple = call.getBool("multiple") ?? false

        DispatchQueue.main.async {
            guard self.pendingPickCall == nil else {
                call.reject("A file picker is already open", "ALREADY_PRESENTING")
                return
            }
            guard let viewController = self.bridge?.viewController else {
                call.reject("No view controller to present from")
                return
            }
            // Same trap as presentShareSheet: UIKit no-ops a present over an
            // existing presentation, so no delegate would ever fire — and with
            // pendingPickCall already set, every later pick would reject
            // ALREADY_PRESENTING for the rest of the process.
            guard viewController.presentedViewController == nil else {
                call.reject("Another sheet is already open", "ALREADY_PRESENTING")
                return
            }
            self.pendingPickCall = call

            let sheet = UIAlertController(title: nil, message: nil, preferredStyle: .actionSheet)
            sheet.addAction(UIAlertAction(title: "Photo Library", style: .default) { _ in
                self.presentPhotoPicker(from: viewController, multiple: multiple)
            })
            // Absent on the Simulator, which has no camera — offering a dead
            // action there is worse than one fewer row.
            if UIImagePickerController.isSourceTypeAvailable(.camera) {
                sheet.addAction(UIAlertAction(title: "Take Photo or Video", style: .default) { _ in
                    self.presentCamera(from: viewController)
                })
            }
            sheet.addAction(UIAlertAction(title: "Choose File", style: .default) { _ in
                self.presentDocumentPicker(from: viewController, multiple: multiple)
            })
            sheet.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
                self.resolvePick(with: [])
            })
            viewController.present(sheet, animated: true)
        }
    }

    private func presentDocumentPicker(from viewController: UIViewController, multiple: Bool) {
        // asCopy: the picker drops a copy in our own tmp sandbox, so there is no
        // security-scoped URL to keep alive until uploadFile runs.
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item], asCopy: true)
        picker.allowsMultipleSelection = multiple
        picker.delegate = self
        viewController.present(picker, animated: true)
    }

    private func presentCamera(from viewController: UIViewController) {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        // Ask the device what this camera can produce rather than asserting
        // image+movie: setting an unsupported media type throws.
        picker.mediaTypes = UIImagePickerController.availableMediaTypes(for: .camera) ?? [UTType.image.identifier]
        picker.delegate = self
        viewController.present(picker, animated: true)
    }

    private func presentPhotoPicker(from viewController: UIViewController, multiple: Bool) {
        var configuration = PHPickerConfiguration()
        configuration.selectionLimit = multiple ? 0 : 1
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = self
        viewController.present(picker, animated: true)
    }

    private func resolvePick(with files: [JSObject]) {
        guard let call = pendingPickCall else { return }
        pendingPickCall = nil
        call.resolve(["files": files])
    }

    private func rejectPick(_ message: String) {
        guard let call = pendingPickCall else { return }
        pendingPickCall = nil
        call.reject(message)
    }

    // MARK: - Upload

    /// Streams a staged file to a presigned URL with PUT. `URLSession`'s
    /// file-based upload task reads from disk, so a large attachment is never
    /// held in memory or serialized across the bridge.
    @objc func uploadFile(_ call: CAPPluginCall) {
        guard let path = call.getString("path") else {
            call.reject("Missing 'path'")
            return
        }
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing or invalid 'url'")
            return
        }
        let fileURL = URL(fileURLWithPath: path)
        // `path` arrives from JS and the success path deletes its directory, so
        // refuse anything this plugin did not stage itself.
        guard Self.isStaged(fileURL) else {
            call.reject("'path' is not a staged file")
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue(
            call.getString("contentType") ?? Self.mimeType(for: fileURL),
            forHTTPHeaderField: "Content-Type"
        )

        URLSession.shared.uploadTask(with: request, fromFile: fileURL) { _, response, error in
            if let error {
                call.reject("Upload failed: \(error.localizedDescription)")
                return
            }
            guard let http = response as? HTTPURLResponse else {
                call.reject("Upload failed: no HTTP response")
                return
            }
            guard (200..<300).contains(http.statusCode) else {
                call.reject("Upload failed with status \(http.statusCode)")
                return
            }
            // The staged copy exists only to be uploaded; the attachment now
            // lives in the bucket.
            Self.discardStaged(fileURL)
            call.resolve(["status": http.statusCode])
        }.resume()
    }

    // MARK: - Download

    /// Fetches `url` natively and presents a share sheet for the result, which is
    /// how a file reaches the Files app ("Save to Files"), Mail, or another app on
    /// iOS.
    @objc func downloadFile(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let url = URL(string: urlString) else {
            call.reject("Missing or invalid 'url'")
            return
        }
        let fileName = Self.safeFileName(call.getString("fileName"))

        URLSession.shared.downloadTask(with: url) { location, response, error in
            if let error {
                call.reject("Download failed: \(error.localizedDescription)")
                return
            }
            guard let location else {
                call.reject("Download failed: no file returned")
                return
            }
            if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
                call.reject("Download failed with status \(http.statusCode)")
                return
            }
            // URLSession deletes `location` as soon as this handler returns, so
            // the move has to happen here, not on the main queue below.
            let destination: URL
            do {
                destination = try Self.prepareStagingURL(for: fileName)
                try FileManager.default.moveItem(at: location, to: destination)
            } catch {
                call.reject("Could not save the download: \(error.localizedDescription)")
                return
            }

            self.presentShareSheet(for: destination, call: call)
        }.resume()
    }

    /// Resolves once the sheet is on screen — where the bytes end up after that
    /// is the user's choice, and iOS reports nothing useful about it. On every
    /// reject path the staged copy is discarded: only the success path hands the
    /// file to UIKit, which needs it to outlive this call.
    private func presentShareSheet(for fileURL: URL, call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let viewController = self.bridge?.viewController else {
                Self.discardStaged(fileURL)
                call.reject("No view controller to present from")
                return
            }
            // UIKit refuses to present over an existing presentation AND never
            // calls the completion when it does, so without this the call would
            // hang unsettled forever — two quick taps on a download icon is
            // enough to reach it.
            guard viewController.presentedViewController == nil else {
                Self.discardStaged(fileURL)
                call.reject("Another sheet is already open", "ALREADY_PRESENTING")
                return
            }
            let share = UIActivityViewController(activityItems: [fileURL], applicationActivities: nil)
            viewController.present(share, animated: true) {
                // Always false on iOS: the sheet IS the confirmation, so the
                // caller must not also announce a silent save.
                call.resolve(["savedToDownloads": false])
            }
        }
    }
}

// MARK: - UIDocumentPickerDelegate

extension NativeFilesPlugin: UIDocumentPickerDelegate {
    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        // asCopy:true already put these in our tmp sandbox, but not in the
        // staging layout uploadFile cleans up, so re-home them.
        var staged: [URL] = []
        do {
            for url in urls {
                staged.append(try Self.stageURL(url, copying: false))
            }
            resolvePick(with: staged.map(Self.fileEntry))
        } catch {
            // Discard what already landed, matching the PHPicker path — a
            // rejected pick should leave nothing behind.
            staged.forEach(Self.discardStaged)
            rejectPick("Could not read the selected file: \(error.localizedDescription)")
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        resolvePick(with: [])
    }
}

// MARK: - UIImagePickerControllerDelegate (camera capture)

extension NativeFilesPlugin: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public func imagePickerController(
        _ picker: UIImagePickerController,
        didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
    ) {
        picker.dismiss(animated: true)

        // A recording arrives as a file already on disk; a photo arrives as a
        // UIImage with nothing behind it, so it has to be encoded here. Capture
        // yields one item even when `multiple` was requested.
        if let recording = info[.mediaURL] as? URL {
            do {
                resolvePick(with: [try Self.stage(recording)])
            } catch {
                rejectPick("Could not save the recording: \(error.localizedDescription)")
            }
            return
        }

        // Resolving empty here would read as "user cancelled" — a capture that
        // failed to encode is a failure, not a cancellation.
        guard let photo = info[.originalImage] as? UIImage, let data = photo.jpegData(compressionQuality: 0.9) else {
            rejectPick("Could not encode the captured photo")
            return
        }
        do {
            // Each staged file gets its own directory, so a fixed name can't
            // collide — and WebKit names camera uploads `image.jpg` much the same.
            let destination = try Self.prepareStagingURL(for: "photo.jpg")
            try data.write(to: destination)
            resolvePick(with: [Self.fileEntry(for: destination)])
        } catch {
            rejectPick("Could not save the photo: \(error.localizedDescription)")
        }
    }

    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        resolvePick(with: [])
    }
}

// MARK: - PHPickerViewControllerDelegate

extension NativeFilesPlugin: PHPickerViewControllerDelegate {
    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)

        guard !results.isEmpty else {
            resolvePick(with: [])
            return
        }

        // loadFileRepresentation hands back a URL that is deleted the moment the
        // completion returns, so each result is staged inside its own handler and
        // the group gates the resolve until every copy has landed. Slots are
        // pre-sized and written by index: completions land out of order, and the
        // attachment list should follow the order the user picked.
        var staged = [URL?](repeating: nil, count: results.count)
        var failure: String?
        let lock = NSLock()
        let group = DispatchGroup()

        for (index, result) in results.enumerated() {
            guard let typeIdentifier = result.itemProvider.registeredTypeIdentifiers.first else {
                lock.lock()
                failure = failure ?? "a selected item has no readable representation"
                lock.unlock()
                continue
            }
            group.enter()
            result.itemProvider.loadFileRepresentation(forTypeIdentifier: typeIdentifier) { location, error in
                defer { group.leave() }
                // The copy runs OUTSIDE the lock — holding it across a
                // potentially large file would serialize every completion on I/O.
                var copied: URL?
                var copyError: Error?
                do {
                    guard let location else { throw error ?? CocoaError(.fileNoSuchFile) }
                    copied = try Self.stageURL(location, copying: true)
                } catch {
                    copyError = error
                }
                lock.lock()
                staged[index] = copied
                if let copyError { failure = failure ?? copyError.localizedDescription }
                lock.unlock()
            }
        }

        // Dropping a failed result silently would resolve with a short list, and
        // an all-fail would resolve empty — which every caller reads as "user
        // cancelled". An iCloud asset that cannot be downloaded is the common
        // case, and that has to surface as an error, not as a no-op.
        group.notify(queue: .main) {
            let urls = staged.compactMap { $0 }
            if let failure {
                urls.forEach(Self.discardStaged)
                self.rejectPick("Could not read the selected photo: \(failure)")
            } else {
                self.resolvePick(with: urls.map(Self.fileEntry))
            }
        }
    }
}
