// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OptionVault} from "../src/OptionVault.sol";
import {MockAggregator} from "../src/MockAggregator.sol";
import {MockERC20} from "../src/MockERC20.sol";

/// Clean vault with PER-ASSET underlyings, so covered calls lock the right
/// token (ETH→WETH, BTC→WBTC, SOL→WSOL). All collateral tokens are mintable
/// test tokens (Arc has no canonical bridged versions). CSP uses USDC.
contract DeployVaultV3 is Script {
    function run() external {
        vm.startBroadcast();

        MockERC20 usdc = new MockERC20("Iris Test USDC", "USDC", 6);
        MockERC20 weth = new MockERC20("Iris Test WETH", "WETH", 18);
        MockERC20 wbtc = new MockERC20("Iris Test WBTC", "WBTC", 18);
        MockERC20 wsol = new MockERC20("Iris Test WSOL", "WSOL", 18);

        MockAggregator ethFeed = new MockAggregator(8, 1670e8, "ETH / USD");
        MockAggregator btcFeed = new MockAggregator(8, 64000e8, "BTC / USD");
        MockAggregator solFeed = new MockAggregator(8, 150e8, "SOL / USD");

        OptionVault vault = new OptionVault(address(usdc));

        uint8 eth = vault.addMarket(address(ethFeed), address(weth), 15000);
        uint8 btc = vault.addMarket(address(btcFeed), address(wbtc), 15000);
        uint8 sol = vault.addMarket(address(solFeed), address(wsol), 15000);

        // Treasury pays premiums in USDC.
        usdc.mint(address(vault), 5_000_000e6);
        // Seed deployer for self-tests.
        usdc.mint(msg.sender, 100_000e6);
        weth.mint(msg.sender, 100 ether);
        wbtc.mint(msg.sender, 100 ether);
        wsol.mint(msg.sender, 100 ether);

        vm.stopBroadcast();

        console.log("MockUSDC:   ", address(usdc));
        console.log("MockWETH:   ", address(weth));
        console.log("MockWBTC:   ", address(wbtc));
        console.log("MockWSOL:   ", address(wsol));
        console.log("ethFeed:    ", address(ethFeed));
        console.log("btcFeed:    ", address(btcFeed));
        console.log("solFeed:    ", address(solFeed));
        console.log("OptionVault:", address(vault));
        console.log("markets:", eth, btc, sol);
    }
}
