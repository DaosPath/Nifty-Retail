use rusqlite::{params, params_from_iter, Connection};
use serde::Serialize;
use serde_json::{Map, Value};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::{AppHandle, Manager};

const DATA_DIR_NAME: &str = "data";
const DB_FILENAME: &str = "nifty_pos.db";
const LEGACY_JSON_FILENAME: &str = "nifty_pos_db.json";
const BACKUP_DIR: &str = "backups";
const MAX_ROTATING_BACKUPS: usize = 12;
const BACKUP_EVERY_N_SAVES: u32 = 8;
const STORAGE_ENGINE: &str = "sqlite";

static SAVE_COUNTER: AtomicU32 = AtomicU32::new(0);

const COLLECTION_KEYS: &[&str] = &[
  "sales",
  "cashSessions",
  "lots",
  "debts",
  "suppliers",
  "categories",
  "warehouses",
  "locations",
  "manufacturers",
  "stockMovements",
  "stockPurchases",
  "supplierDebts",
];

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LoadDbResponse {
  pub content: String,
  pub source: String,
  pub recovered: bool,
  pub message: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveDbResponse {
  pub saved_at: String,
  pub backup_created: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DbHealth {
  pub data_dir: String,
  pub db_path: String,
  pub storage_engine: String,
  pub primary_exists: bool,
  pub primary_bytes: Option<u64>,
  pub backup_exists: bool,
  pub rotating_backups: usize,
  pub tmp_exists: bool,
  pub legacy_json_exists: bool,
  pub products_with_images: usize,
}

fn app_root_dir(app: &AppHandle) -> Result<PathBuf, String> {
  app.path().app_local_data_dir().map_err(|e| e.to_string())
}

pub fn get_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
  let dir = app_root_dir(app)?.join(DATA_DIR_NAME);
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  Ok(dir)
}

pub fn get_db_path(app: &AppHandle) -> Result<PathBuf, String> {
  Ok(get_data_dir(app)?.join(DB_FILENAME))
}

fn exe_adjacent_data_dir() -> Option<PathBuf> {
  let exe = std::env::current_exe().ok()?;
  let parent = exe.parent()?;
  Some(parent.join(DATA_DIR_NAME))
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
  if !src.exists() {
    return Ok(());
  }

  fs::create_dir_all(dst).map_err(|e| e.to_string())?;

  for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
    let entry = entry.map_err(|e| e.to_string())?;
    let file_type = entry.file_type().map_err(|e| e.to_string())?;
    let target = dst.join(entry.file_name());

    if file_type.is_dir() {
      copy_dir_recursive(&entry.path(), &target)?;
    } else if file_type.is_file() {
      fs::copy(entry.path(), &target).map_err(|e| e.to_string())?;
    }
  }

  Ok(())
}

fn migrate_db_bundle(source_db: &Path, target_db: &Path, source_root: &Path, target_data_dir: &Path) -> Result<(), String> {
  ensure_parent(target_db)?;
  fs::copy(source_db, target_db).map_err(|e| e.to_string())?;

  let old_bak = backup_path(source_db);
  if old_bak.exists() {
    let _ = fs::copy(&old_bak, backup_path(target_db));
  }

  let old_backups = source_root.join(BACKUP_DIR);
  if old_backups.exists() {
    let _ = copy_dir_recursive(&old_backups, &target_data_dir.join(BACKUP_DIR));
  }

  Ok(())
}

