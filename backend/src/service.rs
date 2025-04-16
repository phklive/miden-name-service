use std::collections::BTreeSet;

use log::info;
use miden_client::{
    Client, ONE,
    account::AccountId,
    transaction::{TransactionRequestBuilder, TransactionScript},
};
use miden_lib::transaction::TransactionKernel;
use miden_objects::vm::AdviceInputs;

use crate::{
    serde::{str_to_word, word_to_str},
    utils::{LOOKUP_SCRIPT, MNS_CONTRACT, REGISTER_SCRIPT, create_library},
};

pub async fn register(
    client: &mut Client,
    account_id: AccountId,
    name: String,
    address: String,
) -> String {
    // sync client to latest chain state
    let _ = client.sync_state().await.unwrap();

    // compile code
    let assembler = TransactionKernel::assembler().with_debug_mode(true);
    let component_lib =
        create_library(assembler.clone(), "mns::mns_contract", &MNS_CONTRACT).unwrap();

    // build inputs
    let felt_name = str_to_word(&name);
    let felt_account_id = str_to_word(&address);
    println!("name: {:?}, id: {:?}", felt_name, felt_account_id);
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
        assembler.with_library(&component_lib).unwrap(),
    )
    .unwrap();

    // Build transaction request
    let tx_request = TransactionRequestBuilder::new()
        .with_custom_script(tx_script)
        .build()
        .unwrap();

    // Execute transaction locally
    let tx_result = client
        .new_transaction(account_id, tx_request)
        .await
        .unwrap();

    // log out tx_id
    let tx_id = tx_result.executed_transaction().id();
    info!(
        "View transaction on MidenScan: https://testnet.midenscan.com/tx/{:?}",
        tx_id
    );

    // submit tx
    client.testing_apply_transaction(tx_result).await.unwrap();

    // submit tx
    // client.submit_transaction(tx_result).await.unwrap();

    format!("Register name: {name}, address: {address}")
}

pub async fn lookup(client: &mut Client, account_id: AccountId, name: String) -> String {
    // sync client to latest chain state
    let _ = client.sync_state().await.unwrap();

    // compile code
    let assembler = TransactionKernel::assembler().with_debug_mode(true);
    let component_lib =
        create_library(assembler.clone(), "mns::mns_contract", &MNS_CONTRACT).unwrap();

    // build inputs
    let felt_name = str_to_word(&name);
    let tx_script = TransactionScript::compile(
        LOOKUP_SCRIPT.clone(),
        [(
            [ONE, ONE, ONE, ONE],
            vec![felt_name[0], felt_name[1], felt_name[2], felt_name[3]],
        )],
        assembler.with_library(&component_lib).unwrap(),
    )
    .unwrap();

    // execute transaction locally
    let stack = client
        .execute_program(
            account_id,
            tx_script,
            AdviceInputs::default(),
            BTreeSet::default(),
        )
        .await
        .unwrap();

    println!("stack: {:?}", stack);

    let address = word_to_str([stack[3], stack[2], stack[1], stack[0]]);

    format!("{address}")
}
