/* Accounts unit tests
*/
/*
var Accounts  = require('../lib/accounts/accounts.js');

var assert = require('assert');
var BigNumber = require('bignumber.js');

describe('Accounts unit tests:', function () {
    // to account for multiple heavy KDF derivations
    this.timeout(5000);

    it('create, import, encrypt, decrypt, to/from JSON', async () => {
	// verify new random seed and importing it
	const passphrase = 'correct horse battery staple';

	var a0 = new Accounts();
	a0.setup(null, passphrase); // generates new random seed
	const seed = a0.getSeed(passphrase);

	var a1 = new Accounts();
	a1.setup(seed, passphrase);
	assert.equal(seed, a1.getSeed(passphrase));

	// verify both derive the same keys
	const keya0  = a0.newKey(passphrase);
	const keya1  = a1.newKey(passphrase);
	assert.equal(keya0.privateKey, keya1.privateKey);
	assert.equal(keya0.address,    keya1.address);

	// export & import as JSON
	const j = a0.toJSON();
	var a2 = new Accounts();
	a2.fromJSON(j);
	assert.notEqual(a2, false);
	assert.equal(seed, a2.getSeed(passphrase));

	// verify imported JSON generates same keys
	const keya2 = a2.getKey(passphrase, 0);
	assert.equal(keya2.privateKey, keya0.privateKey);
	assert.equal(keya2.address,    keya0.address);

	// verify wrong password fails decryption
	const wrongPass = 'foo';
	assert.equal(a0.getSeed(wrongPass), false)
	assert.equal(a0.newKey(wrongPass), false);
	assert.equal(a0.getKey(wrongPass, 0), false);
	assert.throws(function() { a0.getKey(wrongPass, 2); },
		      /index out of range/);

    });
});
*/
