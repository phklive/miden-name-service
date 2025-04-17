use log::{error, info};
use rusqlite::{Connection, Error as SqliteError, Result as SqliteResult, params};
use std::path::Path;
use std::sync::{Arc, Mutex};

use crate::error::{AppError, Result};
use crate::handler::User;

/// Database manager for handling SQLite operations
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Initialize a new database connection and create tables if they don't exist
    pub fn new(db_path: impl AsRef<Path>) -> Result<Self> {
        let conn = match Connection::open(db_path) {
            Ok(conn) => conn,
            Err(e) => {
                error!("Failed to open database: {}", e);
                return Err(AppError::Database(format!(
                    "Failed to open database: {}",
                    e
                )));
            }
        };

        // Initialize the database with our schema
        match Self::init_db(&conn) {
            Ok(_) => {
                info!("Database schema initialized successfully");
                Ok(Self {
                    conn: Arc::new(Mutex::new(conn)),
                })
            }
            Err(e) => {
                error!("Failed to initialize database schema: {}", e);
                Err(AppError::Database(format!(
                    "Schema initialization failed: {}",
                    e
                )))
            }
        }
    }

    /// Create the necessary tables if they don't exist
    fn init_db(conn: &Connection) -> SqliteResult<()> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                address TEXT NOT NULL,
                version TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Create an index on the name for faster lookups
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_users_name ON users (name)",
            [],
        )?;

        Ok(())
    }

    /// Insert a new user or update an existing one
    pub fn insert_user(&self, user: &User) -> Result<()> {
        let conn = match self.conn.lock() {
            Ok(conn) => conn,
            Err(e) => {
                error!("Failed to acquire database lock: {}", e);
                return Err(AppError::Database(
                    "Failed to acquire database lock".to_string(),
                ));
            }
        };

        // Using INSERT OR REPLACE to handle both new insertions and updates
        match conn.execute(
            "INSERT OR REPLACE INTO users (name, address, version, updated_at) 
             VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)",
            params![user.name, user.address, user.version],
        ) {
            Ok(_) => {
                info!("User '{}' stored in database", user.name);
                Ok(())
            }
            Err(e) => {
                error!("Database error when saving user '{}': {}", user.name, e);
                Err(AppError::Database(format!("Failed to save user: {}", e)))
            }
        }
    }

    /// Lookup a user by name
    pub fn lookup_user(&self, name: &str) -> Result<Option<User>> {
        let conn = match self.conn.lock() {
            Ok(conn) => conn,
            Err(e) => {
                error!("Failed to acquire database lock: {}", e);
                return Err(AppError::Database(
                    "Failed to acquire database lock".to_string(),
                ));
            }
        };

        let mut stmt =
            match conn.prepare("SELECT name, address, version FROM users WHERE name = ?1") {
                Ok(stmt) => stmt,
                Err(e) => {
                    error!("Failed to prepare statement: {}", e);
                    return Err(AppError::Database(format!(
                        "Query preparation failed: {}",
                        e
                    )));
                }
            };

        let user_result = stmt.query_row(params![name], |row| {
            Ok(User {
                name: row.get(0)?,
                address: row.get(1)?,
                version: row.get(2)?,
            })
        });

        match user_result {
            Ok(user) => {
                info!("Found user '{}' in database", name);
                Ok(Some(user))
            }
            Err(SqliteError::QueryReturnedNoRows) => {
                info!("User '{}' not found in database", name);
                Ok(None)
            }
            Err(e) => {
                error!("Database error when looking up user '{}': {}", name, e);
                Err(AppError::Database(format!("Error looking up user: {}", e)))
            }
        }
    }
}
