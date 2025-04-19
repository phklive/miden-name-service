# Todo

## General

[x] Make analysis of other Name services:
    * Starknet: [Starknet ID](https://starknet.id/)
    * Solana: [SNS](https://www.sns.id/)
    * Ethereum: [ENS](https://app.ens.domains/)
    * Ethereum: [UD](https://unstoppabledomains.com/)
[ ] Deploy app
[ ] Add benchmarks (to see the difference in speed between the different implementations)
[ ] Add documentation in README.md in github
     
## Backend

[x] Prevent duplicates (if a user tries to register twice)
[x] Add web2 and web2.5 versions to backend
[x] Deploy smart contract on the blockchain (for now it's only updating the local state)
[x] Add database to store web2 data
[x] Only deploy smart contract if it does not exist, else use already deployed contract
[ ] Removes logs from different crates that i import
[ ] Fix backend error 
-> [2025-04-18T00:03:29Z ERROR name_service::error] Internal Server Error: Program execution failed: transaction executor error

## Frontend

[ ] Improve explanation of different implementations (+ add links to their components)
[x] Add diagrams from Excalidraw to explain interaction flow (user, frontend, server, blockchain)
[x] Add description / explanation of the app
[ ] Break down code into multiple components
[ ] Add Miden version that the app is using currently
[x] Add web3 version to frontend (Connect wallet to frontend and use TS client) -> Not possible now without public txs
