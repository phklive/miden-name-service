use lazy_static::lazy_static;
use log::{error, info};
use miden_assembly::{
    Assembler, DefaultSourceManager, LibraryPath,
    ast::{Module, ModuleKind},
};
use miden_client::{
    Client,
    account::{
        Account, AccountBuilder, AccountStorageMode, AccountType, StorageSlot,
        component::AccountComponent,
    },
    builder::ClientBuilder,
    rpc::{Endpoint, TonicRpcClient},
    transaction::{TransactionRequestBuilder, TransactionScript},
};
use miden_lib::transaction::TransactionKernel;
use rand::RngCore;
use std::{fs, path::Path, sync::Arc};

use crate::error::{AppError, Result};

lazy_static! {
    pub static ref MNS_CONTRACT: String = {
        let path = Path::new("masm/mns.masm");
        fs::read_to_string(path).unwrap()
    };
    pub static ref REGISTER_SCRIPT: String = {
        let path = Path::new("masm/register.masm");
        fs::read_to_string(path).unwrap()
    };
    pub static ref LOOKUP_SCRIPT: String = {
        let path = Path::new("masm/lookup.masm");
        fs::read_to_string(path).unwrap()
    };
    pub static ref DEPLOY_SCRIPT: String = {
        let path = Path::new("masm/deploy.masm");
        fs::read_to_string(path).unwrap()
    };
}

pub async fn create_client() -> Client {
    let endpoint = Endpoint::new(
        "https".to_string(),
        "rpc.testnet.miden.io".to_string(),
        Some(443),
    );
    let timeout_ms = 10_000;
    let rpc_api = Arc::new(TonicRpcClient::new(&endpoint, timeout_ms));
    let client = ClientBuilder::new()
        .with_rpc(rpc_api)
        .with_filesystem_keystore("./keystore")
        .in_debug_mode(true)
        .build()
        .await
        .unwrap();

    info!("Created client");

    client
}

pub fn create_library(
    assembler: Assembler,
    library_path: &str,
    source_code: &str,
) -> Result<miden_assembly::Library> {
    let source_manager = Arc::new(DefaultSourceManager::default());
    let module = Module::parser(ModuleKind::Library)
        .parse_str(
            LibraryPath::new(library_path)
                .map_err(|e| AppError::Internal(format!("Failed to create library: {}", e)))?,
            source_code,
            &source_manager,
        )
        .map_err(|e| {
            error!("Failed to create library: {}", e);
            AppError::Internal(format!("Contract compilation error: {}", e))
        })?;
    let library = assembler
        .clone()
        .assemble_library([module])
        .map_err(|e| AppError::Internal(format!("Failed to create library: {}", e)))?;

    Ok(library)
}

pub async fn create_account(client: &mut Client) -> Account {
    // compile code
    let assembler = TransactionKernel::assembler().with_debug_mode(true);
    let component = AccountComponent::compile(
        MNS_CONTRACT.clone(),
        assembler,
        vec![StorageSlot::empty_map()],
    )
    .unwrap()
    .with_supports_all_types();

    // seed and anchor block
    let mut seed = [0_u8; 32];
    client.rng().fill_bytes(&mut seed);
    let anchor_block = client.get_latest_epoch_block().await.unwrap();

    // build new account
    let (contract, seed) = AccountBuilder::new(seed)
        .anchor((&anchor_block).try_into().unwrap())
        .account_type(AccountType::RegularAccountImmutableCode)
        .storage_mode(AccountStorageMode::Public)
        .with_component(component.clone())
        .build()
        .unwrap();

    // add account to client
    client
        .add_account(&contract.clone(), Some(seed), false)
        .await
        .unwrap();

    info!("Created mns account");

    contract
}

pub async fn deploy_account(client: &mut Client, account: &Account) -> Result<()> {
    // sync client to latest chain state
    client.sync_state().await.map_err(|e| {
        error!("Failed to sync client state: {}", e);
        AppError::Internal(format!("Failed to sync blockchain state: {}", e))
    })?;

    // compile code
    let assembler = TransactionKernel::assembler().with_debug_mode(true);
    let component_lib = create_library(assembler.clone(), "mns::mns_contract", &MNS_CONTRACT)
        .map_err(|e| {
            error!("Failed to create library: {}", e);
            AppError::Internal(format!("Contract compilation error: {}", e))
        })?;

    // build script
    let tx_script = TransactionScript::compile(
        DEPLOY_SCRIPT.clone(),
        [],
        assembler.with_library(&component_lib).map_err(|e| {
            error!("Failed to attach library: {}", e);
            AppError::Internal(format!("Script compilation error: {}", e))
        })?,
    )
    .map_err(|e| {
        error!("Failed to compile transaction script: {}", e);
        AppError::Internal(format!("Transaction script error: {}", e))
    })?;

    // Build transaction request
    let tx_request = TransactionRequestBuilder::new()
        .with_custom_script(tx_script)
        .build()
        .map_err(|e| {
            error!("Failed to build transaction request: {}", e);
            AppError::Internal(format!("Transaction request error: {}", e))
        })?;

    // Execute transaction locally
    let tx_result = client
        .new_transaction(account.id(), tx_request)
        .await
        .map_err(|e| {
            error!("Failed to execute transaction: {}", e);
            AppError::Internal(format!("Transaction execution failed: {}", e))
        })?;

    // log out tx_id
    let tx_id = tx_result.executed_transaction().id();
    info!(
        "View transaction on MidenScan: https://testnet.midenscan.com/tx/{:?}",
        tx_id
    );

    // log out info about the contract
    info!("contract commitment: {:?}", account.commitment());
    info!("contract id: {:?}", account.id().to_hex());
    info!("contract storage: {:?}", account.storage());

    // submit tx
    client.submit_transaction(tx_result).await.map_err(|e| {
        error!("Failed to submit transaction: {}", e);
        AppError::Internal(format!("Transaction submission failed: {}", e))
    })?;

    info!("Successfully deployed mns account");

    Ok(())
}

pub fn remove_store() {
    let file_path = "store.sqlite3";

    // Check if the file exists
    if Path::new(file_path).exists() {
        // Attempt to remove the file
        match fs::remove_file(file_path) {
            Ok(_) => println!("The file {} has been removed.", file_path),
            Err(e) => println!("Error removing the file {}: {}", file_path, e),
        }
    } else {
        println!("The file {} does not exist.", file_path);
    }
}
