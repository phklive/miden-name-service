use axum::Router;
use axum::routing::{get, put};
use log::info;
use std::sync::{Arc, Mutex};
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tower_http::cors::{Any, CorsLayer};

mod error;
mod handler;
mod serde;
mod service;
mod utils;

use handler::{AppState, ClientRequest, User, list_handler, lookup_handler, register_handler};
use utils::{create_account, create_client, remove_store};

#[tokio::main]
async fn main() {
    // Initialize logging
    env_logger::init();

    info!("Initializing MNS server");

    // Initialize client
    info!("Creating client");
    remove_store();

    // Create a new local task set to run a client that must run on the same thread
    let local = tokio::task::LocalSet::new();

    // Create channel for communication with the client
    let (tx, mut rx) = mpsc::channel(32);

    // Initial empty users vector with thread-safe wrapper
    let users = Arc::new(Mutex::new(Vec::<User>::new()));

    // Create application state
    let state = AppState { tx, users };

    // Create the router with all routes and middleware
    let app = Router::new()
        .route("/register", put(register_handler))
        .route("/lookup", get(lookup_handler))
        .route("/list", get(list_handler))
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    // Spawn a local task to handle client operations
    local.spawn_local(async move {
        let mut client = create_client().await;
        let account = create_account(&mut client).await;

        info!("Client initialized successfully");

        // Process client operations from the queue
        while let Some(request) = rx.recv().await {
            match request {
                ClientRequest::Lookup { params, respond } => {
                    let name = params.get("name").cloned().unwrap_or_default();
                    info!("Processing lookup request with name: {}", name);

                    let result = service::lookup(&mut client, account.id(), name).await;
                    if let Err(ref e) = result {
                        info!("Lookup error: {:?}", e);
                    }
                    let _ = respond.send(result);
                }
                ClientRequest::Register { params, respond } => {
                    let name = params.get("name").cloned().unwrap_or_default();
                    let address = params.get("address").cloned().unwrap_or_default();
                    info!(
                        "Processing register request with name: {} and address: {}",
                        name, address
                    );

                    let result =
                        service::register(&mut client, account.id(), name.clone(), address.clone())
                            .await;
                    if let Ok(_) = &result {
                        info!("Successfully registered {} with address {}", name, address);
                    } else if let Err(ref e) = result {
                        info!("Registration error: {:?}", e);
                    }
                    let _ = respond.send(result);
                }
            }
        }
    });

    // Run the LocalSet and the server concurrently
    let server = async {
        info!("Starting server on 0.0.0.0:3001");
        let listener = TcpListener::bind("0.0.0.0:3001").await.unwrap();
        info!("Server listening on 0.0.0.0:3001");
        axum::serve(listener, app).await.unwrap();
    };

    info!("Server initialized and ready to accept connections");
    local.run_until(server).await;
}
