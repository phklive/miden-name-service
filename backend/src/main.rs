use axum::Router;
use axum::routing::{get, put};
use log::info;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tower_http::cors::{Any, CorsLayer};

mod handler;
use handler::{lookup_handler, register_handler};

mod utils;
use utils::{create_account, create_client, remove_store};

mod serde;

mod service;
use service::{lookup, register};

// Request enum for different Client operations
#[derive(Debug)]
enum ClientRequest {
    Lookup {
        params: std::collections::HashMap<String, String>,
        respond: tokio::sync::oneshot::Sender<String>,
    },
    Register {
        params: std::collections::HashMap<String, String>,
        respond: tokio::sync::oneshot::Sender<String>,
    },
}

#[tokio::main]
async fn main() {
    // Initialize logger
    env_logger::init();
    info!("Starting up");

    // Remove 'store.sqlite3' if it exists
    remove_store();

    // Create the client
    let mut client = create_client().await;

    // Create the mns account
    let account = create_account(&mut client).await;

    // Create a channel for client requests
    let (tx, mut rx) = mpsc::channel::<ClientRequest>(100);

    // Create a LocalSet for single-threaded tasks
    let local = tokio::task::LocalSet::new();

    // Spawn the client task in the LocalSet
    local.spawn_local(async move {
        while let Some(request) = rx.recv().await {
            match request {
                ClientRequest::Lookup { params, respond } => {
                    let name = params.get("name").cloned().unwrap_or_default();
                    info!("Lookup request with name: {name}");
                    let response = lookup(&mut client, account.id(), name).await;
                    let _ = respond.send(response);
                }
                ClientRequest::Register { params, respond } => {
                    let name = params.get("name").cloned().unwrap_or_default();
                    let address = params.get("address").cloned().unwrap_or_default();
                    info!("Register request with name: {name} and address: {address}");
                    let response = register(&mut client, account.id(), name, address).await;
                    let _ = respond.send(response);
                }
            }
        }
    });

    // Create the Axum router with the channel sender as state
    let app = Router::new()
        .route("/register", put(register_handler))
        .route("/lookup", get(lookup_handler))
        .with_state(Arc::new(tx))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    // Run the LocalSet and the server concurrently
    let server = async {
        let listener = TcpListener::bind("0.0.0.0:3001").await.unwrap();
        axum::serve(listener, app).await.unwrap();
    };

    local.run_until(server).await;
}
