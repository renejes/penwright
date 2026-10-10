use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{
    plugin::{mobile::PluginInvokeError, PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::{error::ScopedStorageError, models::*};

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "com.danielerolli.tauri.scopedstorage";

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_scoped_storage);

pub struct ScopedStorage<R: Runtime>(PluginHandle<R>);

fn map_plugin_error(error: PluginInvokeError) -> ScopedStorageError {
    ScopedStorageError::from_native_message(&error.to_string())
}

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> Result<ScopedStorage<R>, PluginInvokeError> {
    #[cfg(target_os = "android")]
    let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "ScopedStoragePlugin")?;
    #[cfg(target_os = "ios")]
    let handle = api.register_ios_plugin(init_plugin_scoped_storage)?;
    Ok(ScopedStorage(handle))
}

impl<R: Runtime> ScopedStorage<R> {
    fn run_mobile<T: DeserializeOwned, A: Serialize>(
        &self,
        command: &str,
        args: A,
    ) -> Result<T, ScopedStorageError> {
        self.0
            .run_mobile_plugin::<T>(command, args)
            .map_err(map_plugin_error)
    }

    pub async fn pick_folder_async(&self) -> Result<FolderHandle, ScopedStorageError> {
        self.0
            .run_mobile_plugin_async::<PickFolderResponse>("pickFolder", ())
            .await
            .map(|r| r.folder)
            .map_err(map_plugin_error)
    }

    pub fn forget_folder(&self, folder_id: String) -> Result<(), ScopedStorageError> {
        self.run_mobile::<(), _>("forgetFolder", FolderIdRequest { folder_id })
    }

    pub fn list_folders(&self) -> Result<Vec<FolderHandle>, ScopedStorageError> {
        self.run_mobile::<ListFoldersResponse, _>("listFolders", ())
            .map(|response| response.folders)
    }

    pub fn get_folder_info(
        &self,
        req: FolderIdRequest,
    ) -> Result<FolderHandle, ScopedStorageError> {
        self.run_mobile("getFolderInfo", req)
    }

    pub fn read_dir(&self, req: ReadDirRequest) -> Result<Vec<DirEntry>, ScopedStorageError> {
        self.run_mobile::<ReadDirResponse, _>("readDir", req)
            .map(|response| response.entries)
    }

    pub fn stat(&self, req: StatRequest) -> Result<FileStat, ScopedStorageError> {
        self.run_mobile("stat", req)
    }

    pub fn exists(&self, req: ExistsRequest) -> Result<ExistsResponse, ScopedStorageError> {
        self.run_mobile("exists", req)
    }

    pub fn read_file(&self, req: ReadFileRequest) -> Result<ReadFileResponse, ScopedStorageError> {
        self.run_mobile("readFile", req)
    }

    pub fn write_file(&self, req: WriteFileRequest) -> Result<(), ScopedStorageError> {
        self.run_mobile("writeFile", req)
    }

    pub fn read_text_file(
        &self,
        req: ReadTextFileRequest,
    ) -> Result<ReadTextFileResponse, ScopedStorageError> {
        self.run_mobile("readTextFile", req)
    }

    pub fn read_text_file_lines(
        &self,
        req: ReadTextFileRequest,
    ) -> Result<ReadTextFileLinesResponse, ScopedStorageError> {
        self.run_mobile("readTextFileLines", req)
    }

    pub fn write_text_file(&self, req: WriteTextFileRequest) -> Result<(), ScopedStorageError> {
        self.run_mobile("writeTextFile", req)
    }

    pub fn append_file(&self, req: AppendFileRequest) -> Result<(), ScopedStorageError> {
        self.run_mobile("appendFile", req)
    }

    pub fn mkdir(&self, req: MkdirRequest) -> Result<(), ScopedStorageError> {
        self.run_mobile("mkdir", req)
    }

    pub fn remove_file(&self, req: RemoveFileRequest) -> Result<(), ScopedStorageError> {
        self.run_mobile("removeFile", req)
    }

    pub fn remove_dir(&self, req: RemoveDirRequest) -> Result<(), ScopedStorageError> {
        self.run_mobile("removeDir", req)
    }

    pub fn copy(&self, req: CopyRequest) -> Result<(), ScopedStorageError> {
        self.run_mobile("copy", req)
    }

    pub fn mv(&self, req: MoveRequest) -> Result<(), ScopedStorageError> {
        self.run_mobile("move", req)
    }

    pub fn rename(&self, req: RenameRequest) -> Result<(), ScopedStorageError> {
        self.run_mobile("rename", req)
    }

    pub fn truncate(&self, req: TruncateRequest) -> Result<(), ScopedStorageError> {
        self.run_mobile("truncate", req)
    }
}

#[derive(Debug, Deserialize)]
struct PickFolderResponse {
    folder: FolderHandle,
}
