use axum::{
    extract::{Query, State},
    response::{IntoResponse, Response},
};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::sync::oneshot;

use crate::ClientRequest;

pub async fn lookup_handler(
    State(tx): State<Arc<mpsc::Sender<ClientRequest>>>,
    Query(params): Query<HashMap<String, String>>,
) -> Response {
    // Create a oneshot channel for the response
    let (respond, recv) = oneshot::channel();

    // Send the lookup request
    let request = ClientRequest::Lookup { params, respond };
    if tx.send(request).await.is_err() {
        return "Internal server error".to_string().into_response();
    }

    // Await the response
    match recv.await {
        Ok(result) => result.into_response(),
        Err(_) => "Internal server error".to_string().into_response(),
    }
}

pub async fn register_handler(
    State(tx): State<Arc<mpsc::Sender<ClientRequest>>>,
    Query(params): Query<HashMap<String, String>>,
) -> Response {
    // Create a oneshot channel for the response
    let (respond, recv) = oneshot::channel();

    // Send the register request
    let request = ClientRequest::Register { params, respond };
    if tx.send(request).await.is_err() {
        return "Internal server error".to_string().into_response();
    }

    // Await the response
    match recv.await {
        Ok(result) => result.into_response(),
        Err(_) => "Internal server error".to_string().into_response(),
    }
}
