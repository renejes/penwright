use tauri::{AppHandle, Manager, Runtime};

use crate::{error::ScopedStorageError, models::*, path::normalize_relative_path, ScopedStorage};

fn normalize_folder_id(folder_id: &str) -> Result<String, ScopedStorageError> {
    let normalized = folder_id.trim();
    if normalized.is_empty() {
        return Err(ScopedStorageError::InvalidArgument(
            "folder_id must not be empty".to_string(),
        ));
    }

    Ok(normalized.to_string())
}

fn normalize_required_path(path: &str) -> Result<String, ScopedStorageError> {
    let normalized = normalize_relative_path(path)?;
    if normalized.is_empty() {
        return Err(ScopedStorageError::InvalidPath(
            "path must not be empty".to_string(),
        ));
    }
    Ok(normalized)
}

fn normalize_optional_path(path: Option<String>) -> Result<Option<String>, ScopedStorageError> {
    path.map(|value| normalize_relative_path(&value))
        .transpose()
        .map(|value| value.filter(|path| !path.is_empty()))
}

fn ensure_distinct_transfer(
    operation: &str,
    from_folder_id: &str,
    from_path: &str,
    to_folder_id: &str,
    to_path: &str,
) -> Result<(), ScopedStorageError> {
    if from_folder_id == to_folder_id && from_path == to_path {
        return Err(ScopedStorageError::InvalidArgument(format!(
            "{operation} source and destination must differ"
        )));
    }

    Ok(())
}

#[tauri::command]
pub async fn pick_folder<R: Runtime>(
    app: AppHandle<R>,
) -> Result<FolderHandle, ScopedStorageError> {
    app.state::<ScopedStorage<R>>()
        .inner()
        .pick_folder_async()
        .await
}

#[tauri::command]
pub fn forget_folder<R: Runtime>(
    app: AppHandle<R>,
    folder_id: String,
) -> Result<(), ScopedStorageError> {
    let folder_id = normalize_folder_id(&folder_id)?;
    app.state::<ScopedStorage<R>>()
        .inner()
        .forget_folder(folder_id)
}

#[tauri::command]
pub fn list_folders<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<FolderHandle>, ScopedStorageError> {
    app.state::<ScopedStorage<R>>().inner().list_folders()
}

#[tauri::command]
pub fn get_folder_info<R: Runtime>(
    app: AppHandle<R>,
    mut req: FolderIdRequest,
) -> Result<FolderHandle, ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    app.state::<ScopedStorage<R>>().inner().get_folder_info(req)
}

#[tauri::command]
pub fn read_dir<R: Runtime>(
    app: AppHandle<R>,
    mut req: ReadDirRequest,
) -> Result<Vec<DirEntry>, ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_optional_path(req.path.take())?;
    app.state::<ScopedStorage<R>>().inner().read_dir(req)
}

#[tauri::command]
pub fn stat<R: Runtime>(
    app: AppHandle<R>,
    mut req: StatRequest,
) -> Result<FileStat, ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_required_path(&req.path)?;
    app.state::<ScopedStorage<R>>().inner().stat(req)
}

#[tauri::command]
pub fn exists<R: Runtime>(
    app: AppHandle<R>,
    mut req: ExistsRequest,
) -> Result<ExistsResponse, ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_required_path(&req.path)?;
    app.state::<ScopedStorage<R>>().inner().exists(req)
}

#[tauri::command]
pub fn read_file<R: Runtime>(
    app: AppHandle<R>,
    mut req: ReadFileRequest,
) -> Result<ReadFileResponse, ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_required_path(&req.path)?;
    app.state::<ScopedStorage<R>>().inner().read_file(req)
}

#[tauri::command]
pub fn write_file<R: Runtime>(
    app: AppHandle<R>,
    mut req: WriteFileRequest,
) -> Result<(), ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_required_path(&req.path)?;
    app.state::<ScopedStorage<R>>().inner().write_file(req)
}

#[tauri::command]
pub fn read_text_file<R: Runtime>(
    app: AppHandle<R>,
    mut req: ReadTextFileRequest,
) -> Result<ReadTextFileResponse, ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_required_path(&req.path)?;
    app.state::<ScopedStorage<R>>().inner().read_text_file(req)
}

#[tauri::command]
pub fn read_text_file_lines<R: Runtime>(
    app: AppHandle<R>,
    mut req: ReadTextFileRequest,
) -> Result<ReadTextFileLinesResponse, ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_required_path(&req.path)?;
    app.state::<ScopedStorage<R>>()
        .inner()
        .read_text_file_lines(req)
}

