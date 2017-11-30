var buffer = require('buffer');
var crypto = require("crypto");
var keythereum = require("keythereum");
var bitcore = require('bitcore-lib');
var mnemonic = require('bitcore-mnemonic');
var ethjsAccount = require('ethjs-account');
var signer = require('ethjs-signer');
var web3 = require('web3');

'use strict';

// TODO: verify that 147 is free before launch
// https://github.com/satoshilabs/slips/blob/master/slip-0044.md
// single quote == hardened derivation
//const HDPathTokenSale = "m/44'/147'/0'";
//const HDPathCold      = "m/44'/147'/1'";
const HDPath       = "m/44'/147'/2'";

function Accounts() {
    this.web3 = new web3();
    return;
}

Accounts.prototype.new = function() {
    return new Accounts();
}

// TODO: types, better arg error handling
Accounts.prototype.setup = function(seedArg, pass) {
    if (!isString(pass)) {
	throw "passphrase must be string";
    }
    var seed;
    if (mnemonic.isValid(seedArg, mnemonic.Words.ENGLISH)) {
	seed = seedArg;
    } else if (seedArg == null) {
	seed = newSeed();
    } else {
	throw "Argument must be null or a valid seed";
    }

    var code = new mnemonic(seed);
    var masterKey = code.toHDPrivateKey();

    // bitcore-lib HDPrivateKey.derive is deprecated, see:
    // https://github.com/bitpay/bitcore-lib/blob/master/lib/hdprivatekey.js#L129
    var root  = masterKey.deriveChild(HDPath, true);

    this.seed = encrypt(seed, pass);
    this.xpriv = encrypt(root.xprivkey, pass);
    this.addrs = [];

    this.newKey(pass);
    return;
}

Accounts.prototype.newKey = function(pass) {
    const newAcc = this.getKey(pass, this.addrs.length);
    if (newAcc == false) {
	return false;
    }
    this.addrs.push(newAcc.address);
    return newAcc;
}

Accounts.prototype.getKey = function(pass, index) {
    if (index > this.addrs.length) { // TODO: should be >= except for newKey
	throw "index out of range";
    }
    const pt = decrypt(this.xpriv, pass);
    if (pt == false) {
	return false;
    }
    const root = new bitcore.HDPrivateKey(pt);
    const newChild = root.deriveChild(index, false);
    return HDPrivToAcc(newChild);
}

/*
Accounts.prototype.newColdAddress = function() {
    var pub = new bitcore.HDPublicKey(this.xpubCold);
    var newChild = pub.deriveChild(this.addrsCold.length, false);
    this.addrsCold.push(HDKeyToAddr(newChild));
    return null;
}

Accounts.prototype.newAddress = function() {
    var priv = new bitcore.HDPrivateKey(this.xpriv);
    var newChild = priv.deriveChild(this.addrs.length, false);
    this.addrs.push(HDKeyToAddr(newChild));
    return null;
}
*/

Accounts.prototype.getSeed = function(pass) {
    return decrypt(this.seed, pass);
}

Accounts.prototype.toJSON = function() {
    const seed = this.seed;
    const xpriv = this.xpriv;
    const addrs = this.addrs;
    return JSON.stringify({seed, xpriv, addrs});
}

Accounts.prototype.fromJSON = function(jsonString) {
    try {
        var o = JSON.parse(jsonString);

        // Handle non-exception-throwing cases:
        // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
        // but... JSON.parse(null) returns null, and typeof null === "object",
        // so we must check for that, too. Thankfully, null is falsey, so this suffices:
        if (o && typeof o === "object") {
	    var a = new Accounts();
	    this.seed = o.seed;
	    this.xpriv = o.xpriv;
	    this.addrs = o.addrs;
            return a;
        } else {
	    throw "could not parse: " + o;
	}
    }
    catch (e) {
	throw "invalid JSON" + e;
    }

    return false;
}

Accounts.prototype.isValidSeed = function(str) {
    return mnemonic.isValid(str, mnemonic.Words.ENGLISH);
}

function newSeed(locale) {
    // TODO: support non-English, bitcore.mnemonic supports more languages:
    // https://github.com/bitpay/bitcore-mnemonic/tree/master/lib/words
    // and we can add word lists for more
    var code = new mnemonic(mnemonic.Words.ENGLISH);
    return code.toString();
}

function HDKeyToAddr(key) {
    var pubBuf = new Buffer(key.toObject().publicKey, 'hex');
    return ethjsAccount.publicToAddress(pubBuf);
}

function HDPrivToAcc(key) {
    return ethjsAccount.privateToAccount(padPrivkey(key.toObject().privateKey));
}

function padPrivkey(privHex) {
    return ("0000000000000000" + privHex).slice(-64);
}

function isString(x) {
    return Object.prototype.toString.call(x) === "[object String]"
}

function encrypt(msg, pass) {
    /*
     Don't panic, we're not rolling our own crypto. Encryption is based on:
     https:github.com/ethereum/wiki/wiki/Web3-Secret-Storage-Definition
     using it's default parameters for version 3:
     * KDF: scrypt with N = 1^18, P = 1, N = 1^12
     * Cipher: AES-128-CTR
     * MAC: KECCAK-256(enryptionKey, cipherText)

     However, We omit fields used in this spec that we do not need,
     as we have no need to be key-by-key compatible with other wallets:

     Since we're using HD keys derived from a single seed using standardized
     BIP44 paths, the user can simply export the root seed and import it
     if they ever want to use the mesh app keys in another wallet such as
     myetherwallet, jaxx or other wallets supporting Ethereum-based tokens
     on BIP44 paths.

     Also since we're encrypting not only individual private keys here but also
     the root seed it would be a bit hacky to use only APIs for this key spec.

     However, we strive to derive these values as much as we can using the
     keythereum lib API, which implements the full spec.

     We only store the ciphertext, MAC, IV and salt for each key (and the seed)
     in this account object. Keys and the seed are decrypted on-demand.
    */

    // TODO: use scrypt light params
    //const opts = {kdf: "scrypt"};
    const iv   = crypto.randomBytes(16);
    const salt = crypto.randomBytes(32);
    const dk   = keythereum.deriveKey(pass, salt);
    const ct   = keythereum.encrypt(msg, dk.slice(0, 16), iv);
    const mac  = keythereum.getMAC(dk, ct);

    return {ct: ct.toString('hex'),
	    mac: mac,
	    iv: iv.toString('hex'),
	    salt: salt.toString('hex')};
}

function decrypt(enc, pass) {
    //const opts = {kdf: "scrypt"};
    const ct = Buffer.from(enc.ct, 'hex');
    const iv = Buffer.from(enc.iv, 'hex');
    const salt = Buffer.from(enc.salt, 'hex');

    const dk = keythereum.deriveKey(pass, salt);

    if (keythereum.getMAC(dk, ct) != enc.mac) {
	return false;
	//throw "decryption MAC mismatch";
    }

    const pt = keythereum.decrypt(ct, dk.slice(0, 16), iv);
    return pt.toString();
}

// exports
module.exports = Accounts;
