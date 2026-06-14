// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DeriveSettlement} from "../src/DeriveSettlement.sol";

/// Deploys the DeriveSettlement clearing record on Arc testnet. It books
/// Derive-matched fills on-chain and settles them via the existing ETH/USD
/// feed. USDC = Arc native gas token (treasury funded post-deploy via cast).
contract DeploySettlement is Script {
    address constant USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        vm.startBroadcast();
        DeriveSettlement settlement = new DeriveSettlement(USDC);
        vm.stopBroadcast();

        console.log("DeriveSettlement:", address(settlement));
        console.log("USDC (native):  ", USDC);
    }
}
