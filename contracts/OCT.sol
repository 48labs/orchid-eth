pragma solidity ^0.4.11;

import './zeppelin/token/MintableToken.sol';
import './zeppelin/token/PausableToken.sol';

// WARNING: THIS IS UNSAFE, UNAUDITED PROTOTYPE CODE. DO NOT DEPLOY LIVE.

/* TODO:
 * More Tests
 * Internal Audit
 */

contract ContractReceiver {
  function tokenFallback(address _from, uint _value, bytes _data) public;
}

/**
 * @title OCT
 * @dev The Orchid Token (OCT) Ledger. Standard ERC20 Token, mintable before launch
 */
contract OCT is MintableToken {

  string public constant name = "Orchid Token";
  string public constant symbol = "OCT";
  uint8 public constant decimals = 18;

  uint256 public constant INITIAL_SUPPLY = 0;

  /**
   * @dev Contructor
   */
  function OCT() public {
    totalSupply = INITIAL_SUPPLY;
  }

  /* We need a way for the Orchid user application to transfer both OCT and data
     to the Mineshaft when funding accounts for ticket creation.

     ERC223 provides this functionality, but since ERC223 as currently defined
     actually breaks ERC20 backwards compatiblity by requiring contract
     recipients to implement `tokenFallback`

     This instead of implementing ERC223 we simply add functions for transfering
     both OCT and data, however we use the signature of the functions in ERC223
     in case this is useful for someone.

     This ensures this ledger remains 100% ERC20 compatible.
     For flexibility (and to reduce gas cost a bit for the Orchid user application)
     we provide transfer functions for both named and configurable recipient
     callbacks.

     truffle v3.4.9 (core: 3.4.8) has a bug wrt validation of argument count of
     overloaded functions: https://github.com/trufflesuite/truffle/issues/569
     when this is fixed we can rename these back to simply `transfer`
  */
  event TransferData(address indexed from, address indexed to, uint256 value, bytes data);

  function transferDataCustom(address _to, uint256 _value, bytes _data, string _custom_fallback) public returns (bool) {
    require(_to != address(0));

    // SafeMath.sub will throw if there is not enough balance.
    balances[msg.sender] = balances[msg.sender].sub(_value);
    balances[_to] = balances[_to].add(_value);

    // if clause is no-op; removes compiler warning as we're not using
    // the return value
    if(_to.call.value(0)(bytes4(keccak256(_custom_fallback)), msg.sender, _value, _data))

      //TransferData(msg.sender, _to, _value, _data);
    return true;
  }

  function transferData(address _to, uint256 _value, bytes _data) public returns (bool) {
    require(_to != address(0));

    // SafeMath.sub will throw if there is not enough balance.
    balances[msg.sender] = balances[msg.sender].sub(_value);
    balances[_to] = balances[_to].add(_value);

    ContractReceiver receiver = ContractReceiver(_to);
    receiver.tokenFallback(msg.sender, _value, _data);

    //TransferData(msg.sender, _to, _value, _data);
    return true;
  }

}