#[tauri::command]
pub fn write_text_file<R: Runtime>(
    app: AppHandle<R>,
    mut req: WriteTextFileRequest,
) -> Result<(), ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_required_path(&req.path)?;
    app.state::<ScopedStorage<R>>().inner().write_text_file(req)
}

#[tauri::command]
pub fn append_file<R: Runtime>(
    app: AppHandle<R>,
    mut req: AppendFileRequest,
) -> Result<(), ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_required_path(&req.path)?;
    app.state::<ScopedStorage<R>>().inner().append_file(req)
}

#[tauri::command]
pub fn mkdir<R: Runtime>(
    app: AppHandle<R>,
    mut req: MkdirRequest,
) -> Result<(), ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_required_path(&req.path)?;
    app.state::<ScopedStorage<R>>().inner().mkdir(req)
}

#[tauri::command]
pub fn remove_file<R: Runtime>(
    app: AppHandle<R>,
    mut req: RemoveFileRequest,
) -> Result<(), ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_required_path(&req.path)?;
    app.state::<ScopedStorage<R>>().inner().remove_file(req)
}

#[tauri::command]
pub fn remove_dir<R: Runtime>(
    app: AppHandle<R>,
    mut req: RemoveDirRequest,
) -> Result<(), ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_required_path(&req.path)?;
    app.state::<ScopedStorage<R>>().inner().remove_dir(req)
}

#[tauri::command]
pub fn copy<R: Runtime>(app: AppHandle<R>, mut req: CopyRequest) -> Result<(), ScopedStorageError> {
    req.from_folder_id = normalize_folder_id(&req.from_folder_id)?;
    req.to_folder_id = normalize_folder_id(&req.to_folder_id)?;
    req.from_path = normalize_required_path(&req.from_path)?;
    req.to_path = normalize_required_path(&req.to_path)?;
    ensure_distinct_transfer(
        "copy",
        &req.from_folder_id,
        &req.from_path,
        &req.to_folder_id,
        &req.to_path,
    )?;
    app.state::<ScopedStorage<R>>().inner().copy(req)
}

#[tauri::command]
pub fn mv<R: Runtime>(app: AppHandle<R>, mut req: MoveRequest) -> Result<(), ScopedStorageError> {
    req.from_folder_id = normalize_folder_id(&req.from_folder_id)?;
    req.to_folder_id = normalize_folder_id(&req.to_folder_id)?;
    req.from_path = normalize_required_path(&req.from_path)?;
    req.to_path = normalize_required_path(&req.to_path)?;
    ensure_distinct_transfer(
        "move",
        &req.from_folder_id,
        &req.from_path,
        &req.to_folder_id,
        &req.to_path,
    )?;
    app.state::<ScopedStorage<R>>().inner().mv(req)
}

#[tauri::command]
pub fn rename<R: Runtime>(
    app: AppHandle<R>,
    mut req: RenameRequest,
) -> Result<(), ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.from_path = normalize_required_path(&req.from_path)?;
    req.to_path = normalize_required_path(&req.to_path)?;
    ensure_distinct_transfer(
        "rename",
        &req.folder_id,
        &req.from_path,
        &req.folder_id,
        &req.to_path,
    )?;
    app.state::<ScopedStorage<R>>().inner().rename(req)
}

#[tauri::command]
pub fn truncate<R: Runtime>(
    app: AppHandle<R>,
    mut req: TruncateRequest,
) -> Result<(), ScopedStorageError> {
    req.folder_id = normalize_folder_id(&req.folder_id)?;
    req.path = normalize_required_path(&req.path)?;
    app.state::<ScopedStorage<R>>().inner().truncate(req)
}

#[cfg(test)]
mod tests {
    use super::{ensure_distinct_transfer, normalize_folder_id, normalize_optional_path};
    use crate::error::ScopedStorageError;

    #[test]
    fn rejects_blank_folder_ids() {
        let error = normalize_folder_id("   ").unwrap_err();
        assert!(
            matches!(error, ScopedStorageError::InvalidArgument(message) if message == "folder_id must not be empty")
        );
    }

    #[test]
    fn blank_optional_paths_become_none() {
        let path = normalize_optional_path(Some("  ".into())).unwrap();
        assert_eq!(path, None);
    }

    #[test]
    fn rejects_same_source_and_destination() {
        let error =
            ensure_distinct_transfer("move", "folder-1", "notes/a.txt", "folder-1", "notes/a.txt")
                .unwrap_err();
        assert!(
            matches!(error, ScopedStorageError::InvalidArgument(message) if message == "move source and destination must differ")
        );
    }
}
