use serde::Serialize;
use thiserror::Error;

pub const NATIVE_ERROR_PREFIX: &str = "SCOPED_STORAGE_ERROR:";

#[derive(Debug, Error)]
pub enum ScopedStorageError {
    #[error("unsupported on this platform")]
    Unsupported,
    #[error("invalid path: {0}")]
    InvalidPath(String),
    #[error("folder not found: {0}")]
    FolderNotFound(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("already exists: {0}")]
    AlreadyExists(String),
    #[error("permission denied")]
    PermissionDenied,
    #[error("cancelled")]
    Cancelled,
    #[error("invalid argument: {0}")]
    InvalidArgument(String),
    #[error("stale bookmark: {0}")]
    StaleBookmark(String),
    #[error("io error: {0}")]
    Io(String),
    #[error("native error: {0}")]
    Native(String),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorPayload {
    pub code: String,
    pub message: String,
}

impl ScopedStorageError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Unsupported => "UNSUPPORTED",
            Self::InvalidPath(_) => "INVALID_PATH",
            Self::FolderNotFound(_) => "FOLDER_NOT_FOUND",
            Self::NotFound(_) => "NOT_FOUND",
            Self::AlreadyExists(_) => "ALREADY_EXISTS",
            Self::PermissionDenied => "PERMISSION_DENIED",
            Self::Cancelled => "CANCELLED",
            Self::InvalidArgument(_) => "INVALID_ARGUMENT",
            Self::StaleBookmark(_) => "STALE_BOOKMARK",
            Self::Io(_) => "IO_ERROR",
            Self::Native(_) => "NATIVE_ERROR",
        }
    }

    pub fn payload(&self) -> ErrorPayload {
        ErrorPayload {
            code: self.code().to_string(),
            message: self.to_string(),
        }
    }

    pub fn from_code_message(code: &str, message: impl Into<String>) -> Self {
        let message = message.into();

        match code {
            "UNSUPPORTED" => Self::Unsupported,
            "INVALID_PATH" => Self::InvalidPath(message),
            "FOLDER_NOT_FOUND" => Self::FolderNotFound(message),
            "NOT_FOUND" => Self::NotFound(message),
            "ALREADY_EXISTS" => Self::AlreadyExists(message),
            "PERMISSION_DENIED" => Self::PermissionDenied,
            "CANCELLED" => Self::Cancelled,
            "INVALID_ARGUMENT" => Self::InvalidArgument(message),
            "STALE_BOOKMARK" => Self::StaleBookmark(message),
            "IO_ERROR" => Self::Io(message),
            "NATIVE_ERROR" => Self::Native(message),
            _ => Self::Native(message),
        }
    }

    pub fn from_native_message(message: &str) -> Self {
        if let Some(payload) = message
            .split_once(NATIVE_ERROR_PREFIX)
            .map(|(_, payload)| payload)
            .or_else(|| message.strip_prefix(NATIVE_ERROR_PREFIX))
        {
            let mut parts = payload.splitn(2, ':');
            let code = parts.next().unwrap_or("NATIVE_ERROR");
            let detail = parts.next().unwrap_or("native command failed");
            return Self::from_code_message(code, detail.trim());
        }

        let normalized = message.to_ascii_lowercase();

        if normalized.contains("cancel") {
            Self::Cancelled
        } else if normalized.contains("permission") || normalized.contains("security-scoped") {
            Self::PermissionDenied
        } else if normalized.contains("folder not found") {
            Self::FolderNotFound(message.to_string())
        } else if normalized.contains("already exists") {
            Self::AlreadyExists(message.to_string())
        } else if normalized.contains("not found") {
            Self::NotFound(message.to_string())
        } else if normalized.contains("invalid path") {
            Self::InvalidPath(message.to_string())
        } else if normalized.contains("invalid argument") || normalized.contains("bad argument") {
            Self::InvalidArgument(message.to_string())
        } else if normalized.contains("unsupported") {
            Self::Unsupported
        } else if normalized.contains("stale") || normalized.contains("bookmark") {
            Self::StaleBookmark(message.to_string())
        } else if normalized.contains("io") || normalized.contains("stream") {
            Self::Io(message.to_string())
        } else {
            Self::Native(message.to_string())
        }
    }
}

impl serde::Serialize for ScopedStorageError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        self.payload().serialize(serializer)
    }
}

#[cfg(test)]
mod tests {
    use super::ScopedStorageError;

    #[test]
    fn parses_structured_native_errors() {
        let error = ScopedStorageError::from_native_message(
            "SCOPED_STORAGE_ERROR:INVALID_PATH:path must be relative",
        );
        assert!(
            matches!(error, ScopedStorageError::InvalidPath(message) if message == "path must be relative")
        );
    }

    #[test]
    fn heuristically_maps_unstructured_errors() {
        let error = ScopedStorageError::from_native_message("Directory not found");
        assert!(
            matches!(error, ScopedStorageError::NotFound(message) if message == "Directory not found")
        );
    }
}
