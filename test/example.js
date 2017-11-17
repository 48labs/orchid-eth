/* Example showing how to create and claim tickets

   * Install dependencies (see README) and verify with:
     `truffle compile && truffle test`

   * In the live app, the `Contracts` class will automatically
     setup connection to the live Ethereum chain

   * This example requires a localhost 'testrpc'
     (see README)

   * Some of the following dependences are only needed in this test
     (see code comments)

   * The first part of this example is test-specific setup code that,
     while informative, can be ignored for app-integration purposes
     - scroll down to the `c.transferData` call to see where to begin
*/

// Only these two imports are needed in app
var Accounts  = require('../lib/accounts/accounts.js');
var Contracts = require('../lib/contracts/contracts.js');

// Only for testing - not needed in app
var assert    = require('assert');
var BigNumber = require('bignumber.js');

const ledgerABI	   = require('../build/contracts/OCT.json').abi;
const ledgerBin	   = require('../build/contracts/OCT.json').bytecode;
const microPayABI = require('../build/contracts/MicroPay.json').abi;
const microPayBin = require('../build/contracts/MicroPay.json').bytecode;

describe('Example of ticket creation & claiming:', function () {
    it('Example', async () => {
	// TEST SETUP CODE

	// this assumes testrpc started as:
	// testrpc -d --network-id 10
	// to get deterministic test accounts (`testAcc` is the first account)
	// --network-id 10 is needed to workaround
	// https://github.com/ethereum/web3.js/issues/932 (wtf)

	const testAcc = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1';
	const testKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d';
	const password = 'foo'
	var a = new Accounts();
	a.setup(null, password);
	const relay  = a.newKey(password);
	const source = a.newKey(password);

	var c;
	try {
	    c = new Contracts();
	    const s = await c.web3.eth.isSyncing();
	} catch (e) {
	    assert.fail("Host unavailable/not working", c.endpoint,
			"Ethereum JSON-RPC: " + e + " (please check configured host)");
	    return;
	}

	// Deploy a test ledger and test microPay
	var l = new c.web3.eth.Contract(ledgerABI);
	var m = new c.web3.eth.Contract(microPayABI);
	var ledgerAddr;
	var microPayAddr;

	//var foo = await l.deploy({data: ledgerBin})
	//console.log("FUNKY: " + foo);
	await l.deploy({data: ledgerBin})
	    .send({from: testAcc, gas: 3000000, gasPrice: '0'})
	    .then(function(instance) {
		c.ledger = instance;
		c.ledgerAddr = instance.options.address;
		ledgerAddr = instance.options.address;
	    });

	await m.deploy({data: microPayBin, arguments: [ledgerAddr]})
	    .send({from: testAcc, gas: 3000000, gasPrice: '0'})
	    .then(function(instance) {
		c.microPay = instance;
		c.microPayAddr = instance.options.address;
		microPayAddr = instance.options.address;
	    });

	// Now we have ledger and microPay

	// Mint some MET:
	// since testAcc deployed the ledger it becomes "owner" and can mint
	var ten = c.web3.utils.toWei('10','ether'); // MET & ETH have same precision
	var one = c.web3.utils.toWei('1','ether');
	await c.mint(source.address, ten).send({from: testAcc}).then(function(res) {
	});

	// send ETH to source and relay so they can send txs
	const txRes0 = await c.web3.eth.sendTransaction(
	    {to: source.address, value: one, from: testAcc});
	const txRes1 = await c.web3.eth.sendTransaction(
	    {to: relay.address, value: one, from: testAcc});
	// verify
	const ETHBalSource = await c.web3.eth.getBalance(source.address);
	const ETHBalRelay = await c.web3.eth.getBalance(relay.address);
	assert.equal(ETHBalSource, one);
	assert.equal(ETHBalRelay, one);

	// The following is what should be integrated into the app
	// fund ticket deposit - goes through ledger API that calls microPay
	const txRes = await c.transferData(microPayAddr, one, "0x", source.privateKey);
	// verify
	const solvent = await c.isSolvent(source.address);
	assert.equal(solvent, true);

	// new ticket with source as creator
	var rand = 1;
	var randHash = c.web3.utils.soliditySha3(rand);
	var faceValue = c.web3.utils.toWei('0.1','ether');;
	// so we're guaranteed to win in this test
	var winProb = (new BigNumber(2)).pow(256).sub(1);

	var ticket = c.newTicket(randHash,
				 faceValue,
				 winProb,
				 relay.address,
				 source.address,
				 source.privateKey);
	//console.log("new ticket: " + JSON.stringify(ticket));

	// Off-chain validation
	var res;
	try {
	    res = await c.verifyTicket(ticket,
				       rand,
				       randHash,
				       faceValue,
				       winProb,
				       relay.address,
				       source.address);
	    //console.log("validateTicket: " + JSON.stringify(res));
	} catch (e) {
	    //console.log("validateTicket throw: " + JSON.stringify(e));
	}

	// On-chain validation & payout
	const claimTxRes = await c.claimTicket(ticket, rand, relay.privateKey);
	// verify
	const relayMETBal = await c.getMETBalance(relay.address).call();
	assert.equal(relayMETBal, faceValue);

	// withdraw before unlocking fails
	try {
	    await c.withdrawSenderFunds(source.privateKey).send({from: testAcc, gas: 3000000, gasPrice: '0'})
	    assert.fail('expected throw');
	} catch (e) {
	    assert.equal(e.message, 'Returned error: VM Exception while processing transaction: revert');
	}

	// unlock sender account
	const unlockTxRes = await c.unlockAccount(source.privateKey).send({from: testAcc, gas: 3000000, gasPrice: '0'});

	const seconds = 86401; // 1 day + 1
	c.web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [seconds], id: 0},
				    function(res) {});

	// withdraw sender's ticket account and penalty escrow
	const withdrawTxRes = await c.withdrawSenderFunds(source.privateKey).send({from: testAcc, gas: 3000000, gasPrice: '0'});

	// TODO: validate remaining ticket and ticket account invariants
    });
});
