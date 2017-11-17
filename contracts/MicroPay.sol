//pragma experimental "v0.5.0";
pragma solidity ^0.4.18;

import './zeppelin/token/ERC20.sol';

/*
   WARNING: THIS IS UNAUDITED PROTOTYPE CODE. DO NOT DEPLOY LIVE.
   THIS CODE IS FOR TESTING PURPOSES ONLY AND NEEDS ADDITIONAL
   WORK BEFORE SUITABLE FOR PRODUCTION SYSTEMS.

   @title Orchid Payment Smart Contract
   @author Gustav Simonsson <gustav@orchidprotocol.com>

   This contract implements the Orchid Probablistic payment scheme as detailed
   in section 7.12 of the Orchid whitepaper available at:
   https://orchidprotocol.com/whitepaper.pdf

*/

contract MicroPay {

  struct TicketClaim {
    uint rand;
    bytes32 randHash;
    uint nonce;
    uint faceValue;
    uint winProb;
    address recipient;
    uint8 v1; bytes32 r1; bytes32 s1;
    uint8 v2; bytes32 r2; bytes32 s2;
  }

  ERC20 public OCT;

  mapping(address => uint) public ticketFunds;
  mapping(address => uint) public overdraftFunds;
  mapping(address => uint) public unlocking;

  uint public minTicketFund    = 1 ether / 100;
  uint public minOverdraftFund = 1 ether / 100;
  uint public minTopUp         = 1 ether / 100;
  uint public minFirstFund = minTicketFund + minOverdraftFund + minTopUp;

  uint public unlockDelay = 1 days;

  bytes32 public constant unlockHash = keccak256("The Net treats censorship as a defect and routes around it.");
  bytes32 public constant withdrawHash = keccak256("Surveillance breeds conformity");

  event Funded        (address indexed creator, uint funds);
  event FundsWithdrawn(address indexed creator, uint funds);
  event Unlocked      (address indexed creator, uint time);
  event Slashed       (address indexed creator, uint faceValue, uint slash);
  event TicketClaimed (address indexed creator, address indexed recipient, uint faceValue);
  //event Debug(bytes32 indexed ticketHash, address indexed addr1, address indexed addr2);

  function MicroPay(address _OCT) public {
    OCT = ERC20(_OCT);
  }

  // The MicroPay contract must verify that the caller sent it an exact amount of OCT.
  // Since OCT is an ERC20 token it cannot be directly sent in a call like ETH.
  // We solve this by having the caller calling the OCT Ledger `transferData`
  // which calls this callback in the recipient.
  function tokenFallback(address _from, uint _oct, bytes) public {
    require(msg.sender == address(OCT));
    require(unlocking[_from] == 0); // sender cannot reuse their account

    uint minFund = minTopUp;
    uint neededOverdraft;

    if (overdraftFunds[_from] < minOverdraftFund) {
      neededOverdraft = minOverdraftFund - overdraftFunds[_from];
    }
    minFund += neededOverdraft;

    if (ticketFunds[_from] < minTicketFund) {
      minFund += (minTicketFund - ticketFunds[_from]);
    }

    require(_oct >= minFund);

    ticketFunds[_from] += (_oct - neededOverdraft);
    overdraftFunds[_from] += neededOverdraft;

    Funded(_from, _oct);
  }

  function claimTicket(uint _rand, bytes32 _randHash, uint _nonce, uint _faceValue, uint _winProb, address _recipient,
		       uint8 _v1, bytes32 _r1, bytes32 _s1, // signature over ticket struct by creator
		       uint8 _v2, bytes32 _r2, bytes32 _s2  // signature from recipient pubkey
		       ) public {

    /* To get around solidity's low limit on number of local variables
       (which counts function parameters) we pass the params on as a struct.
       Note that we cannot do this in the public API functions
       due to limitations in the Ethereum ABI encoding
    */
    TicketClaim memory t;
    t.rand	= _rand;
    t.randHash	= _randHash;
    t.nonce	= _nonce;
    t.faceValue	= _faceValue;
    t.winProb	= _winProb;
    t.recipient	= _recipient;

    t.v1 = _v1;
    t.r1 = _r1;
    t.s1 = _s1;

    t.v2 = _v2;
    t.r2 = _r2;
    t.s2 = _s2;

    return doClaimTicket(t);
  }

  function doClaimTicket(TicketClaim t) internal {
    uint res;
    address creator;
    (res, creator) = doValidateTicket(t);
    require((res & 2) == 2); // valid
    require((res & 4) == 4); // win

    if ((res & 8) != 8) { // no slash
      ticketFunds[creator] -= t.faceValue;
      require(  OCT.transfer(t.recipient, t.faceValue));
      TicketClaimed(creator, t.recipient, t.faceValue);
      return;
    }

    // creator does not have enough funds, time to slash:
    // first, send available funds to recipient (validated to be less than ticket face value)
    require(OCT.transfer(t.recipient, ticketFunds[creator]));
    ticketFunds[creator] = 0;
    // TODO: consider sending recipient some of the reserve funds as incentive
    //       to slash (but not enough to render slashing ineffective)

    // burn reserve funds
    uint slashAmount = overdraftFunds[creator];
    overdraftFunds[creator] = 0;
    // TODO: MicroPay contract now still has the sender's tokens, though
    //       unaccounted - consider burning them in the ERC20 ledger too
    Slashed(creator, t.faceValue, slashAmount);
  }

  function validateTicket(uint _rand,
			  bytes32 _randHash,
			  uint _nonce,
			  uint _faceValue,
			  uint _winProb,
			  address _recipient,
			  uint8 _v1, bytes32 _r1, bytes32 _s1, // signature over ticket struct by creator
			  uint8 _v2, bytes32 _r2, bytes32 _s2  // signature from recipient pubkey
			  ) public view returns (uint, address) { //(bool, bool, address) {

    /* To get around solidity's low limit on number of local variables
       (which counts function parameters) we pass the params on as a struct.
       Note that we cannot use a struct as input parameter in public functions
       due to limitations in the Ethereum ABI encoding

       we also pass the validation result as a uint for this reason
    */
    TicketClaim memory t;
    t.rand	= _rand;
    t.randHash	= _randHash;
    t.nonce	= _nonce;
    t.faceValue	= _faceValue;
    t.winProb	= _winProb;
    t.recipient	= _recipient;

    t.v1 = _v1;
    t.r1 = _r1;
    t.s1 = _s1;

    t.v2 = _v2;
    t.r2 = _r2;
    t.s2 = _s2;

    return doValidateTicket(t);
  }

  function doValidateTicket(TicketClaim t) internal view returns (uint, address) {
    uint res;
    // verify recipient's (claimed) random number and its hash
    if (keccak256(t.rand) != t.randHash) {
      return (res, 0);
    }

    bytes32 ticketHash = keccak256(t.randHash, t.recipient, t.faceValue, t.winProb, t.nonce);
    address signer1 = ecrecover(ticketHash, t.v1, t.r1, t.s1);
    address signer2 = ecrecover(ticketHash, t.v2, t.r2, t.s2);

    //Debug(ticketHash, signer1, signer2);

    // Verify recipient signature.  Fails on invalid signature or if
    // ticketHash is not the message signed.
    if (signer2 != t.recipient) {
      return (res, 0);
    }

    // Verify ticket creator has reserve funds
    if (overdraftFunds[signer1] == 0) {
      return (res, 0);
    }

    // Now we know the ticket is valid though it may not be winning and may
    // require slashing of ticket creator
    res ^= 2; // valid

    if (uint(keccak256(ticketHash, t.rand)) <= t.winProb) {
      res ^= 4; // win
    }

    if (ticketFunds[signer1] < t.faceValue) {
      res ^= 8; // slash
    }

    return (res, signer1);
  }

  // TODO: decide on decoupling of sender and account paying for tx fee;
  //       see claimTicket
  function unlockAccount(uint8 _v1, bytes32 _r1, bytes32 _s1) public {
    address signer = ecrecover(unlockHash, _v1, _r1, _s1);
    require(overdraftFunds[signer] != 0);
    require(unlocking[signer] == 0);

    unlocking[signer] = now;

    Unlocked(signer, now);
  }

  function withdrawSenderFunds(uint8 _v1, bytes32 _r1, bytes32 _s1) public {
    address signer = ecrecover(withdrawHash, _v1, _r1, _s1);
    require(unlocking[signer] != 0);
    require((unlocking[signer] + unlockDelay) < now);

    uint funds = ticketFunds[signer] + overdraftFunds[signer];

    overdraftFunds[signer] = 0;
    ticketFunds[signer]    = 0;
    require(OCT.transfer(signer, funds));
    // unlocking[signer] is not cleared to avoid account reuse

    FundsWithdrawn(signer, funds);
  }

  // Called locally by the ticket recipient when validating received tickets
  function isLocked(address addr) public view returns (bool) {
    return (unlocking[addr] == 0 || (unlocking[addr] + unlockDelay) >= now);
  }

  function isSolvent(address addr) public view returns (bool) {
    return (ticketFunds[addr] >= minTicketFund &&
	    overdraftFunds[addr] >= minOverdraftFund);
  }
}
