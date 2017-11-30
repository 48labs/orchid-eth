var buffer = require('buffer');
var crypto = require('crypto');
var web3 = require('web3');
var ethjsAccount = require('ethjs-account');
var signer = require('ethjs-signer');
var BigNumber = require('bignumber.js');

const ledgerABI    = require('../../build/contracts/OCT.json').abi;
const microPayABI = require('../../build/contracts/MicroPay.json').abi;

'use strict';

const infuria = "https://mainnet.infura.io:8545"
const localhost = "http://localhost:8545"
const testnet = ""

const unlockHash = web3.utils.soliditySha3("The Net treats censorship as a defect and routes around it.");
const withdrawHash = web3.utils.soliditySha3("Surveillance breeds conformity");

function Contracts() {
    this.endpoint = localhost;
    this.web3 = new web3(localhost);
    //console.log("contracts web3 version: " + this.web3.version);
    // TODO: set these after live deployment:
    // this.ledger   = new this.web3.eth.Contract(ledgerABI,    '0x..live..addr..');
    // this.microPay = new this.web3.eth.Contract(microPayABI, '0x..live..addr..');
    return;
}

/* See: https://web3js.readthedocs.io/en/1.0/web3-eth-contract.html#id12

   API returns contract methods which can be locally called (read-only from local state) or transacted (live tx causing state change).
   Calls and txs both support callback and promises
 */

// Orchid higher-level API abstracting the underlying smart contract API
Contracts.prototype.newTicket = function(randHash, faceValue, winProb, recipientAddr, creatorAddr, creatorPrivkey) {
    // TODO: confirm with Jay what reqs we have on nonce other than uniquness
    // TODO: fix type - don't use JS number
    var nonce = crypto.randomBytes(6).readUIntBE(0, 6);
    var nonceHex = this.web3.utils.toHex(nonce);

    var randHashAndRecipient = randHash.concat(recipientAddr.slice(2).toLowerCase());

    const hash = this.web3.utils.soliditySha3(randHashAndRecipient,
					      faceValue,
					      winProb,
					      nonce);
    const sig = this.web3.eth.accounts.signRaw(hash, creatorPrivkey);

    // TODO: encoding
    return {randHash: randHash,
	    recipient: recipientAddr,
	    faceValue: faceValue,
	    winProb: "0x" + winProb.toString(16),
	    nonce: nonceHex,
	    msgHash: sig.messageHash,
	    creatorAddr: creatorAddr,
	    creatorSig: {v:sig.v, r:sig.r, s:sig.s}
	   }
}

// Takes as input ticket object returned from above newTicket API
Contracts.prototype.verifyTicket = function(ticket,
					    randNum,
					    expectedRandHash,
					    expectedValue, expectedWinProb,
					    expectedRecipient, expectedCreator) {
    return new Promise((resolve, reject) => {
    try {
	this.doVerifyTicket(ticket,
			    randNum,
			    expectedRandHash,
			    expectedValue, expectedWinProb,
			    expectedRecipient, expectedCreator,
			    resolve, reject);
    }
	catch (e) {
	    var e = err("throw", "no throw", e);
	    reject({valid: false, error: e});
	}
    });
}

Contracts.prototype.doVerifyTicket = function(ticket,
					      randNum,
					      expectedRandHash,
					      expectedValue, expectedWinProb,
					      expectedRecipient, expectedCreator,
					      resolve, reject) {
    // TODO: type validation / refactor to typescript
    // Internal consistency: check that caller passed correct randNum
    var randHash = this.web3.utils.soliditySha3(randNum)
    if (randHash != expectedRandHash) {
	var e = err("caller random number hash mismatch", expectedRandHash, randHash);
	reject({valid:false, win: false, error: e});
    }

    // First we validate that ticket values (from source node)
    // match what we (relay or proxy) expect
    if (expectedRandHash != ticket.randHash) {
	var e = err("ticket creator random number hash mismatch", expectedRandHash, ticket.randHash);
	reject({valid:false, win: false, error: e});
    }
    if (expectedValue > ticket.faceValue) {
	var e = err("face value too small", expectedValue, ticket.faceValue);
	reject({valid:false, win: false, error: e});
    }
    var ticketWinProb = new BigNumber(ticket.winProb, 16);
    if (expectedWinProb.gt(ticketWinProb)) {
	var e = err("winning probability too small", expectedWinProb, ticketWinProb);
	reject({valid:false, win: false, error: e});
    }
    if (expectedRecipient != ticket.recipient) {
	var e = err("recipient mismatch", expectedRecipient, ticket.recipient);
	reject({valid:false, win: false, error: e});
    }
    if (expectedCreator != ticket.creatorAddr) {
	var e = err("creator mismatch", expectedCreator, ticket.creatorAddr);
	reject({valid:false, win: false, error: e});
    }

    // Next, we validate ticket invariants. We do this through
    // MicroPay.validateTicket (local read-only call to smart contract)
    // but since the smart contract (to optimize for gas) does not return
    // error messages, we first verify the same invariants in JS so we can
    // return informative errors to caller

    // validate the ticket creator's signature
    var sigAddr = this.web3.eth.accounts.recover(ticket.msgHash,
						 ticket.creatorSig.v,
						 ticket.creatorSig.r,
						 ticket.creatorSig.s);
    if (expectedCreator != sigAddr) {
	var e = err("ECDSA recover mismatch on creator signature", expectedCreator, sigAddr);
	reject({valid:false, win: false, error: e});
    }
    var creator = expectedCreator;

    var minFund = this.web3.utils.toWei('0.01', 'ether');
    var c = this;
    this.getOCTBalance(creator).call().then(function(res) {
	if ((new BigNumber(res)).lt(minFund)) {
	    var e = err("creator OCT balance", minFund, res);
	    reject({valid:false, win: false, error: e});
	}

	// Last, we verify if the ticket is a winning one
	var bigNumHash = new BigNumber(c.web3.utils.soliditySha3(ticket.msgHash, randNum), 16);
	if (bigNumHash.lte(ticketWinProb)) {
	    // ticket is valid and winning
	    resolve({valid:true, win: true, error: null});
	}

	// Ticket is valid but not winning
	reject({valid: true, win: false, error: null});

    });
}

