# MESH Key Management

### Summary

The MESH protocol can be defined as a combination of P2P network protocols and a stateful, economic blockchain (Ethereum) protocol.

In the MESH Ethereum protocol (a set of MESH smart contracts) [public-key cryptography](https://en.wikipedia.org/wiki/Public-key_cryptography) is used for authentication of MESH nodes, including the end user (source node), router/relay nodes and exit nodes.

In the P2P network protocols, the same keys are used for both authentication and encryption.

This document details key generation, management and use in the MESH protocols, implementing clients and the flow for the end user.

The keys used for MESH nodes and MET accounts are of the same form as Ethereum keys and accounts. MET account addresses are indistinguishable from external Ethereum account addresses and the same address can hold both Ether and MET.

### Ethereum Keys

Ethereum uses [Elliptic Curve](https://en.wikipedia.org/wiki/Elliptic_curve_cryptography) keys using the [SECP256K1](https://en.bitcoin.it/wiki/Secp256k1) curve. This curve is also used in the Bitcoin and many other blockchain networks.

Signing is done with [ECDSA](https://en.wikipedia.org/wiki/Elliptic_Curve_Digital_Signature_Algorithm) similar to (but with some differences from) the [Bitcoin protocol](https://en.bitcoin.it/wiki/Protocol_documentation).

Account addresses in Ethereum are defined as [the rightmost 160 bits](https://ethereum.stackexchange.com/questions/3542/how-are-ethereum-addresses-generated) of the [KECCAK-256](https://ethereum.stackexchange.com/questions/550/which-cryptographic-hash-function-does-ethereum-use) (note: not the final FIPS-202 SHA3 spec) of the public key.

The [Ethereum protocol specification](gavwood.com/paper.pdf) defines ECDSA signing and address generation in detail.

### MESH Keys

Each MESH node have one or more keys used to identify and authenticate the node to other nodes and to MESH smart contracts. In the P2P network protocols, these keys are used for both authentication and for encryption.

For example, imagine an exit node **E** and a relay node **R**. When **R** connects to **E**, **R** can advertise a pubkey as well as a signature from the corresponding private key. **E** can verify the signature and then lookup the advertised pubkey in the MESH Ethereum state and see if it has staked MET.

If **E** confirms that **R** has staked MET, **E** can encrypt a message to **R** using **R's** pubkey with e.g. [ECIEC](https://en.wikipedia.org/wiki/Integrated_Encryption_Scheme)


### MESH HD Keys

To simplify key management for the end user, the MESH client generates a single [HD root key](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki) and encodes it as a [12-word mnemonic](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki) for offline backup.

The root HD key is used to derive child keys - the keys used to receive and spend MET as well as authenticate MET staking in MESH smart contracts.

Using HD keys vastly reduces key management complexity for both the user and the MESH client. The user only needs to backup a single 12-word phrase, and can restore all keys ever used from this backup.

The MESH client can discard the root key after deriving child keys from it. This ensures that if the user is compromised, the root key is not available and not all accounts are compromised. For example, a HD parent extended public key can be stored in plaintext in the MESH client to derive any number of new accounts to receive MET payments. Since the private keys for these accounts are not present, they cannot be obtained if the user is compromised.

Using [standard HD paths](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki) enables existing Ethereum and blockchain token wallets to easily integrate MET. The blockchain community maintains a [cross-network allocation of paths](https://github.com/satoshilabs/slips/blob/master/slip-0044.md). MET is tentatively allocated index 146.

-

![HD Keys](https://github.com/meshtoken/mesh-ethereum/blob/master/docs/MESH_HD_Keys.png)

