// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OptionVault} from "../src/OptionVault.sol";
import {MockAggregator} from "../src/MockAggregator.sol";
import {MockERC20} from "../src/MockERC20.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

/// Deploys the Iris options protocol on Arc testnet:
///   - test WETH (covered-call collateral, public mint)
///   - ETH/USD oracle (Chainlink-compatible mock; swap for the live Arc feed)
///   - OptionVault (USDC = Arc native gas token)
///   - one ETH market, treasury funded with USDC for premiums
contract Deploy is Script {
    // Arc native USDC (gas token + ERC-20), 6 decimals
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        vm.startBroadcast();

        MockERC20 weth = new MockERC20("Wrapped Ether (test)", "WETH", 18);
        MockAggregator ethFeed = new MockAggregator(8, 3000e8, "ETH / USD");
        OptionVault vault = new OptionVault(USDC);

        // ETH market: 15% APR premium parameter
        uint8 ethMarket = vault.addMarket(address(ethFeed), address(weth), 1500);

        // Mint test WETH to the deployer so covered calls are testable
        weth.mint(msg.sender, 10 ether);

        // NOTE: treasury funding (USDC) is done post-deploy via `cast send`,
        // because Arc's native-USDC precompile can't run in forge's local EVM.

        vm.stopBroadcast();

        console.log("USDC (native):   ", USDC);
        console.log("WETH (test):     ", address(weth));
        console.log("ETH/USD feed:    ", address(ethFeed));
        console.log("OptionVault:     ", address(vault));
        console.log("ETH marketId:    ", ethMarket);
    }
}
