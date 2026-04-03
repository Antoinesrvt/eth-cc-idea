// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ServiceContract} from "../src/ServiceContract.sol";
import {ContractToken} from "../src/ContractToken.sol";

/// @title Deploy
/// @notice Deploys ServiceContract + ContractToken to any EVM chain.
///
/// Usage:
///   # Set env vars first:
///   export DEPLOYER_PRIVATE_KEY=0x...
///   export PLATFORM_TREASURY=0x...         # receives 2.5% platform fee
///   export PAYMENT_TOKEN_ADDRESS=0x...     # USDC on target chain
///
///   # Deploy to Base Sepolia:
///   forge script script/Deploy.s.sol \
///     --rpc-url https://sepolia.base.org \
///     --broadcast --verify
///
///   # Deploy a test stablecoin (if you need one):
///   forge script script/Deploy.s.sol \
///     --sig "deployTestToken()" \
///     --rpc-url https://sepolia.base.org \
///     --broadcast
contract Deploy is Script {

    /// @notice Deploy a ServiceContract for a specific deal.
    ///         Call this for each new contract between an agency and client.
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address treasury = vm.envAddress("PLATFORM_TREASURY");
        address paymentToken = vm.envAddress("PAYMENT_TOKEN_ADDRESS");

        // Example deal params — replace with real values or pass via env
        address client = vm.envOr("CLIENT_ADDRESS", deployer);
        address agency = vm.envOr("AGENCY_ADDRESS", deployer);
        address bd = vm.envOr("BD_ADDRESS", address(0));
        uint16 bdFeeBps = uint16(vm.envOr("BD_FEE_BPS", uint256(0)));

        string[] memory names = new string[](1);
        names[0] = "Milestone 1";
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1000 * 10**18; // 1000 USDC
        uint256[] memory deadlines = new uint256[](1);
        deadlines[0] = block.timestamp + 30 days;

        console.log("=== Deploying to", block.chainid, "===");
        console.log("  Deployer:      ", deployer);
        console.log("  Treasury:      ", treasury);
        console.log("  Payment Token: ", paymentToken);
        console.log("  Client:        ", client);
        console.log("  Agency:        ", agency);

        vm.startBroadcast(deployerKey);

        ServiceContract sc = new ServiceContract(
            client,
            agency,
            bd,
            bdFeeBps,
            bytes32(0), // termsHash
            names,
            amounts,
            deadlines,
            treasury,
            paymentToken
        );

        // Deploy a ContractToken owned by the ServiceContract
        ContractToken token = new ContractToken(
            "Deal Token",
            "DEAL",
            address(sc)
        );

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployed ===");
        console.log("  ServiceContract:", address(sc));
        console.log("  ContractToken:  ", address(token));
        console.log("");
        console.log("Add to .env.local:");
        console.log("  SERVICE_CONTRACT_ADDRESS=", vm.toString(address(sc)));
    }

    /// @notice Deploy a test ERC20 stablecoin (for testing when no real USDC).
    function deployTestToken() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("=== Deploying Test USDC ===");

        vm.startBroadcast(deployerKey);

        ContractToken testUsdc = new ContractToken("Test USDC", "tUSDC", deployer);
        testUsdc.mint(deployer, 1_000_000 * 10**18);

        vm.stopBroadcast();

        console.log("  Test USDC:", address(testUsdc));
        console.log("  Minted 1M to deployer:", deployer);
        console.log("");
        console.log("  PAYMENT_TOKEN_ADDRESS=", vm.toString(address(testUsdc)));
    }
}
