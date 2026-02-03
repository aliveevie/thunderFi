// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {ThunderPrivacyHook} from "../src/ThunderPrivacyHook.sol";

/// @title DeployThunderHook
/// @notice Deployment script for ThunderPrivacyHook
/// @dev Uses CREATE2 with salt mining to deploy hook at correct address
contract DeployThunderHook is Script {
    // Sepolia PoolManager address
    address constant SEPOLIA_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;

    // Base Sepolia PoolManager address
    address constant BASE_SEPOLIA_POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;

    // Default timing parameters (in seconds)
    uint256 constant DEFAULT_COMMIT_PERIOD = 60; // 1 minute for testing
    uint256 constant DEFAULT_REVEAL_PERIOD = 60; // 1 minute for testing
    uint256 constant DEFAULT_SETTLE_PERIOD = 60; // 1 minute for testing

    function run() external {
        // Get configuration from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address poolManager = vm.envOr("POOL_MANAGER", SEPOLIA_POOL_MANAGER);

        uint256 commitPeriod = vm.envOr("COMMIT_PERIOD", DEFAULT_COMMIT_PERIOD);
        uint256 revealPeriod = vm.envOr("REVEAL_PERIOD", DEFAULT_REVEAL_PERIOD);
        uint256 settlePeriod = vm.envOr("SETTLE_PERIOD", DEFAULT_SETTLE_PERIOD);

        console.log("Deploying ThunderPrivacyHook...");
        console.log("PoolManager:", poolManager);
        console.log("Commit Period:", commitPeriod);
        console.log("Reveal Period:", revealPeriod);
        console.log("Settle Period:", settlePeriod);

        // Calculate required hook flags
        // We need: beforeInitialize, beforeSwap, afterSwap
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG |
            Hooks.BEFORE_SWAP_FLAG |
            Hooks.AFTER_SWAP_FLAG
        );

        console.log("Required flags:", flags);

        // Find salt for CREATE2 deployment
        (address hookAddress, bytes32 salt) = mineSalt(
            poolManager,
            commitPeriod,
            revealPeriod,
            settlePeriod,
            flags
        );

        console.log("Computed hook address:", hookAddress);
        console.log("Salt:", vm.toString(salt));

        vm.startBroadcast(deployerPrivateKey);

        // Deploy with CREATE2
        ThunderPrivacyHook hook = new ThunderPrivacyHook{salt: salt}(
            IPoolManager(poolManager),
            commitPeriod,
            revealPeriod,
            settlePeriod
        );

        console.log("Deployed ThunderPrivacyHook at:", address(hook));

        // Verify address matches
        require(address(hook) == hookAddress, "Hook address mismatch!");

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("Hook Address:", address(hook));
        console.log("Network: Check POOL_MANAGER env var");
    }

    /// @notice Mines a salt that produces a hook address with the required flags
    /// @dev Uses brute force search with incrementing counter
    function mineSalt(
        address poolManager,
        uint256 commitPeriod,
        uint256 revealPeriod,
        uint256 settlePeriod,
        uint160 flags
    ) internal view returns (address hookAddress, bytes32 salt) {
        // Get deployer address
        address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));

        // Creation code with constructor args
        bytes memory creationCode = abi.encodePacked(
            type(ThunderPrivacyHook).creationCode,
            abi.encode(poolManager, commitPeriod, revealPeriod, settlePeriod)
        );

        bytes32 initCodeHash = keccak256(creationCode);

        // Mine for valid address
        uint256 counter = 0;
        while (counter < 1_000_000) {
            salt = bytes32(counter);

            // Compute CREATE2 address
            hookAddress = computeAddress(deployer, salt, initCodeHash);

            // Check if address has correct flags
            if (uint160(hookAddress) & uint160(Hooks.ALL_HOOK_MASK) == flags) {
                return (hookAddress, salt);
            }

            counter++;
        }

        revert("Could not find valid salt");
    }

    /// @notice Computes CREATE2 address
    function computeAddress(
        address deployer,
        bytes32 salt,
        bytes32 initCodeHash
    ) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            deployer,
            salt,
            initCodeHash
        )))));
    }
}
