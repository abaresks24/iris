// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Chainlink price-feed interface (standard). Our vault reads prices
/// through this — plug a live Chainlink feed on Arc, or a MockAggregator.
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}
