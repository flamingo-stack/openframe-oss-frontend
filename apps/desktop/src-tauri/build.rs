fn main() {
    // The shared auth host is baked in via option_env!; without this, changing
    // it would not invalidate the cached build and the old host would ship.
    println!("cargo:rerun-if-env-changed=OPENFRAME_SHARED_HOST_URL");
    println!("cargo:rerun-if-env-changed=OPENFRAME_SENTRY_DSN");
    println!("cargo:rerun-if-env-changed=OPENFRAME_VERSION");
    tauri_build::build()
}
