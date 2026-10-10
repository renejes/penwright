use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderHandle {
    pub id: String,
    pub name: Option<String>,
    pub uri: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_file: bool,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub mime_type: Option<String>,
    pub last_modified: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStat {
    pub name: String,
    pub path: String,
    pub is_file: bool,
    pub is_dir: bool,
    pub size: Option<u64>,
    pub mime_type: Option<String>,
    pub last_modified: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderIdRequest {
    pub folder_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub(crate) struct ListFoldersResponse {
    pub folders: Vec<FolderHandle>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileRequest {
    pub folder_id: String,
    pub path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileResponse {
    pub data: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteFileRequest {
    pub folder_id: String,
    pub path: String,
    pub data: Vec<u8>,
    pub mime_type: Option<String>,
    pub recursive: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadTextFileRequest {
    pub folder_id: String,
    pub path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadTextFileResponse {
    pub contents: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadTextFileLinesResponse {
    pub lines: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteTextFileRequest {
    pub folder_id: String,
    pub path: String,
    pub contents: String,
    pub recursive: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppendFileRequest {
    pub folder_id: String,
    pub path: String,
    pub data: Vec<u8>,
    pub mime_type: Option<String>,
    pub create: Option<bool>,
    pub recursive: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadDirRequest {
    pub folder_id: String,
    pub path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadDirResponse {
    pub entries: Vec<DirEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatRequest {
    pub folder_id: String,
    pub path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistsRequest {
    pub folder_id: String,
    pub path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistsResponse {
    pub exists: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MkdirRequest {
    pub folder_id: String,
    pub path: String,
    pub recursive: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveFileRequest {
    pub folder_id: String,
    pub path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveDirRequest {
    pub folder_id: String,
    pub path: String,
    pub recursive: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyRequest {
    pub from_folder_id: String,
    pub from_path: String,
    pub to_folder_id: String,
    pub to_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveRequest {
    pub from_folder_id: String,
    pub from_path: String,
    pub to_folder_id: String,
    pub to_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameRequest {
    pub folder_id: String,
    pub from_path: String,
    pub to_path: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TruncateRequest {
    pub folder_id: String,
    pub path: String,
    pub len: u64,
}

#[cfg(test)]
mod tests {
    use super::{FolderHandle, WriteTextFileRequest};

    #[test]
    fn serializes_camel_case_models() {
        let json = serde_json::to_value(WriteTextFileRequest {
            folder_id: "folder-1".into(),
            path: "notes/test.txt".into(),
            contents: "hello".into(),
            recursive: Some(true),
        })
        .unwrap();

        assert_eq!(json["folderId"], "folder-1");
        assert_eq!(json["recursive"], true);
    }

    #[test]
    fn round_trips_folder_handle() {
        let handle = FolderHandle {
            id: "folder-1".into(),
            name: Some("Docs".into()),
            uri: Some("content://docs".into()),
        };

        let json = serde_json::to_string(&handle).unwrap();
        let decoded: FolderHandle = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded, handle);
    }
}