pub fn try_migrate_from_legacy_locations(
  app: &AppHandle,
  db_path: &Path,
) -> Result<Option<String>, String> {
  if db_path.exists() {
    return Ok(None);
  }

  let data_dir = db_path
    .parent()
    .ok_or_else(|| "No se pudo resolver la carpeta data.".to_string())?;
  let app_root = app_root_dir(app)?;
  let flat_db = app_root.join(DB_FILENAME);
  let flat_json = app_root.join(LEGACY_JSON_FILENAME);

  if flat_db.exists() {
    migrate_db_bundle(&flat_db, db_path, &app_root, data_dir)?;
    return Ok(Some(
      "Se organizaron los datos en la carpeta data dentro de AppData.".to_string(),
    ));
  }

  if flat_json.exists() {
    let target_json = data_dir.join(LEGACY_JSON_FILENAME);
    fs::copy(&flat_json, &target_json).map_err(|e| e.to_string())?;
    return Ok(Some(
      "Se movió la base JSON a la carpeta data en AppData. Se importará a SQLite.".to_string(),
    ));
  }

  if let Some(exe_data_dir) = exe_adjacent_data_dir() {
    let exe_db = exe_data_dir.join(DB_FILENAME);
    if exe_db.exists() {
      migrate_db_bundle(&exe_db, db_path, &exe_data_dir, data_dir)?;
      return Ok(Some(
        "Se migraron los datos desde la carpeta data del ejecutable a AppData.".to_string(),
      ));
    }

    let exe_json = exe_data_dir.join(LEGACY_JSON_FILENAME);
    if exe_json.exists() {
      let target_json = data_dir.join(LEGACY_JSON_FILENAME);
      fs::copy(&exe_json, &target_json).map_err(|e| e.to_string())?;
      return Ok(Some(
        "Se migró la base JSON del ejecutable a la carpeta data en AppData.".to_string(),
      ));
    }
  }

  Ok(None)
}

fn legacy_json_path(db_path: &Path) -> PathBuf {
  db_path
    .parent()
    .map(|parent| parent.join(LEGACY_JSON_FILENAME))
    .unwrap_or_else(|| PathBuf::from(LEGACY_JSON_FILENAME))
}

fn backup_path(db_path: &Path) -> PathBuf {
  let mut path = db_path.to_path_buf();
  path.set_extension("db.bak");
  path
}

fn tmp_path(db_path: &Path) -> PathBuf {
  let mut path = db_path.to_path_buf();
  path.set_extension("db.tmp");
  path
}

fn backups_dir(db_path: &Path) -> PathBuf {
  db_path
    .parent()
    .map(|parent| parent.join(BACKUP_DIR))
    .unwrap_or_else(|| PathBuf::from(BACKUP_DIR))
}

fn default_db() -> &'static str {
  r#"{"schemaVersion":2,"products":[],"sales":[],"cashSessions":[],"lots":[],"debts":[]}"#
}

fn is_valid_db_json(raw: &str) -> bool {
  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return false;
  }

  let value: Value = match serde_json::from_str(trimmed) {
    Ok(value) => value,
    Err(_) => return false,
  };

  let Some(obj) = value.as_object() else {
    return false;
  };

  obj.contains_key("products")
    || obj.contains_key("sales")
    || obj.contains_key("cashSessions")
    || obj.contains_key("storeConfig")
}

fn read_legacy_json(path: &Path) -> Option<String> {
  if !path.exists() {
    return None;
  }

  let mut file = File::open(path).ok()?;
  let mut content = String::new();
  file.read_to_string(&mut content).ok()?;

  if is_valid_db_json(&content) {
    Some(content)
  } else {
    None
  }
}

fn list_rotating_backups(db_path: &Path) -> Vec<PathBuf> {
  let dir = backups_dir(db_path);
  let Ok(entries) = fs::read_dir(&dir) else {
    return Vec::new();
  };

  let mut files: Vec<PathBuf> = entries
    .filter_map(|entry| entry.ok())
    .map(|entry| entry.path())
    .filter(|path| {
      path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext == "db")
        .unwrap_or(false)
    })
    .collect();

  files.sort_by(|a, b| {
    let a_time = fs::metadata(a).and_then(|m| m.modified()).ok();
    let b_time = fs::metadata(b).and_then(|m| m.modified()).ok();
    b_time.cmp(&a_time)
  });

  files
}

fn ensure_parent(path: &Path) -> Result<(), String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
  }
  Ok(())
}

