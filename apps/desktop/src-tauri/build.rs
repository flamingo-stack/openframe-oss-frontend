fn main() {
    // The shared auth host is baked in via option_env!; without this, changing
    // it would not invalidate the cached build and the old host would ship.
    println!("cargo:rerun-if-env-changed=OPENFRAME_SHARED_HOST_URL");
    // Declaring the app's commands is what puts them under the ACL: without a
    // manifest Tauri lets any local page call any of them, and capabilities/main.json
    // only governs core and plugin commands. A new command goes here and, if the page
    // is to reach it, in the capability; missing here it is refused at runtime.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "native_auth_start",
            "native_auth_cancel",
            "native_auth_exchange_ticket",
            "native_auth_revoke_session",
            "native_auth_get_tokens",
            "native_auth_refresh_tokens",
            "native_auth_set_tokens",
            "native_auth_clear_tokens",
            "native_auth_set_tenant_host",
            "take_pending_notification_click",
            "webview_log",
            "update_check",
            "update_apply_now",
            "autostart_status",
            "autostart_set",
            "agent_install_start",
            "take_pending_download_id",
        ]),
    ))
    .expect("failed to run the tauri build script");
}
