/*
// Specifically request an abstraction for Mineshaft
var METoken = artifacts.require("METoken");
var util = require('ethereumjs-util');
var BigNumber = require('bignumber.js');

contract('METoken', function(accounts) {
    it("METoken ledger contract", function() {
	var ledger;
	var minFund = web3.toWei('0.01', 'ether');

	var owner = accounts[0];
	//var num = (new BigNumber(2)).pow(256).sub(1);

	return METoken.deployed().then(function(instance) {
	    ledger = instance;

	    // Verify initial state
	    return ledger.totalSupply.call();
	}).then(function(res) {
	    assert.equal(res.valueOf(), 0, "METoken.totalSupply mismatch");

	    return ledger.owner.call();
	}).then(function(res) {
	    assert.equal(res, owner, "METoken.owner mismatch");

	    return ledger.name.call();
	}).then(function(res) {
	    assert.equal(res, "METoken", "METoken.name mismatch");

	    return ledger.symbol.call();
	}).then(function(res) {
	    assert.equal(res, "MET", "METoken.symbol mismatch");

	    return ledger.decimals.call();
	}).then(function(res) {
	    assert.equal(res.valueOf(), 18, "METoken.decimals mismatch");

	    // Verify minting
	    return ledger.mint(accounts[1], 42, {from: owner});
	}).then(function(res) {
	    assert.equal(res.logs[0].event, "Mint", "METoken.mint event mismatch");

	    return ledger.balanceOf.call(accounts[1]);
	}).then(function(res) {
	    assert.equal(res.valueOf(), 42, "METoken.balanceOf mismatch");

	    return ledger.totalSupply.call();
	}).then(function(res) {
	    assert.equal(res.valueOf(), 42, "METoken.totalSupply mismatch");

	    return ledger.mint(accounts[2], 100, {from: owner});
	}).then(function(res) {
	    assert.equal(res.logs[0].event, "Mint", "METoken.mint event mismatch");

	    return ledger.balanceOf.call(accounts[2]);
	}).then(function(res) {
	    assert.equal(res.valueOf(), 100, "METoken.balanceOf mismatch");

	    return ledger.totalSupply.call();
	}).then(function(res) {
	    assert.equal(res.valueOf(), 142, "METoken.totalSupply mismatch");

	    // Verify transfer
	    return ledger.transfer(accounts[3], 10, {from: accounts[2]});
	}).then(function(res) {
	    assert.equal(res.logs[0].event, "Transfer", "METoken.mint event mismatch");

	    return ledger.balanceOf.call(accounts[3]);
	}).then(function(res) {
	    assert.equal(res.valueOf(), 10, "METoken.balanceOf mismatch");

	    return ledger.totalSupply.call();
	}).then(function(res) {
	    assert.equal(res.valueOf(), 142, "METoken.totalSupply mismatch");

	    // See mineshaft.js for mineshaft test using METoken ledger
	});
    });
});
*/