fn chrono_like_timestamp() -> String {
  use std::time::{SystemTime, UNIX_EPOCH};
  let secs = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_secs())
    .unwrap_or(0);
  format!("{secs}")
}

fn apply_connection_pragmas(conn: &Connection) -> Result<(), String> {
  conn
    .execute_batch(
      r#"
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA cache_size = -64000;
      PRAGMA temp_store = MEMORY;
      PRAGMA mmap_size = 268435456;
      PRAGMA busy_timeout = 5000;
      "#,
    )
    .map_err(|e| e.to_string())
}

fn init_schema(conn: &Connection) -> Result<(), String> {
  apply_connection_pragmas(conn)?;

  conn.execute_batch(
    r#"
    CREATE TABLE IF NOT EXISTS meta (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      schema_version INTEGER NOT NULL DEFAULT 2,
      saved_at TEXT,
      storage_engine TEXT NOT NULL DEFAULT 'sqlite'
    );

    CREATE TABLE IF NOT EXISTS products (
      code TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      image_base64 TEXT
    );

    CREATE TABLE IF NOT EXISTS collections (
      name TEXT PRIMARY KEY,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS store_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL
    );
    "#,
  )
  .map_err(|e| e.to_string())
}

fn write_meta(conn: &Connection, schema_version: i64, saved_at: &str) -> Result<(), String> {
  conn
    .execute(
      "INSERT INTO meta (id, schema_version, saved_at, storage_engine)
       VALUES (1, ?1, ?2, ?3)
       ON CONFLICT(id) DO UPDATE SET
         schema_version = excluded.schema_version,
         saved_at = excluded.saved_at,
         storage_engine = excluded.storage_engine",
      params![schema_version, saved_at, STORAGE_ENGINE],
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}

fn write_products(conn: &Connection, products: &[Value]) -> Result<(), String> {
  let mut stmt = conn
    .prepare(
      "INSERT INTO products (code, payload, image_base64) VALUES (?1, ?2, ?3)
       ON CONFLICT(code) DO UPDATE SET
         payload = excluded.payload,
         image_base64 = excluded.image_base64",
    )
    .map_err(|e| e.to_string())?;

  let mut incoming_codes: Vec<String> = Vec::with_capacity(products.len());

  for product in products {
    let Some(code) = product.get("code").and_then(|v| v.as_str()) else {
      continue;
    };

    let mut product_copy = product.clone();
    let image_base64 = product_copy
      .get("image")
      .and_then(|v| v.as_str())
      .filter(|s| !s.is_empty())
      .map(|s| s.to_string());

    if let Some(obj) = product_copy.as_object_mut() {
      obj.remove("image");
    }

    let payload = serde_json::to_string(&product_copy).map_err(|e| e.to_string())?;
    stmt.execute(params![code, payload, image_base64])
      .map_err(|e| e.to_string())?;
    incoming_codes.push(code.to_string());
  }

  if incoming_codes.is_empty() {
    conn
      .execute("DELETE FROM products", [])
      .map_err(|e| e.to_string())?;
  } else {
    let placeholders = incoming_codes
      .iter()
      .map(|_| "?")
      .collect::<Vec<_>>()
      .join(",");
    let sql = format!("DELETE FROM products WHERE code NOT IN ({placeholders})");
    conn.execute(&sql, params_from_iter(incoming_codes.iter()))
      .map_err(|e| e.to_string())?;
  }

  Ok(())
}

fn write_collections(conn: &Connection, root: &Map<String, Value>) -> Result<(), String> {
  let mut stmt = conn
    .prepare(
      "INSERT INTO collections (name, payload) VALUES (?1, ?2)
       ON CONFLICT(name) DO UPDATE SET payload = excluded.payload",
    )
    .map_err(|e| e.to_string())?;

  for key in COLLECTION_KEYS {
    let payload_value = root
      .get(*key)
      .cloned()
      .unwrap_or_else(|| Value::Array(Vec::new()));
    let payload = serde_json::to_string(&payload_value).map_err(|e| e.to_string())?;
    stmt.execute(params![key, payload])
      .map_err(|e| e.to_string())?;
  }

  Ok(())
}

fn write_store_config(conn: &Connection, root: &Map<String, Value>) -> Result<(), String> {
  let store_config = root
    .get("storeConfig")
    .cloned()
    .unwrap_or_else(|| Value::Object(Map::new()));
  let payload = serde_json::to_string(&store_config).map_err(|e| e.to_string())?;

  conn
    .execute(
      "INSERT INTO store_config (id, payload) VALUES (1, ?1)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
      params![payload],
    )
    .map_err(|e| e.to_string())?;

  Ok(())
}

fn import_json_to_conn(conn: &Connection, data: &str) -> Result<(), String> {
  let root: Value = serde_json::from_str(data).map_err(|e| e.to_string())?;
  let obj = root
    .as_object()
    .ok_or_else(|| "El JSON no es un objeto válido.".to_string())?;

  let schema_version = obj
    .get("schemaVersion")
    .and_then(|v| v.as_i64())
    .unwrap_or(2);
  let saved_at = obj
    .get("savedAt")
    .and_then(|v| v.as_str())
    .unwrap_or("")
    .to_string();

  let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;

  write_meta(&tx, schema_version, &saved_at)?;

  let products = obj
    .get("products")
    .and_then(|v| v.as_array())
    .cloned()
    .unwrap_or_default();
  write_products(&tx, &products)?;
  write_collections(&tx, obj)?;
  write_store_config(&tx, obj)?;

  tx.commit().map_err(|e| e.to_string())?;
  Ok(())
}

fn populate_db_file(path: &Path, data: &str) -> Result<(), String> {
  if path.exists() {
    fs::remove_file(path).map_err(|e| e.to_string())?;
  }

  let conn = Connection::open(path).map_err(|e| e.to_string())?;
  init_schema(&conn)?;
  import_json_to_conn(&conn, data)?;
  Ok(())
}

fn update_db_file_in_place(path: &Path, data: &str) -> Result<(), String> {
  let conn = Connection::open(path).map_err(|e| e.to_string())?;
  init_schema(&conn)?;
  import_json_to_conn(&conn, data)?;
  Ok(())
}

fn should_run_heavy_backup_tasks() -> bool {
  let count = SAVE_COUNTER.fetch_add(1, Ordering::Relaxed) + 1;
  count % BACKUP_EVERY_N_SAVES == 0
}

fn maybe_backup_db(db_path: &Path, conn: Option<&Connection>) -> Result<bool, String> {
  if !should_run_heavy_backup_tasks() {
    return Ok(false);
  }

  if db_path.exists() {
    let _ = fs::copy(db_path, backup_path(db_path));
  }

  if let Some(conn) = conn {
    let _ = conn.execute_batch("PRAGMA wal_checkpoint(PASSIVE);");
  }

  write_rotating_backup(db_path)
}

fn read_products(conn: &Connection) -> Result<Vec<Value>, String> {
  let mut stmt = conn
    .prepare("SELECT payload, image_base64 FROM products ORDER BY code")
    .map_err(|e| e.to_string())?;

  let rows = stmt
    .query_map([], |row| {
      let payload: String = row.get(0)?;
      let image_base64: Option<String> = row.get(1)?;
      Ok((payload, image_base64))
    })
    .map_err(|e| e.to_string())?;

  let mut products = Vec::new();
  for row in rows {
    let (payload, image_base64) = row.map_err(|e| e.to_string())?;
    let mut product: Value =
      serde_json::from_str(&payload).map_err(|e| format!("Producto inválido: {e}"))?;

    if let Some(image) = image_base64.filter(|s| !s.is_empty()) {
      if let Some(obj) = product.as_object_mut() {
        obj.insert("image".to_string(), Value::String(image));
      }
    }

    products.push(product);
  }

  Ok(products)
}

fn read_collections(conn: &Connection) -> Result<Map<String, Value>, String> {
  let mut collections = Map::new();

  for key in COLLECTION_KEYS {
    let payload: String = conn
      .query_row(
        "SELECT payload FROM collections WHERE name = ?1",
        params![key],
        |row| row.get(0),
      )
      .unwrap_or_else(|_| "[]".to_string());

    let value: Value = serde_json::from_str(&payload).unwrap_or_else(|_| Value::Array(Vec::new()));
    collections.insert(key.to_string(), value);
  }

  Ok(collections)
}

fn read_store_config(conn: &Connection) -> Result<Value, String> {
  let payload: String = conn
    .query_row(
      "SELECT payload FROM store_config WHERE id = 1",
      [],
      |row| row.get(0),
    )
    .unwrap_or_else(|_| "{}".to_string());

  serde_json::from_str(&payload).map_err(|e| e.to_string())
}

fn read_meta(conn: &Connection) -> Result<(i64, String), String> {
  match conn.query_row(
    "SELECT schema_version, saved_at FROM meta WHERE id = 1",
    [],
    |row| {
      let schema_version: i64 = row.get(0)?;
      let saved_at: Option<String> = row.get(1)?;
      Ok((schema_version, saved_at.unwrap_or_default()))
    },
  ) {
    Ok(meta) => Ok(meta),
    Err(_) => Ok((2, String::new())),
  }
}

fn export_json_from_conn(conn: &Connection) -> Result<String, String> {
  let (schema_version, saved_at) = read_meta(conn)?;
  let products = read_products(conn)?;
  let collections = read_collections(conn)?;
  let store_config = read_store_config(conn)?;

  let mut root = Map::new();
  root.insert(
    "schemaVersion".to_string(),
    Value::Number(schema_version.into()),
  );
  if !saved_at.is_empty() {
    root.insert("savedAt".to_string(), Value::String(saved_at));
  }
  root.insert("products".to_string(), Value::Array(products));
  for (key, value) in collections {
    root.insert(key, value);
  }
  root.insert("storeConfig".to_string(), store_config);

  serde_json::to_string(&Value::Object(root)).map_err(|e| e.to_string())
}

fn try_export_db(path: &Path) -> Option<String> {
  let conn = Connection::open(path).ok()?;
  export_json_from_conn(&conn).ok()
}

fn write_rotating_backup(db_path: &Path) -> Result<bool, String> {
  if !db_path.exists() {
    return Ok(false);
  }

  let dir = backups_dir(db_path);
  fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

  let stamp = chrono_like_timestamp();
  let backup_file = dir.join(format!("nifty_pos_{stamp}.db"));
  fs::copy(db_path, &backup_file).map_err(|e| e.to_string())?;

  let backups = list_rotating_backups(db_path);
  if backups.len() > MAX_ROTATING_BACKUPS {
    for old in backups.iter().skip(MAX_ROTATING_BACKUPS) {
      let _ = fs::remove_file(old);
    }
  }

  Ok(true)
}

fn quarantine_legacy_json(legacy_path: &Path) {
  if !legacy_path.exists() {
    return;
  }

  let mut migrated = legacy_path.to_path_buf();
  migrated.set_extension("json.migrated");
  let _ = fs::rename(legacy_path, migrated);
}

pub fn atomic_save(db_path: &Path, data: &str) -> Result<SaveDbResponse, String> {
  if !is_valid_db_json(data) {
    return Err("El JSON a guardar no es válido o está incompleto.".to_string());
  }

  ensure_parent(db_path)?;

  let backup_created = if db_path.exists() {
    update_db_file_in_place(db_path, data)?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    maybe_backup_db(db_path, Some(&conn)).unwrap_or(false)
  } else {
    populate_db_file(db_path, data)?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    maybe_backup_db(db_path, Some(&conn)).unwrap_or(false)
  };

  Ok(SaveDbResponse {
    saved_at: chrono_like_timestamp(),
    backup_created,
  })
}

pub fn load_with_recovery(db_path: &Path) -> Result<LoadDbResponse, String> {
  ensure_parent(db_path)?;
  let legacy_path = legacy_json_path(db_path);

  if !db_path.exists() {
    if let Some(legacy_content) = read_legacy_json(&legacy_path) {
      populate_db_file(db_path, &legacy_content)?;
      quarantine_legacy_json(&legacy_path);
      return Ok(LoadDbResponse {
        content: legacy_content,
        source: "legacy_json".to_string(),
        recovered: false,
        message: Some(
          "Se migró la base JSON anterior a SQLite. Las imágenes quedaron en base64 dentro de la base.".to_string(),
        ),
      });
    }

    let content = default_db().to_string();
    populate_db_file(db_path, &content)?;
    return Ok(LoadDbResponse {
      content,
      source: "default".to_string(),
      recovered: false,
      message: Some("Se creó una base de datos SQLite nueva.".to_string()),
    });
  }

  if let Some(content) = try_export_db(db_path) {
    return Ok(LoadDbResponse {
      content,
      source: "primary".to_string(),
      recovered: false,
      message: None,
    });
  }

  let candidates: Vec<(&str, PathBuf)> = vec![
    ("backup", backup_path(db_path)),
    ("tmp", tmp_path(db_path)),
  ];

  for (source, path) in candidates {
    if let Some(content) = try_export_db(&path) {
      fs::copy(&path, db_path).map_err(|e| e.to_string())?;
      return Ok(LoadDbResponse {
        content,
        source: source.to_string(),
        recovered: true,
        message: Some(format!(
          "La base SQLite estaba dañada. Se restauró desde {source}."
        )),
      });
    }
  }

  for path in list_rotating_backups(db_path) {
    if let Some(content) = try_export_db(&path) {
      fs::copy(&path, db_path).map_err(|e| e.to_string())?;
      return Ok(LoadDbResponse {
        content,
        source: "rotating_backup".to_string(),
        recovered: true,
        message: Some(
          "La base SQLite estaba dañada. Se restauró desde un respaldo automático.".to_string(),
        ),
      });
    }
  }

  if let Some(legacy_content) = read_legacy_json(&legacy_path) {
    let quarantine = db_path.with_extension("db.corrupt");
    let _ = fs::rename(db_path, quarantine);
    populate_db_file(db_path, &legacy_content)?;
    quarantine_legacy_json(&legacy_path);
    return Ok(LoadDbResponse {
      content: legacy_content,
      source: "legacy_json".to_string(),
      recovered: true,
      message: Some(
        "No se pudo abrir SQLite. Se reconstruyó desde el JSON legado y las imágenes en base64.".to_string(),
      ),
    });
  }

  let quarantine = db_path.with_extension("db.corrupt");
  let _ = fs::rename(db_path, quarantine);

  let content = default_db().to_string();
  populate_db_file(db_path, &content)?;

  Ok(LoadDbResponse {
    content,
    source: "default".to_string(),
    recovered: true,
    message: Some(
      "No se pudo recuperar la base de datos. Se inició una base SQLite limpia.".to_string(),
    ),
  })
}

pub fn get_health(db_path: &Path) -> Result<DbHealth, String> {
  let primary_exists = db_path.exists();
  let primary_bytes = if primary_exists {
    fs::metadata(db_path).ok().map(|m| m.len())
  } else {
    None
  };

  let products_with_images = if primary_exists {
    Connection::open(db_path)
      .ok()
      .and_then(|conn| {
        conn.query_row(
          "SELECT COUNT(*) FROM products WHERE image_base64 IS NOT NULL AND TRIM(image_base64) != ''",
          [],
          |row| row.get::<_, i64>(0),
        )
        .ok()
      })
      .unwrap_or(0) as usize
  } else {
    0
  };

  let data_dir = db_path
    .parent()
    .map(|p| p.to_string_lossy().to_string())
    .unwrap_or_default();

  Ok(DbHealth {
    data_dir,
    db_path: db_path.to_string_lossy().to_string(),
    storage_engine: STORAGE_ENGINE.to_string(),
    primary_exists,
    primary_bytes,
    backup_exists: backup_path(db_path).exists(),
    rotating_backups: list_rotating_backups(db_path).len(),
    tmp_exists: tmp_path(db_path).exists(),
    legacy_json_exists: legacy_json_path(db_path).exists(),
    products_with_images,
  })
}

pub fn quarantine_invalid_tmp(db_path: &Path) {
  let tmp = tmp_path(db_path);
  if tmp.exists() && try_export_db(&tmp).is_none() {
    let mut quarantine = tmp_path(db_path);
    quarantine.set_extension("tmp.invalid");
    let _ = fs::rename(tmp, quarantine);
  }
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentSqlResult {
  pub columns: Vec<String>,
  pub rows: Vec<Vec<Value>>,
  pub row_count: usize,
  pub truncated: bool,
  pub sql_executed: String,
}

const SQL_FORBIDDEN: &[&str] = &[
  "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE", "REPLACE", "ATTACH", "DETACH",
  "TRUNCATE", "VACUUM", "REINDEX", "GRANT", "REVOKE", "PRAGMA",
];

fn normalize_readonly_sql(query: &str) -> Result<String, String> {
  let trimmed = query.trim();
  if trimmed.is_empty() {
    return Err("La consulta SQL está vacía.".to_string());
  }

  if trimmed.contains(';') {
    return Err("Solo se permite una consulta SQL por ejecución.".to_string());
  }

  let upper = trimmed.to_uppercase();
  for token in SQL_FORBIDDEN {
    if upper.contains(token) {
      return Err(format!("Operación no permitida en modo lectura: {token}"));
    }
  }

  let starts_ok = upper.starts_with("SELECT") || upper.starts_with("WITH");
  if !starts_ok {
    return Err("Solo se permiten consultas SELECT o WITH.".to_string());
  }

  let mut sql = trimmed.to_string();
  if !upper.contains(" LIMIT ") {
    sql.push_str(" LIMIT 200");
  }

  Ok(sql)
}

fn sqlite_value_to_json(value: rusqlite::types::Value) -> Value {
  match value {
    rusqlite::types::Value::Null => Value::Null,
    rusqlite::types::Value::Integer(v) => Value::from(v),
    rusqlite::types::Value::Real(v) => {
      if let Some(num) = serde_json::Number::from_f64(v) {
        Value::from(num)
      } else {
        Value::from(v)
      }
    }
    rusqlite::types::Value::Text(v) => Value::from(v),
    rusqlite::types::Value::Blob(v) => Value::from(format!("<blob:{} bytes>", v.len())),
  }
}

pub fn run_readonly_sql(app: &AppHandle, query: String) -> Result<AgentSqlResult, String> {
  let sql = normalize_readonly_sql(&query)?;
  let db_path = get_db_path(app)?;
  let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
  apply_connection_pragmas(&conn)?;

  let mut stmt = conn.prepare(&sql).map_err(|e| format!("SQL inválido: {e}"))?;
  let columns: Vec<String> = stmt
    .column_names()
    .into_iter()
    .map(|name| name.to_string())
    .collect();
  let col_count = columns.len();

  let mut rows = Vec::new();
  let mut row_iter = stmt.query([]).map_err(|e| e.to_string())?;

  while let Some(row) = row_iter.next().map_err(|e| e.to_string())? {
    let mut values = Vec::with_capacity(col_count);
    for index in 0..col_count {
      let raw: rusqlite::types::Value = row.get(index).map_err(|e| e.to_string())?;
      values.push(sqlite_value_to_json(raw));
    }
    rows.push(values);
  }

  let row_count = rows.len();
  let truncated = row_count >= 200;

  Ok(AgentSqlResult {
    columns,
    rows,
    row_count,
    truncated,
    sql_executed: sql,
  })
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::time::{SystemTime, UNIX_EPOCH};

  fn temp_db_path(name: &str) -> PathBuf {
    let stamp = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .map(|d| d.as_secs())
      .unwrap_or(0);
    std::env::temp_dir().join(format!("nifty_test_{name}_{stamp}.db"))
  }

  #[test]
  fn readonly_sql_rejects_writes_and_appends_limit() {
    assert!(normalize_readonly_sql("SELECT code FROM products").unwrap().contains("LIMIT"));
    assert!(normalize_readonly_sql("SELECT code FROM products LIMIT 10").unwrap().contains("LIMIT 10"));
    assert!(normalize_readonly_sql("DELETE FROM products").is_err());
    assert!(normalize_readonly_sql("SELECT 1; SELECT 2").is_err());
  }

  #[test]
  fn validates_minimal_db_json() {
    assert!(is_valid_db_json(r#"{"products":[]}"#));
    assert!(!is_valid_db_json("{"));
    assert!(!is_valid_db_json(r#"{"foo":1}"#));
  }

  #[test]
  fn in_place_save_upserts_products_without_full_rewrite() {
    let db_path = temp_db_path("in_place_upsert");
    let _ = fs::remove_file(&db_path);

    let initial = r#"{
      "schemaVersion": 2,
      "products": [
        {"code": "P1", "name": "Arroz", "stock": 10},
        {"code": "P2", "name": "Frijol", "stock": 5}
      ],
      "sales": [],
      "cashSessions": [],
      "lots": [],
      "debts": []
    }"#;

    atomic_save(&db_path, initial).expect("initial save");

    let updated = r#"{
      "schemaVersion": 2,
      "products": [
        {"code": "P1", "name": "Arroz Premium", "stock": 8},
        {"code": "P3", "name": "Azucar", "stock": 2}
      ],
      "sales": [],
      "cashSessions": [],
      "lots": [],
      "debts": []
    }"#;

    atomic_save(&db_path, updated).expect("upsert save");
    let loaded = load_with_recovery(&db_path).expect("load");

    assert!(loaded.content.contains("\"code\":\"P1\""));
    assert!(loaded.content.contains("Arroz Premium"));
    assert!(loaded.content.contains("\"code\":\"P3\""));
    assert!(!loaded.content.contains("\"code\":\"P2\""));

    let conn = Connection::open(&db_path).expect("open");
    let count: i64 = conn
      .query_row("SELECT COUNT(*) FROM products", [], |row| row.get(0))
      .expect("count");
    assert_eq!(count, 2);

    let _ = fs::remove_file(&db_path);
  }

  #[test]
  fn sqlite_roundtrip_preserves_product_image_base64() {
    let db_path = temp_db_path("image_roundtrip");
    let _ = fs::remove_file(&db_path);

    let input = r#"{
      "schemaVersion": 2,
      "savedAt": "2026-01-01T00:00:00.000Z",
      "products": [
        {
          "code": "P1",
          "name": "Arroz",
          "category": "Granos",
          "purchasePrice": 3.5,
          "sellingPrice": 5,
          "stock": 10,
          "minStock": 2,
          "image": "data:image/png;base64,abc123"
        }
      ],
      "sales": [],
      "cashSessions": [],
      "lots": [],
      "debts": []
    }"#;

    atomic_save(&db_path, input).expect("save");
    let loaded = load_with_recovery(&db_path).expect("load");

    assert!(loaded.content.contains("data:image/png;base64,abc123"));
    assert!(loaded.content.contains("\"code\":\"P1\""));

    let conn = Connection::open(&db_path).expect("open");
    let image_count: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM products WHERE image_base64 LIKE 'data:image%'",
        [],
        |row| row.get(0),
      )
      .expect("count");
    assert_eq!(image_count, 1);

    let _ = fs::remove_file(&db_path);
  }
}