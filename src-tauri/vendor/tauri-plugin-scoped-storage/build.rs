const COMMANDS: &[&str] = &[
    "pick_folder",
    "forget_folder",
    "list_folders",
    "get_folder_info",
    "read_dir",
    "stat",
    "exists",
    "read_file",
    "write_file",
    "read_text_file",
    "read_text_file_lines",
    "write_text_file",
    "append_file",
    "mkdir",
    "remove_file",
    "remove_dir",
    "copy",
    "mv",
    "rename",
    "truncate",
];

fn main() {
    println!("cargo:rerun-if-changed=ios/Sources/ScopedStoragePlugin.swift");
    println!("cargo:rerun-if-changed=ios/Sources/ScopedStorageSupport.swift");
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
