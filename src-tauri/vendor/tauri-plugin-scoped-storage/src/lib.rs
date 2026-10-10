mod commands;
#[cfg(desktop)]
mod desktop;
mod error;
// iOS security-scoped access is held for the whole native call (see ios/Sources).
#[cfg(mobile)]
mod mobile;
mod models;
mod path;

pub use error::ScopedStorageError;
pub use models::*;

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

#[cfg(desktop)]
use desktop::ScopedStorage;
#[cfg(mobile)]
use mobile::ScopedStorage;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("scoped-storage")
        .setup(|app, api| {
            #[cfg(mobile)]
            let storage = mobile::init(app, api)?;
            #[cfg(desktop)]
            let storage = desktop::init(app, api)?;

            app.manage(storage);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::pick_folder,
            commands::forget_folder,
            commands::list_folders,
            commands::get_folder_info,
            commands::read_dir,
            commands::stat,
            commands::exists,
            commands::read_file,
            commands::write_file,
            commands::read_text_file,
            commands::read_text_file_lines,
            commands::write_text_file,
            commands::append_file,
            commands::mkdir,
            commands::remove_file,
            commands::remove_dir,
            commands::copy,
            commands::mv,
            commands::rename,
            commands::truncate,
        ])
        .build()
}
