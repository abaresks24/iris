// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

/// @notice Chainlink-compatible price feed for testnet / when a live Arc feed
/// isn't wired yet. Anyone trusted (owner) can push the latest price — in
/// practice you'd relay the real Chainlink answer here off-chain.
contract MockAggregator is AggregatorV3Interface {
    uint8 public immutable decimalsValue;
    address public owner;
    int256 public answer;
    uint256 public updatedAtValue;
    uint80 public roundIdValue;

    string public description;

    constructor(uint8 _decimals, int256 _initialAnswer, string memory _description) {
        decimalsValue = _decimals;
        answer = _initialAnswer;
        description = _description;
        owner = msg.sender;
        updatedAtValue = block.timestamp;
        roundIdValue = 1;
    }

    function decimals() external view returns (uint8) {
        return decimalsValue;
    }

    function setAnswer(int256 _answer) external {
        require(msg.sender == owner, "not owner");
        answer = _answer;
        updatedAtValue = block.timestamp;
        roundIdValue += 1;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundIdValue, answer, updatedAtValue, updatedAtValue, roundIdValue);
    }
}
