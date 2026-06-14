// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OptionVault} from "../src/OptionVault.sol";
import {MockAggregator} from "../src/MockAggregator.sol";
import {MockERC20} from "../src/MockERC20.sol";

/// Real per-user options vault on Arc, collateralised by a MINTABLE test USDC
/// (so any connected wallet can fund itself — Arc's native USDC is scarce).
/// Derive supplies the live prices/APRs in the UI; the vault is where the
/// money actually moves: deposit collateral, receive premium, settle on-chain.
contract DeployVaultV2 is Script {
    function run() external {
        vm.startBroadcast();

        // Mintable test USDC (6 dec) — collateral, premium and treasury asset.
        MockERC20 usdc = new MockERC20("Iris Test USDC", "USDC", 6);
        // A single mock underlying (covered-call collateral; CSP doesn't use it).
        MockERC20 weth = new MockERC20("Iris Test WETH", "WETH", 18);

        // Price feeds (8 decimals), seeded near current spot.
        MockAggregator ethFeed = new MockAggregator(8, 1670e8, "ETH / USD");
        MockAggregator btcFeed = new MockAggregator(8, 64000e8, "BTC / USD");
        MockAggregator solFeed = new MockAggregator(8, 150e8, "SOL / USD");

        OptionVault vault = new OptionVault(address(usdc));

        // One market per asset. aprBps ~150% to match Derive's (inflated) testnet
        // APRs so the vault premium ≈ what the Earn table shows.
        uint8 eth = vault.addMarket(address(ethFeed), address(weth), 15000);
        uint8 btc = vault.addMarket(address(btcFeed), address(weth), 15000);
        uint8 sol = vault.addMarket(address(solFeed), address(weth), 15000);

        // Fund the treasury so it can pay premiums.
        usdc.mint(address(vault), 5_000_000e6);
        // Seed the deployer so it can self-test.
        usdc.mint(msg.sender, 100_000e6);
        weth.mint(msg.sender, 100 ether);

        vm.stopBroadcast();

        console.log("MockUSDC:   ", address(usdc));
        console.log("MockWETH:   ", address(weth));
        console.log("ethFeed:    ", address(ethFeed));
        console.log("btcFeed:    ", address(btcFeed));
        console.log("solFeed:    ", address(solFeed));
        console.log("OptionVault:", address(vault));
        console.log("markets eth/btc/sol:", eth, btc, sol);
    }
}
