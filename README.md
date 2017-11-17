# Orchid Ethereum Protocol

This repo contains the Orchid Ethereum smart contract source code, a simple JS wrapper for interfacing with those contracts as well as assorted scripts and documentation.

The Orchid Protocol uses Ethereum for:
* Probablistic Micropayments (contracts/MicroPay.sol)
* The Orchid Token ERC20 Ledger (contracts/OCT.sol)
* Orchid Token Lockup (for Orchid Labs, founders and other stakeholders) (contracts/lockup.sol)

This is a truffle repository (see dependencies) and the Orchid smart contracts are written in solidity.

# Integration

## Orchid Token Ledger
* ERC20 (https://theethereum.wiki/w/index.php/ERC20_Token_Standard}) compatible, see contracts/OCT.sol

## Micropayments
* See test/example.js
* Note that creation and validation of micropayment tickets are done off-chain.  On-chain operations include funding the sender's ticket and penalty escrow accounts, claiming of tickets (enforces validation) and sender withdrawing their locked up tokens.

# Dependencies

* https://github.com/ethereumjs/testrpc (v6.0.3 (ganache-core: 2.0.2) or higher)
* https://github.com/trufflesuite/truffle (v4.0.1 with solidity v0.4.18 or higher)
* You may have to upgrade your nodejs version: https://github.com/trufflesuite/truffle/issues/479
  
# Build & Test

Dependencies:
```bash
npm install -g ethereumjs-testrpc
npm install -g truffle
```

Launch testrpc:
```bash
testrpc -d --network-id 42
```

In another terminal:
``` bash
cd orchid-eth
npm install
truffle compile && truffle test
```
(if solidity code is not changed 'truffle test' is enough)

# API

`TODO add when stable`
