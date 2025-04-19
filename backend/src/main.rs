use axum::Router;
use axum::routing::{get, put};
use clap::Parser;
use log::info;
use miden_client::account::AccountId;
use std::sync::Arc;
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tower_http::cors::{Any, CorsLayer};

mod db;
mod error;
mod handler;
mod serde;
mod service;
mod utils;

use db::Database;
use handler::{AppState, ClientRequest, lookup_handler, register_handler};
use utils::{create_account, create_client, deploy_account, remove_store};

const CONTRACT_ID: &str = "0xdde9bd696d7c6400000432b139e732";

/// Command line arguments for the MNS server
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Force deploy a new contract even if one already exists
    #[arg(short, long)]
    force_deploy: bool,
}

#[tokio::main]
async fn main() {
    // Parse command-line arguments
    let args = Args::parse();

    // Initialize logging
    env_logger::init();

    info!("Initializing MNS server");

    // sanitize
    remove_store();

    // Initialize the database
    let db_path = "users.sqlite3";
    let database = match Database::new(db_path) {
        Ok(db) => {
            info!("Database initialized successfully at {}", db_path);
            Arc::new(db)
        }
        Err(e) => {
            panic!("Failed to initialize database: {}", e);
        }
    };

    // Create a new local task set to run a client that must run on the same thread
    let local = tokio::task::LocalSet::new();

    // Create channel for communication with the client
    let (tx, mut rx) = mpsc::channel(32);

    // Create application state with database
    let state = AppState { tx, db: database };

    // Create the router with all routes and middleware
    let app = Router::new()
        .route("/register", put(register_handler))
        .route("/lookup", get(lookup_handler))
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    // Spawn a local task to handle client operations
    local.spawn_local(async move {
        info!("Creating client and deploying mns account");
        let mut client = create_client().await;
        let _ = client.sync_state().await.unwrap();
        let deployed_account_id = AccountId::from_hex(CONTRACT_ID).unwrap();

        // Check if we should force deploy a new contract
        let account = if args.force_deploy {
            info!("Forced deployment flag is set, deploying a new contract");
            let new_account = create_account(&mut client).await;
            let _ = deploy_account(&mut client, &new_account).await;
            info!("Client initialized and new MNS account deployed successfully");
            new_account
        } else {
            // Try to import existing account or create a new one
            match client.import_account_by_id(deployed_account_id).await {
                Ok(()) => {
                    // Successfully imported, now retrieve it
                    match client.get_account(deployed_account_id).await {
                        Ok(Some(account_record)) => {
                            info!("Successfully imported existing MNS contract account");
                            account_record.account().clone()
                        }
                        Ok(None) => {
                            panic!(
                                "Imported account from blockchain but it's not present in client"
                            )
                        }
                        Err(err) => panic!("Failed to retrieve imported account: {}", err),
                    }
                }
                Err(err) => {
                    // Account doesn't exist on chain, create and deploy a new one
                    info!("Account not found on chain: {}", err);
                    let new_account = create_account(&mut client).await;
                    let _ = deploy_account(&mut client, &new_account).await;
                    info!("Client initialized and MNS account deployed successfully");
                    new_account
                }
            }
        };

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
