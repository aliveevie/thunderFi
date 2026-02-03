// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {BaseHook} from "v4-periphery/utils/BaseHook.sol";
import {ThunderPrivacyHook} from "../src/ThunderPrivacyHook.sol";

/// @title MockPoolManager
/// @notice Minimal mock for testing hook logic
contract MockPoolManager {
    // Empty implementation for testing
}

/// @title ThunderPrivacyHookHarness
/// @notice Test harness that bypasses address validation
contract ThunderPrivacyHookHarness is ThunderPrivacyHook {
    constructor(
        IPoolManager _manager,
        uint256 _commitPeriod,
        uint256 _revealPeriod,
        uint256 _settlePeriod
    ) ThunderPrivacyHook(_manager, _commitPeriod, _revealPeriod, _settlePeriod) {}

    /// @notice Override to skip address validation in tests
    function validateHookAddress(BaseHook) internal pure override {
        // Skip validation for testing
    }
}

/// @title ThunderPrivacyHookTest
/// @notice Tests for the ThunderPrivacyHook contract
contract ThunderPrivacyHookTest is Test {
    ThunderPrivacyHookHarness hook;
    MockPoolManager mockManager;

    // Test constants
    uint256 constant COMMIT_PERIOD = 60; // 1 minute
    uint256 constant REVEAL_PERIOD = 60; // 1 minute
    uint256 constant SETTLE_PERIOD = 60; // 1 minute

    // Test users
    address alice = address(0x1);
    address bob = address(0x2);

    function setUp() public {
        // Deploy mock pool manager
        mockManager = new MockPoolManager();

        // Deploy hook with test harness (bypasses address validation)
        hook = new ThunderPrivacyHookHarness(
            IPoolManager(address(mockManager)),
            COMMIT_PERIOD,
            REVEAL_PERIOD,
            SETTLE_PERIOD
        );

        // Create first batch manually since pool won't be initialized via hook
        hook.createBatch();

        // Fund test users
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ============ Basic Tests ============

    function test_HookPermissions() public view {
        Hooks.Permissions memory perms = hook.getHookPermissions();

        assertTrue(perms.beforeInitialize);
        assertFalse(perms.afterInitialize);
        assertFalse(perms.beforeAddLiquidity);
        assertFalse(perms.afterAddLiquidity);
        assertFalse(perms.beforeRemoveLiquidity);
        assertFalse(perms.afterRemoveLiquidity);
        assertTrue(perms.beforeSwap);
        assertTrue(perms.afterSwap);
        assertFalse(perms.beforeDonate);
        assertFalse(perms.afterDonate);
    }

    function test_TimingParameters() public view {
        assertEq(hook.COMMIT_PERIOD(), COMMIT_PERIOD);
        assertEq(hook.REVEAL_PERIOD(), REVEAL_PERIOD);
        assertEq(hook.SETTLE_PERIOD(), SETTLE_PERIOD);
    }

    function test_InitialBatchCreated() public view {
        ThunderPrivacyHook.Batch memory batch = hook.getCurrentBatch();

        assertGt(batch.commitDeadline, block.timestamp);
        assertGt(batch.revealDeadline, batch.commitDeadline);
        assertGt(batch.settleDeadline, batch.revealDeadline);
        assertFalse(batch.settled);
        assertEq(batch.swapCount, 0);
    }

    // ============ Commit Tests ============

    function test_CommitSwap() public {
        uint256 batchId = hook.currentBatchId();

        vm.startPrank(alice);

        bytes32 salt = keccak256("alice_salt");
        bytes32 commitment = hook.generateCommitmentHash(
            alice,
            true, // zeroForOne
            -1 ether, // amountSpecified
            salt
        );

        hook.commitSwap(batchId, commitment);

        ThunderPrivacyHook.Commitment memory aliceCommitment = hook.getCommitment(batchId, alice);
        assertEq(aliceCommitment.commitmentHash, commitment);
        assertFalse(aliceCommitment.revealed);
        assertFalse(aliceCommitment.executed);

        vm.stopPrank();
    }

    function test_CommitSwap_UpdatesSwapCount() public {
        uint256 batchId = hook.currentBatchId();

        vm.prank(alice);
        hook.commitSwap(batchId, keccak256("alice"));

        vm.prank(bob);
        hook.commitSwap(batchId, keccak256("bob"));

        (,,,, uint256 swapCount,,) = hook.batches(batchId);
        assertEq(swapCount, 2);
    }

    function test_CommitSwap_RevertsAfterDeadline() public {
        uint256 batchId = hook.currentBatchId();

        // Warp past commit deadline
        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        vm.startPrank(alice);

        bytes32 commitment = keccak256("test");

        vm.expectRevert(ThunderPrivacyHook.CommitmentPeriodEnded.selector);
        hook.commitSwap(batchId, commitment);

        vm.stopPrank();
    }

    function test_CommitSwap_InvalidBatchId() public {
        vm.startPrank(alice);

        bytes32 commitment = keccak256("test");

        vm.expectRevert(ThunderPrivacyHook.InvalidBatchId.selector);
        hook.commitSwap(0, commitment);

        vm.expectRevert(ThunderPrivacyHook.InvalidBatchId.selector);
        hook.commitSwap(999, commitment);

        vm.stopPrank();
    }

    // ============ Reveal Tests ============

    function test_RevealSwap() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 salt = keccak256("alice_salt");
        bool zeroForOne = true;
        int256 amountSpecified = -1 ether;

        // Commit
        vm.startPrank(alice);

        bytes32 commitment = hook.generateCommitmentHash(
            alice,
            zeroForOne,
            amountSpecified,
            salt
        );
        hook.commitSwap(batchId, commitment);

        // Warp to reveal period
        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        // Reveal
        hook.revealSwap(batchId, zeroForOne, amountSpecified, salt);

        ThunderPrivacyHook.Commitment memory aliceCommitment = hook.getCommitment(batchId, alice);
        assertTrue(aliceCommitment.revealed);
        assertEq(aliceCommitment.zeroForOne, zeroForOne);
        assertEq(aliceCommitment.amountSpecified, amountSpecified);

        vm.stopPrank();
    }

    function test_RevealSwap_AuthorizesSwap() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 salt = keccak256("alice_salt");

        vm.startPrank(alice);

        bytes32 commitment = hook.generateCommitmentHash(alice, true, -1 ether, salt);
        hook.commitSwap(batchId, commitment);

        // Not authorized before reveal
        assertFalse(hook.authorizedSwaps(batchId, alice));

        vm.warp(block.timestamp + COMMIT_PERIOD + 1);
        hook.revealSwap(batchId, true, -1 ether, salt);

        // Authorized after reveal
        assertTrue(hook.authorizedSwaps(batchId, alice));

        vm.stopPrank();
    }

    function test_RevealSwap_RevertsBeforeCommitDeadline() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 salt = keccak256("alice_salt");

        vm.startPrank(alice);

        bytes32 commitment = hook.generateCommitmentHash(alice, true, -1 ether, salt);
        hook.commitSwap(batchId, commitment);

        // Try to reveal before commit period ends
        vm.expectRevert(ThunderPrivacyHook.RevealPeriodNotStarted.selector);
        hook.revealSwap(batchId, true, -1 ether, salt);

        vm.stopPrank();
    }

    function test_RevealSwap_RevertsAfterRevealDeadline() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 salt = keccak256("alice_salt");

        vm.startPrank(alice);

        bytes32 commitment = hook.generateCommitmentHash(alice, true, -1 ether, salt);
        hook.commitSwap(batchId, commitment);

        // Warp past reveal deadline
        vm.warp(block.timestamp + COMMIT_PERIOD + REVEAL_PERIOD + 1);

        vm.expectRevert(ThunderPrivacyHook.RevealPeriodEnded.selector);
        hook.revealSwap(batchId, true, -1 ether, salt);

        vm.stopPrank();
    }

    function test_RevealSwap_InvalidCommitment_WrongDirection() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 salt = keccak256("alice_salt");

        vm.startPrank(alice);

        bytes32 commitment = hook.generateCommitmentHash(alice, true, -1 ether, salt);
        hook.commitSwap(batchId, commitment);

        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        vm.expectRevert(ThunderPrivacyHook.InvalidCommitment.selector);
        hook.revealSwap(batchId, false, -1 ether, salt); // wrong direction

        vm.stopPrank();
    }

    function test_RevealSwap_InvalidCommitment_WrongAmount() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 salt = keccak256("alice_salt");

        vm.startPrank(alice);

        bytes32 commitment = hook.generateCommitmentHash(alice, true, -1 ether, salt);
        hook.commitSwap(batchId, commitment);

        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        vm.expectRevert(ThunderPrivacyHook.InvalidCommitment.selector);
        hook.revealSwap(batchId, true, -2 ether, salt); // wrong amount

        vm.stopPrank();
    }

    function test_RevealSwap_InvalidCommitment_WrongSalt() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 salt = keccak256("alice_salt");

        vm.startPrank(alice);

        bytes32 commitment = hook.generateCommitmentHash(alice, true, -1 ether, salt);
        hook.commitSwap(batchId, commitment);

        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        vm.expectRevert(ThunderPrivacyHook.InvalidCommitment.selector);
        hook.revealSwap(batchId, true, -1 ether, keccak256("wrong_salt"));

        vm.stopPrank();
    }

    // ============ Batch Management Tests ============

    function test_CreateBatch() public {
        uint256 initialBatchId = hook.currentBatchId();

        uint256 newBatchId = hook.createBatch();

        assertEq(newBatchId, initialBatchId + 1);
        assertEq(hook.currentBatchId(), newBatchId);
    }

    function test_CreateBatch_SetsCorrectTimings() public {
        uint256 beforeCreate = block.timestamp;
        uint256 batchId = hook.createBatch();

        (uint256 commitDeadline, uint256 revealDeadline, uint256 settleDeadline,,,,) = hook.batches(batchId);

        assertEq(commitDeadline, beforeCreate + COMMIT_PERIOD);
        assertEq(revealDeadline, beforeCreate + COMMIT_PERIOD + REVEAL_PERIOD);
        assertEq(settleDeadline, beforeCreate + COMMIT_PERIOD + REVEAL_PERIOD + SETTLE_PERIOD);
    }

    function test_SettleBatch() public {
        uint256 batchId = hook.currentBatchId();

        // Warp past reveal deadline (into settle period)
        vm.warp(block.timestamp + COMMIT_PERIOD + REVEAL_PERIOD + 1);

        hook.settleBatch(batchId);

        (,,, bool settled,,,) = hook.batches(batchId);
        assertTrue(settled);

        // New batch should be created
        assertEq(hook.currentBatchId(), batchId + 1);
    }

    function test_SettleBatch_RevertsIfAlreadySettled() public {
        uint256 batchId = hook.currentBatchId();

        vm.warp(block.timestamp + COMMIT_PERIOD + REVEAL_PERIOD + 1);

        hook.settleBatch(batchId);

        vm.expectRevert(ThunderPrivacyHook.BatchAlreadySettled.selector);
        hook.settleBatch(batchId);
    }

    function test_SettleBatch_RevertsDuringRevealPeriod() public {
        uint256 batchId = hook.currentBatchId();

        vm.warp(block.timestamp + COMMIT_PERIOD + 1); // Still in reveal period

        vm.expectRevert(ThunderPrivacyHook.RevealPeriodNotStarted.selector);
        hook.settleBatch(batchId);
    }

    function test_SettleBatch_InvalidBatchId() public {
        vm.expectRevert(ThunderPrivacyHook.InvalidBatchId.selector);
        hook.settleBatch(0);

        vm.expectRevert(ThunderPrivacyHook.InvalidBatchId.selector);
        hook.settleBatch(999);
    }

    // ============ Period Check Tests ============

    function test_IsCommitPeriod() public {
        uint256 batchId = hook.currentBatchId();

        assertTrue(hook.isCommitPeriod(batchId));

        vm.warp(block.timestamp + COMMIT_PERIOD + 1);
        assertFalse(hook.isCommitPeriod(batchId));
    }

    function test_IsRevealPeriod() public {
        uint256 batchId = hook.currentBatchId();
        uint256 startTime = block.timestamp;

        assertFalse(hook.isRevealPeriod(batchId));

        vm.warp(startTime + COMMIT_PERIOD + 1);
        assertTrue(hook.isRevealPeriod(batchId));

        vm.warp(startTime + COMMIT_PERIOD + REVEAL_PERIOD + 1);
        assertFalse(hook.isRevealPeriod(batchId));
    }

    function test_IsSettlePeriod() public {
        uint256 batchId = hook.currentBatchId();

        assertFalse(hook.isSettlePeriod(batchId));

        vm.warp(block.timestamp + COMMIT_PERIOD + REVEAL_PERIOD + 1);
        assertTrue(hook.isSettlePeriod(batchId));

        vm.warp(block.timestamp + SETTLE_PERIOD + 1);
        assertFalse(hook.isSettlePeriod(batchId));
    }

    function test_PeriodChecks_InvalidBatchId() public view {
        assertFalse(hook.isCommitPeriod(0));
        assertFalse(hook.isCommitPeriod(999));
        assertFalse(hook.isRevealPeriod(0));
        assertFalse(hook.isRevealPeriod(999));
        assertFalse(hook.isSettlePeriod(0));
        assertFalse(hook.isSettlePeriod(999));
    }

    // ============ Hash Generation Tests ============

    function test_GenerateCommitmentHash() public view {
        bytes32 salt = keccak256("test_salt");
        address user = alice;
        bool zeroForOne = true;
        int256 amount = -1 ether;

        bytes32 hash1 = hook.generateCommitmentHash(user, zeroForOne, amount, salt);
        bytes32 hash2 = hook.generateCommitmentHash(user, zeroForOne, amount, salt);

        // Same inputs should give same hash
        assertEq(hash1, hash2);

        // Different direction should give different hash
        bytes32 hash3 = hook.generateCommitmentHash(user, !zeroForOne, amount, salt);
        assertNotEq(hash1, hash3);

        // Different amount should give different hash
        bytes32 hash4 = hook.generateCommitmentHash(user, zeroForOne, -2 ether, salt);
        assertNotEq(hash1, hash4);

        // Different salt should give different hash
        bytes32 hash5 = hook.generateCommitmentHash(user, zeroForOne, amount, keccak256("other"));
        assertNotEq(hash1, hash5);

        // Different user should give different hash
        bytes32 hash6 = hook.generateCommitmentHash(bob, zeroForOne, amount, salt);
        assertNotEq(hash1, hash6);
    }

    // ============ Multiple Users Test ============

    function test_MultipleUsersCommitReveal() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 aliceSalt = keccak256("alice");
        bytes32 bobSalt = keccak256("bob");

        // Alice commits
        vm.prank(alice);
        bytes32 aliceCommitment = hook.generateCommitmentHash(alice, true, -1 ether, aliceSalt);
        vm.prank(alice);
        hook.commitSwap(batchId, aliceCommitment);

        // Bob commits
        vm.prank(bob);
        bytes32 bobCommitment = hook.generateCommitmentHash(bob, false, 1 ether, bobSalt);
        vm.prank(bob);
        hook.commitSwap(batchId, bobCommitment);

        // Check swap count
        (,,,, uint256 swapCount,,) = hook.batches(batchId);
        assertEq(swapCount, 2);

        // Warp to reveal period
        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        // Both reveal
        vm.prank(alice);
        hook.revealSwap(batchId, true, -1 ether, aliceSalt);

        vm.prank(bob);
        hook.revealSwap(batchId, false, 1 ether, bobSalt);

        // Verify reveals
        ThunderPrivacyHook.Commitment memory aliceData = hook.getCommitment(batchId, alice);
        ThunderPrivacyHook.Commitment memory bobData = hook.getCommitment(batchId, bob);

        assertTrue(aliceData.revealed);
        assertTrue(bobData.revealed);
        assertTrue(aliceData.zeroForOne);
        assertFalse(bobData.zeroForOne);
    }

    // ============ Event Tests ============

    function test_EmitsBatchCreated() public {
        uint256 expectedBatchId = hook.currentBatchId() + 1;

        vm.expectEmit(true, false, false, false);
        emit ThunderPrivacyHook.BatchCreated(expectedBatchId, 0, 0);

        hook.createBatch();
    }

    function test_EmitsSwapCommitted() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 commitment = keccak256("test");

        vm.expectEmit(true, true, false, true);
        emit ThunderPrivacyHook.SwapCommitted(batchId, alice, commitment);

        vm.prank(alice);
        hook.commitSwap(batchId, commitment);
    }

    function test_EmitsSwapRevealed() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 salt = keccak256("salt");
        bool zeroForOne = true;
        int256 amount = -1 ether;

        vm.startPrank(alice);
        bytes32 commitment = hook.generateCommitmentHash(alice, zeroForOne, amount, salt);
        hook.commitSwap(batchId, commitment);
        vm.stopPrank();

        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        vm.expectEmit(true, true, false, true);
        emit ThunderPrivacyHook.SwapRevealed(batchId, alice, zeroForOne, amount);

        vm.prank(alice);
        hook.revealSwap(batchId, zeroForOne, amount, salt);
    }

    function test_EmitsBatchSettled() public {
        uint256 batchId = hook.currentBatchId();

        vm.warp(block.timestamp + COMMIT_PERIOD + REVEAL_PERIOD + 1);

        vm.expectEmit(true, false, false, true);
        emit ThunderPrivacyHook.BatchSettled(batchId, 0, 0);

        hook.settleBatch(batchId);
    }
}
