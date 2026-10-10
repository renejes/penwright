use crate::error::ScopedStorageError;

pub fn normalize_relative_path(input: &str) -> Result<String, ScopedStorageError> {
    let trimmed = input.trim().replace('\\', "/");

    if trimmed.is_empty() {
        return Ok(String::new());
    }

    if trimmed.starts_with('/') || trimmed.starts_with('~') || trimmed.contains('\0') {
        return Err(ScopedStorageError::InvalidPath(input.to_string()));
    }

    let mut out = Vec::new();

    for (index, seg) in trimmed.split('/').enumerate() {
        if seg.is_empty() || seg == "." {
            continue;
        }

        if seg == ".." {
            return Err(ScopedStorageError::InvalidPath(input.to_string()));
        }

        if index == 0 && seg.contains(':') {
            return Err(ScopedStorageError::InvalidPath(input.to_string()));
        }

        out.push(seg);
    }

    Ok(out.join("/"))
}

#[cfg(test)]
mod tests {
    use super::normalize_relative_path;

    #[test]
    fn collapses_empty_segments_and_dots() {
        assert_eq!(
            normalize_relative_path("./nested//child.txt").unwrap(),
            "nested/child.txt"
        );
    }

    #[test]
    fn normalizes_windows_separators() {
        assert_eq!(
            normalize_relative_path(r"nested\child.txt").unwrap(),
            "nested/child.txt"
        );
    }

    #[test]
    fn rejects_parent_segments() {
        assert!(normalize_relative_path("../secret.txt").is_err());
    }

    #[test]
    fn rejects_absolute_paths() {
        assert!(normalize_relative_path("/var/mobile").is_err());
    }

    #[test]
    fn rejects_uri_like_paths() {
        assert!(normalize_relative_path("content://downloads").is_err());
    }
}
