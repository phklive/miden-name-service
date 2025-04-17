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
    address: String,
    version: String,
}

#[derive(Clone)]
pub struct AppState {
    pub tx: tokio::sync::mpsc::Sender<ClientRequest>,
    pub db: Arc<Database>,
}

// Request enum for different Client operations
#[derive(Debug)]
pub enum ClientRequest {
    Lookup {
        params: std::collections::HashMap<String, String>,
        respond: tokio::sync::oneshot::Sender<Result<String>>,
    },
    Register {
        params: std::collections::HashMap<String, String>,
        respond: tokio::sync::oneshot::Sender<Result<String>>,
    },
}

pub async fn register_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let name = params.get("name").cloned().unwrap_or_default();
    let address = params.get("address").cloned().unwrap_or_default();
    let version = params.get("version").cloned().unwrap_or_default();

    let user = User {
        name,
        address,
        version: version.clone(),
    };

    if user.name.is_empty() {
        return AppError::BadRequest("Name parameter is required".to_string()).into_response();
    }

    if user.address.is_empty() {
        return AppError::BadRequest("Address parameter is required".to_string()).into_response();
    }

    if version == "2" {
        // Save user to database
        if let Err(e) = state.db.insert_user(&user) {
            info!("Failed to save user: {}", e);
            return AppError::Database("Failed to save user to database".to_string())
                .into_response();
        };

        let res = format!(
            "Successfully registered: `{}` for `{}` using `{}`",
            user.address, user.name, user.version
        );

        return (StatusCode::OK, res).into_response();
    } else if version == "2.5" {
        let (tx, rx) = oneshot::channel();
        let request = ClientRequest::Register {
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
                Ok(response) => {
                    // No longer saving 2.5 users to the database
                    (StatusCode::OK, response).into_response()
                }
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
            Ok(address) => {
                info!("User found in smart contract: {} -> {}", name, address);

                // Create response with address and version
                let response = LookupResponse {
                    address,
                    version: "2.5".to_string(), // Smart contract users are Web2.5
                };

                (StatusCode::OK, Json(response)).into_response()
            }
            Err(err) => {
                info!("User not found in smart contract or lookup error");
                err.into_response()
            }
        },
        Err(_) => AppError::Internal("Failed to receive response".to_string()).into_response(),
    }
}
