use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Json},
};
use log::info;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;

use crate::error::{AppError, Result};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct User {
    pub name: String,
    pub address: String,
    pub version: u8,
}

#[derive(Clone)]
pub struct AppState {
    pub tx: tokio::sync::mpsc::Sender<ClientRequest>,
    pub users: Arc<Mutex<Vec<User>>>,
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
        respond: tokio::sync::oneshot::Sender<Result<(String, String)>>,
    },
}

pub async fn register_handler(
    State(state): State<AppState>,
    Query(params): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let name = params.get("name").cloned().unwrap_or_default();
    let address = params.get("address").cloned().unwrap_or_default();

    if name.is_empty() {
        return AppError::BadRequest("Name parameter is required".to_string()).into_response();
    }

    if address.is_empty() {
        return AppError::BadRequest("Address parameter is required".to_string()).into_response();
    }

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
                let (name, address) = response;
                let user = User {
                    name: name.clone(),
                    address: address.clone(),
                    version: 3,
                };

                // Safely mutate the shared state
                match state.users.lock() {
                    Ok(mut users) => {
                        info!("Adding user: {} with address: {}", name, address);
                        users.push(user);
                    }
                    Err(e) => {
                        info!("Failed to lock users mutex: {}", e);
                        return AppError::Internal("Failed to update user list".to_string())
                            .into_response();
                    }
                }

                let res = format!("Successfully registered: `{}` for `{}`", address, name);
                (StatusCode::OK, res).into_response()
            }
            Err(err) => err.into_response(),
        },
        Err(_) => AppError::Internal("Failed to receive response".to_string()).into_response(),
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
            Ok(response) => (StatusCode::OK, response).into_response(),
            Err(err) => err.into_response(),
        },
        Err(_) => AppError::Internal("Failed to receive response".to_string()).into_response(),
    }
}

pub async fn list_handler(State(state): State<AppState>) -> impl IntoResponse {
    // Get lock on the users vector
    match state.users.lock() {
        Ok(users) => {
            if users.is_empty() {
                info!("No users found");
                return (StatusCode::OK, Json(Vec::<User>::new())).into_response();
            }

            // Clone the users to avoid lock contention
            let users_clone = users.clone();
            info!("Returning {} users", users_clone.len());
            Json(users_clone).into_response()
        }
        Err(e) => {
            info!("Failed to lock users mutex: {}", e);
            AppError::Internal("Failed to access user list".to_string()).into_response()
        }
    }
}
