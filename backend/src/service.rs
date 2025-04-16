use std::collections::BTreeSet;

use log::{error, info};
use miden_client::{
    Client, ONE,
    account::AccountId,
    transaction::{TransactionRequestBuilder, TransactionScript},
};
use miden_lib::transaction::TransactionKernel;
use miden_objects::vm::AdviceInputs;

use crate::{
    error::{AppError, Result},
    serde::{str_to_word, word_to_str},
    utils::{LOOKUP_SCRIPT, MNS_CONTRACT, REGISTER_SCRIPT, create_library},
};

pub async fn register(
    client: &mut Client,
    account_id: AccountId,
    name: String,
    address: String,
) -> Result<(String, String)> {
    // Input validation
    if name.is_empty() {
        return Err(AppError::BadRequest("Name cannot be empty".to_string()));
    }
    if address.is_empty() {
        return Err(AppError::BadRequest("Address cannot be empty".to_string()));
    }

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

    // build inputs
    let felt_name = str_to_word(&name);
    let felt_account_id = str_to_word(&address);
    info!("name: {:?}, id: {:?}", felt_name, felt_account_id);

    let tx_script = TransactionScript::compile(
        REGISTER_SCRIPT.clone(),
        [(
            [ONE, ONE, ONE, ONE],
            vec![
                felt_account_id[0],
                felt_account_id[1],
                felt_account_id[2],
                felt_account_id[3],
                felt_name[0],
                felt_name[1],
                felt_name[2],
                felt_name[3],
            ],
        )],
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
        .new_transaction(account_id, tx_request)
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

    // submit tx
    client
        .testing_apply_transaction(tx_result)
        .await
        .map_err(|e| {
            error!("Failed to apply transaction: {}", e);
            AppError::Internal(format!("Transaction submission failed: {}", e))
        })?;

    Ok((name, address))
}

pub async fn lookup(client: &mut Client, account_id: AccountId, name: String) -> Result<String> {
    // Input validation
    if name.is_empty() {
        return Err(AppError::BadRequest("Name cannot be empty".to_string()));
    }

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

    // build inputs
    let felt_name = str_to_word(&name);
    let tx_script = TransactionScript::compile(
        LOOKUP_SCRIPT.clone(),
        [(
            [ONE, ONE, ONE, ONE],
            vec![felt_name[0], felt_name[1], felt_name[2], felt_name[3]],
        )],
        assembler.with_library(&component_lib).map_err(|e| {
            error!("Failed to attach library: {}", e);
            AppError::Internal(format!("Script compilation error: {}", e))
        })?,
    )
    .map_err(|e| {
        error!("Failed to compile transaction script: {}", e);
        AppError::Internal(format!("Transaction script error: {}", e))
    })?;

    // execute transaction locally
    let stack = client
        .execute_program(
            account_id,
            tx_script,
            AdviceInputs::default(),
            BTreeSet::default(),
        )
        .await
        .map_err(|e| {
            error!("Failed to execute program: {}", e);
            AppError::Internal(format!("Program execution failed: {}", e))
        })?;

    if stack.len() < 4 {
        return Err(AppError::NotFound(format!(
            "Name '{}' not found or returned invalid data",
            name
        )));
    }

    info!("Stack after lookup: {:?}", stack);

    let address = word_to_str([stack[3], stack[2], stack[1], stack[0]]);

    // Check if address is empty or zero (indicating name not found)
    if address.trim().is_empty() || address == "0000000000000000" {
        return Err(AppError::NotFound(format!(
            "Name '{}' not registered",
            name
        )));
    }

    Ok(address)
}
