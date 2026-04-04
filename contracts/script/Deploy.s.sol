// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ContractFactory} from "../src/ContractFactory.sol";
import {ContractToken} from "../src/ContractToken.sol";

/// @title Deploy
/// @notice Deploys ContractFactory + test USDC to any EVM chain.
///
/// Deploy everything:
///   forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
///
/// Deploy test USDC only:
///   forge script script/Deploy.s.sol --sig "deployTestToken()" --rpc-url http://localhost:8545 --broadcast
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address treasury = vm.envAddress("PLATFORM_TREASURY");

        // Deploy test USDC first if no payment token set
        address paymentToken;
        try vm.envAddress("PAYMENT_TOKEN_ADDRESS") returns (address existing) {
            paymentToken = existing;
            console.log("Using existing payment token:", paymentToken);
        } catch {
            console.log("Deploying test USDC...");
            vm.startBroadcast(deployerKey);
            ContractToken usdc = new ContractToken("Test USDC", "tUSDC", deployer);
            usdc.mint(deployer, 10_000_000 * 10**18); // 10M
            vm.stopBroadcast();
            paymentToken = address(usdc);
            console.log("Test USDC:", paymentToken);
        }

        // Deploy Factory
        console.log("");
        console.log("Deploying ContractFactory...");
        vm.startBroadcast(deployerKey);
        ContractFactory factory = new ContractFactory(treasury, paymentToken);
        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployed ===");
        console.log("  ContractFactory:", address(factory));
        console.log("  Payment Token: ", paymentToken);
        console.log("  Treasury:      ", treasury);
        console.log("");
        console.log("Add to .env.local:");
        console.log("  CONTRACT_FACTORY_ADDRESS=%s", vm.toString(address(factory)));
        console.log("  PAYMENT_TOKEN_ADDRESS=%s", vm.toString(paymentToken));
    }

    function deployTestToken() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        ContractToken usdc = new ContractToken("Test USDC", "tUSDC", deployer);
        usdc.mint(deployer, 10_000_000 * 10**18);
        vm.stopBroadcast();

        console.log("Test USDC:", address(usdc));
        console.log("PAYMENT_TOKEN_ADDRESS=%s", vm.toString(address(usdc)));
    }
}
