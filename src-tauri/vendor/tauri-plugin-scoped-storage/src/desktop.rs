use std::marker::PhantomData;

use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::{error::ScopedStorageError, models::*};

pub struct ScopedStorage<R: Runtime>(PhantomData<fn() -> R>);

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> Result<ScopedStorage<R>, Box<dyn std::error::Error>> {
    Ok(ScopedStorage(PhantomData))
}

impl<R: Runtime> ScopedStorage<R> {
    pub async fn pick_folder_async(&self) -> Result<FolderHandle, ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn forget_folder(&self, _folder_id: String) -> Result<(), ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn list_folders(&self) -> Result<Vec<FolderHandle>, ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn get_folder_info(
        &self,
        _req: FolderIdRequest,
    ) -> Result<FolderHandle, ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn read_dir(&self, _req: ReadDirRequest) -> Result<Vec<DirEntry>, ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn stat(&self, _req: StatRequest) -> Result<FileStat, ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn exists(&self, _req: ExistsRequest) -> Result<ExistsResponse, ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn read_file(&self, _req: ReadFileRequest) -> Result<ReadFileResponse, ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn write_file(&self, _req: WriteFileRequest) -> Result<(), ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn read_text_file(
        &self,
        _req: ReadTextFileRequest,
    ) -> Result<ReadTextFileResponse, ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn read_text_file_lines(
        &self,
        _req: ReadTextFileRequest,
    ) -> Result<ReadTextFileLinesResponse, ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn write_text_file(&self, _req: WriteTextFileRequest) -> Result<(), ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn append_file(&self, _req: AppendFileRequest) -> Result<(), ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn mkdir(&self, _req: MkdirRequest) -> Result<(), ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn remove_file(&self, _req: RemoveFileRequest) -> Result<(), ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn remove_dir(&self, _req: RemoveDirRequest) -> Result<(), ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn copy(&self, _req: CopyRequest) -> Result<(), ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn mv(&self, _req: MoveRequest) -> Result<(), ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn rename(&self, _req: RenameRequest) -> Result<(), ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }

    pub fn truncate(&self, _req: TruncateRequest) -> Result<(), ScopedStorageError> {
        Err(ScopedStorageError::Unsupported)
    }
}
