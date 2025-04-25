export let mns_contract_string: string = `
use.miden::account

#! Deploys this contract (Placeholder fn enabling the deployment of this contract to the chain)
#! 
#! Inputs: []
#! Outputs: []
export.deploy
    push.0 drop
    # => []
end

#! Registers a name for a account_id
#! 
#! Inputs: []
#! Outputs: []
export.register
    # get inputs from advice provider
    adv.push_mapval adv_loadw swapw adv_loadw
    # => [NAME_WORD, ACCOUNT_ID]

    push.0
    # => [index, NAME_WORD, ACCOUNT_ID]

    exec.account::set_map_item dropw dropw
    # => []
end

#! Lookups an account id registered for the given name
#! 
#! Inputs: []
#! Outputs: [ACCOUNT_ID]
export.lookup
    # get inputs from advice provider
    adv.push_mapval adv_loadw 
    # => [NAME_WORD]

    push.0
    # => [index, NAME_WORD]

    exec.account::get_map_item
    # => [ACCOUNT_ID] 
end

#! Increments the nonce of the account
#!
#! Inputs: []
#! Outputs: []
export.increment_nonce
    push.1 exec.account::incr_nonce
    # => []
end

`;

export let register_script_string: string = `
use.mns::mns_contract

begin
    # register name for account_id
    call.mns_contract::register

    # increment nonce of mns account
    call.mns_contract::increment_nonce
end
`;

export let lookup_script_string: string = `
use.mns::mns_contract

begin
    # deploy mns contract to the miden chain
    call.mns_contract::deploy

    # increment nonce of mns account
    call.mns_contract::increment_nonce
end
`;
