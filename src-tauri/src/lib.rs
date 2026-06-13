mod db;

use db::{
  atomic_save, get_db_path, get_health, load_with_recovery, quarantine_invalid_tmp,
  run_readonly_sql, try_migrate_from_legacy_locations, AgentSqlResult, LoadDbResponse,
  SaveDbResponse, DbHealth,
};
use std::fs;
use tauri::{AppHandle, Manager};

#[tauri::command]
fn load_db(app: AppHandle) -> Result<LoadDbResponse, String> {
  let db_path = get_db_path(&app)?;
  quarantine_invalid_tmp(&db_path);

  let migration_message = try_migrate_from_legacy_locations(&app, &db_path)?;
  let mut response = load_with_recovery(&db_path)?;

  if let Some(message) = migration_message {
    response.message = Some(match response.message {
      Some(existing) => format!("{existing} {message}"),
      None => message,
    });
    if response.source == "primary" {
      response.source = "appdata_migration".to_string();
    }
  }

  Ok(response)
}

#[tauri::command]
fn save_db(app: AppHandle, data: String) -> Result<SaveDbResponse, String> {
  let db_path = get_db_path(&app)?;
  atomic_save(&db_path, &data)
}

#[tauri::command]
fn get_db_health(app: AppHandle) -> Result<DbHealth, String> {
  let db_path = get_db_path(&app)?;
  get_health(&db_path)
}

#[tauri::command]
fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
  fs::read(&path).map_err(|e| format!("No se pudo leer el archivo: {e}"))
}

#[tauri::command]
fn agent_run_readonly_sql(app: AppHandle, query: String) -> Result<AgentSqlResult, String> {
  run_readonly_sql(&app, query)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      // Set the window icon from icons/icon.png for taskbar + titlebar
      let icon_bytes = include_bytes!("../icons/icon.png");
      if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
        for (_label, window) in app.webview_windows() {
          let _ = window.set_icon(icon.clone());
        }
      }

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      load_db,
      save_db,
      get_db_health,
      read_binary_file,
      agent_run_readonly_sql
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}