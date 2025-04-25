import { AccountId, WebClient } from "@demox-labs/miden-sdk";
import { lookup_script_string, register_script_string } from "./masm";

// const register_script = client.compileTxScript(register_script_string);

// const lookup_script = client.compileTxScript(lookup_script_string);

export async function log_contract() {
  const client = await WebClient.createClient();
  const contract_id_string = "0x5906718b4c532800000050157f4472";
  const contract_id = AccountId.fromHex(contract_id_string);
  await client.importAccountById(contract_id);
  const account = client.getAccount(contract_id);
  console.log(account);
}

// let tx = client.newTransaction();
// let builder = new TransactionRequestBuilder().withCustomScript();