// Takes as input ticket object returned from above newTicket API
Contracts.prototype.claimTicket = function(ticket, randNum, recipientPrivkey) {
    var c = this;
    // TODO: error handling
    return new Promise((resolve, reject) => {
	// See signing code in `newTicket`
	const randHashAndRecipient = ticket.randHash.concat(ticket.recipient.slice(2).toLowerCase());
	const hash = c.web3.utils.soliditySha3(randHashAndRecipient,
					       ticket.faceValue,
					       new BigNumber(ticket.winProb),
					       c.web3.utils.hexToNumber(ticket.nonce));
	const sig = c.web3.eth.accounts.signRaw(hash, recipientPrivkey);
	const abi = c.doClaimTicket(randNum,
				    ticket.randHash,
				    ticket.nonce,
				    ticket.faceValue,
				    ticket.winProb,
				    ticket.recipient,
				    ticket.creatorSig.v,
				    ticket.creatorSig.r,
				    ticket.creatorSig.s,
				    sig.v,
				    sig.r,
				    sig.s).encodeABI();
	c.web3.eth.accounts.signTransaction(
	    // TODO: verify max gas needed
	    {to: c.microPayAddr, data: abi, gas: 100000},
	    // TODO: check which key is actually sending this tx
	    recipientPrivkey).then(function(signedTx) {
		c.web3.eth.sendSignedTransaction(signedTx.rawTransaction).then(function(res) {
		    resolve(res);
		});
	    });
    });
}

// OCT API
Contracts.prototype.getOCTBalance = function(addr) {
    return this.ledger.methods.balanceOf(addr);
}

Contracts.prototype.transfer = function(toAddr, amount) {
    return this.ledger.methods.transfer(toAddr, amount);
}

Contracts.prototype.transferData = function(toAddr, amount, data, privKey) {
    // TODO: error handling
    var c = this;
    return new Promise((resolve, reject) => {
	const abi = c.ledger.methods.transferData(toAddr, amount, data).encodeABI();
	// TODO: verify max gas cost and adjust gas
	c.web3.eth.accounts.signTransaction(
	    {to: c.ledgerAddr, data: abi, gas: 100000}, privKey).then(function(signedTx) {
		c.web3.eth.sendSignedTransaction(signedTx.rawTransaction).then(function(res) {
		    resolve(res);
		});
	    });
    });
}

Contracts.prototype.transferFrom = function(fromAddr, amount) {
    return this.ledger.methods.transferFrom(fromAddr, amount);
}

Contracts.prototype.allowance = function(ownerAddr, spenderAddr) {
    return this.ledger.methods.allowance(ownerAddr, spenderAddr);
}

Contracts.prototype.approve = function(spenderAddr, amount) {
    return this.ledger.methods.approve(spenderAddr, amount);
}

// For testing; in the live ledger this API is authenticated and
// only enabled prior to and during the token sale
Contracts.prototype.mint = function(toAddr, amount) {
    return this.ledger.methods.mint(toAddr, amount);
}

Contracts.prototype.finishMinting = function() {
    return this.ledger.methods.finishMinting();
}

// MicroPay API
Contracts.prototype.fundTicketCreation = function(amount) {
    return this.microPay.methods.fundTicketCreation(amount);
}

Contracts.prototype.doClaimTicket = function(randNum, randHash,
					   nonce, faceValue, winProb, recipient,
					     v1, r1, s1, v2, r2, s2) {
    return this.microPay.methods.claimTicket(randNum, randHash,
					      nonce, faceValue, winProb, recipient,
					      v1, r1, s1, v2, r2, s2);
}

Contracts.prototype.validateTicket = function(randNum, randHash,
					      nonce, faceValue, winProb, recipient,
					      v1, r1, s1, v2, r2, s2) {
    return this.microPay.methods.validateTicket(randNum, randHash,
						 nonce, faceValue, winProb, recipient,
						 v1, r1, s1, v2, r2, s2);
}

Contracts.prototype.unlockAccount = function(creatorPrivkey) {
    const sig = this.web3.eth.accounts.signRaw(unlockHash, creatorPrivkey);
    return this.microPay.methods.unlockAccount(sig.v, sig.r, sig.s);
}

Contracts.prototype.withdrawSenderFunds = function(creatorPrivkey) {
    const sig = this.web3.eth.accounts.signRaw(withdrawHash, creatorPrivkey);
    return this.microPay.methods.withdrawSenderFunds(sig.v, sig.r, sig.s);
}

Contracts.prototype.isLocked = function(addr) {
    return this.microPay.methods.isLocked(addr).call();
}

Contracts.prototype.isSolvent = function(addr) {
    return this.microPay.methods.isSolvent(addr).call();
}

// Utils
Contracts.prototype.syncStatus = function() {
    return this.web3.eth.isSyncing();
}

Contracts.prototype.getETHBalance = function(addr) {
    return this.web3.eth.getBalance(addr);
}

function err(error, expected, actual) {
    return error + ": Expected: " + expected + " Got: " + actual;
}

module.exports = Contracts;
