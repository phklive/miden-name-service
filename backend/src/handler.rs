use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use log::info;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::oneshot;

use crate::db::Database;
use crate::error::{AppError, Result};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct User {
    pub name: String,
    pub address: String,
    pub version: String,
}

#[derive(Serialize)]
pub struct LookupResponse {
    pub address: String,
    pub version: String,
}

#[derive(Serialize)]
pub struct RegisterResponse {
    pub name: String,
    pub address: String,
    pub version: String,
    pub transaction_id: Option<String>,
}

#[derive(Clone)]
pub struct AppState {
    pub tx: tokio::sync::mpsc::Sender<ClientRequest>,
    pub db: Arc<Database>,
}

// Request enum for different Client operations
pub enum ClientRequest {
    Lookup {
        params: std::collections::HashMap<String, String>,
        respond: tokio::sync::oneshot::Sender<Result<LookupResponse>>,
    },
    Register {
        params: std::collections::HashMap<String, String>,
        respond: tokio::sync::oneshot::Sender<Result<RegisterResponse>>,
    },
}

pub async fn register_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let name = params.get("name").cloned().unwrap_or_default();
    let address = params.get("address").cloned().unwrap_or_default();
    let version = params.get("version").cloned().unwrap_or_default();

    if name.is_empty() {
        return AppError::BadRequest("Name parameter is required".to_string()).into_response();
    }

    if address.is_empty() {
        return AppError::BadRequest("Address parameter is required".to_string()).into_response();
    }

    if version.is_empty() {
        return AppError::BadRequest("Version parameter is required".to_string()).into_response();
    }

    // Check if user already exists in database
    if let Ok(Some(_)) = state.db.lookup_user(&name) {
        info!(
            "Failed to register user: {} user has already been registered in database.",
            name
        );
        return AppError::Database("User has already been registered.".to_string()).into_response();
    }

    let (tx, rx) = oneshot::channel();
    let request = ClientRequest::Lookup {
        params: params.clone(),
        respond: tx,
    };

    // Send lookup request to check if user exists in smart contract
    if let Ok(_) = state.tx.send(request).await {
        // Wait for the response
        if let Ok(Ok(_)) = rx.await {
            // User exists in smart contract
            info!(
                "Failed to register user: {} user has already been registered in smart contract.",
                name
            );
            return AppError::Database("User has already been registered.".to_string())
                .into_response();
        }
    }

    if version == "2" {
        // Instantiate User
        let user = User {
            name: name.clone(),
            address: address.clone(),
            version: version.clone(),
        };

        // Save user to database
        if let Err(e) = state.db.insert_user(&user) {
            info!("Failed to save user: {}", e);
            return AppError::Database("Failed to save user to database".to_string())
                .into_response();
        };

        let response = RegisterResponse {
            name: user.name,
            address: user.address,
            version: user.version,
            transaction_id: None,
        };

        return (StatusCode::OK, Json(response)).into_response();
    } else if version == "2.5" {
        let (tx, rx) = oneshot::channel();

        let request = ClientRequest::Register {
            params: params.clone(),
            respond: tx,
        };

        // Send the request to the client handler
        if let Err(_) = state.tx.send(request).await {
            return AppError::Internal("Failed to process request".to_string()).into_response();
        }

        // Wait for the response
        match rx.await {
            Ok(result) => match result {
                Ok(response) => (StatusCode::OK, Json(response)).into_response(),
                Err(err) => err.into_response(),
            },
            Err(_) => AppError::Internal("Failed to receive response".to_string()).into_response(),
        }
    } else {
        return AppError::BadRequest(
            "The server can only process Web2 or Web2.5 requests".to_string(),
        )
        .into_response();
    }
}

pub async fn lookup_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let name = params.get("name").cloned().unwrap_or_default();

    if name.is_empty() {
        return AppError::BadRequest("Name parameter is required".to_string()).into_response();
    }

    // First, check in the database
    info!("Looking up user '{}' in database", name);
    match state.db.lookup_user(&name) {
        Ok(Some(user)) => {
            info!(
                "User found in database: {} -> {} (version {})",
                user.name, user.address, user.version
            );

            let response = LookupResponse {
                address: user.address,
                version: user.version,
            };

            return (StatusCode::OK, Json(response)).into_response();
        }
        Ok(None) => {
            info!(
                "User '{}' not found in database, checking smart contract",
                name
            );
            // User not in database, continue to smart contract check
        }
        Err(e) => {
            // Log the database error but continue to smart contract
            info!("Database error during lookup: {}, trying smart contract", e);
        }
    }

    // If we reach here, check the smart contract
    info!("Checking smart contract for user '{}'", name);
    let (tx, rx) = oneshot::channel();
    let request = ClientRequest::Lookup {
        params,
        respond: tx,
    };

    // Send the request to the client handler
    if let Err(_) = state.tx.send(request).await {
        return AppError::Internal("Failed to process request".to_string()).into_response();
    }

    // Wait for the response
    match rx.await {
        Ok(result) => match result {
            Ok(response) => (StatusCode::OK, Json(response)).into_response(),
            Err(err) => {
                info!("User not found in smart contract or lookup error");
                err.into_response()
            }
        },
        Err(_) => AppError::Internal("Failed to receive response".to_string()).into_response(),
    }
}
