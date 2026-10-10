// Prevents an extra console on Windows. The iPad build does not use it.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    penwright_ipad_lib::run()
}
