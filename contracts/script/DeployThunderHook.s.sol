// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {ThunderPrivacyHook} from "../src/ThunderPrivacyHook.sol";

/// @title DeployThunderHook
/// @notice Deployment script for ThunderPrivacyHook using deterministic CREATE2 factory
contract DeployThunderHook is Script {
    // Sepolia PoolManager address
    address constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

    // Default timing parameters (in seconds)
    uint256 constant DEFAULT_COMMIT_PERIOD = 60;
    uint256 constant DEFAULT_REVEAL_PERIOD = 60;
    uint256 constant DEFAULT_SETTLE_PERIOD = 60;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address poolManager = vm.envOr("POOL_MANAGER", SEPOLIA_POOL_MANAGER);
        uint256 commitPeriod = vm.envOr("COMMIT_PERIOD", DEFAULT_COMMIT_PERIOD);
        uint256 revealPeriod = vm.envOr("REVEAL_PERIOD", DEFAULT_REVEAL_PERIOD);
        uint256 settlePeriod = vm.envOr("SETTLE_PERIOD", DEFAULT_SETTLE_PERIOD);

        console.log("=== ThunderPrivacyHook Deployment ===");
        console.log("PoolManager:", poolManager);
        console.log("Timing: %d/%d/%d seconds", commitPeriod, revealPeriod, settlePeriod);

        // Required flags: beforeInitialize (1<<13), beforeSwap (1<<7), afterSwap (1<<6)
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
            Hooks.BEFORE_SWAP_FLAG |
            Hooks.AFTER_SWAP_FLAG
        );
        console.log("Required address flags:", flags);

        // Build creation code
        bytes memory creationCode = abi.encodePacked(
            type(ThunderPrivacyHook).creationCode,
            abi.encode(poolManager, commitPeriod, revealPeriod, settlePeriod)
        );
        bytes32 initCodeHash = keccak256(creationCode);

        // Mine for valid salt using CREATE2 factory
        console.log("Mining for valid hook address...");
        (bytes32 salt, address hookAddress) = mineSalt(CREATE2_FACTORY, initCodeHash, flags);

        console.log("Found valid address:", hookAddress);
        console.log("Salt:", vm.toString(salt));

        // Verify the address has correct flags
        require(
            uint160(hookAddress) & uint160(Hooks.ALL_HOOK_MASK) == flags,
            "Invalid hook address flags"
        );

        vm.startBroadcast(deployerPrivateKey);

        // Deploy via CREATE2 factory
        // The factory expects: salt (32 bytes) + creation code
        bytes memory deployData = abi.encodePacked(salt, creationCode);

        (bool success, ) = CREATE2_FACTORY.call(deployData);
        require(success, "CREATE2 deployment failed");

        // Verify deployment
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(hookAddress)
        }
        require(codeSize > 0, "Hook not deployed");

        vm.stopBroadcast();

        console.log("\n=== Deployment Successful ===");
        console.log("ThunderPrivacyHook:", hookAddress);
        console.log("Network: Sepolia");
    }

    function mineSalt(
        address factory,
        bytes32 initCodeHash,
        uint160 flags
    ) internal pure returns (bytes32 salt, address hookAddress) {
        uint256 counter = 0;

        while (counter < 100_000_000) {
            salt = bytes32(counter);

            // CREATE2 address calculation
            hookAddress = address(uint160(uint256(keccak256(abi.encodePacked(
                bytes1(0xff),
                factory,
                salt,
                initCodeHash
            )))));

            // Check if lower 14 bits match required flags
            if (uint160(hookAddress) & uint160(Hooks.ALL_HOOK_MASK) == flags) {
                return (salt, hookAddress);
            }

            counter++;
        }

        revert("Could not find valid salt after 100M iterations");
    }
}
