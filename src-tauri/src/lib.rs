/// iPad shell. File access is the scoped-storage plugin (security-scoped
/// bookmarks). This binary does not link a Typst compiler and does not spawn
/// another process.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_scoped_storage::init())
        .run(tauri::generate_context!())
        .expect("error while running Penwright iPad");
}
