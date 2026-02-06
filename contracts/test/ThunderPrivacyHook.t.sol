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
/// @notice Comprehensive tests for the ThunderPrivacyHook contract
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
    address charlie = address(0x3);
    address dave = address(0x4);

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
        vm.deal(charlie, 100 ether);
        vm.deal(dave, 100 ether);
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
        assertEq(batch.commitmentCount, 0);
    }

    function test_PrivacyConstants() public view {
        assertEq(hook.MIN_BATCH_SIZE(), 3);
        assertEq(hook.MAX_SLIPPAGE_BPS(), 500);
        assertEq(hook.PRIVACY_FEE_BPS(), 5);
    }

    // ============ Nullifier Tests ============

    function test_GenerateNullifier() public view {
        bytes32 secret = keccak256("alice_secret");
        uint256 nonce = 0;

        bytes32 nullifier1 = hook.generateNullifier(alice, secret, nonce);
        bytes32 nullifier2 = hook.generateNullifier(alice, secret, nonce);

        // Same inputs should give same nullifier
        assertEq(nullifier1, nullifier2);

        // Different nonce should give different nullifier
        bytes32 nullifier3 = hook.generateNullifier(alice, secret, nonce + 1);
        assertNotEq(nullifier1, nullifier3);
    }

    function test_NullifierCannotBeReused() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 secret = keccak256("alice_secret");
        bytes32 nullifier = hook.generateNullifier(alice, secret, 0);
        bytes32 salt = keccak256("salt");

        bytes32 commitment = hook.generateCommitmentHash(
            alice,
            true,
            -1 ether,
            nullifier,
            salt
        );

        vm.startPrank(alice);

        // First commit should succeed
        hook.commitSwap(batchId, commitment, nullifier, address(0));

        // Second commit with same nullifier should fail
        vm.expectRevert(ThunderPrivacyHook.NullifierAlreadyUsed.selector);
        hook.commitSwap(batchId, commitment, nullifier, address(0));

        vm.stopPrank();
    }

    // ============ Commit Tests ============

    function test_CommitSwap() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 secret = keccak256("alice_secret");
        bytes32 nullifier = hook.generateNullifier(alice, secret, 0);
        bytes32 salt = keccak256("alice_salt");

        vm.startPrank(alice);

        bytes32 commitment = hook.generateCommitmentHash(
            alice,
            true, // zeroForOne
            -1 ether, // amountSpecified
            nullifier,
            salt
        );

        hook.commitSwap(batchId, commitment, nullifier, address(0));

        ThunderPrivacyHook.Commitment memory aliceCommitment = hook.getCommitment(batchId, alice);
        assertEq(aliceCommitment.commitmentHash, commitment);
        assertEq(aliceCommitment.nullifier, nullifier);
        assertFalse(aliceCommitment.revealed);
        assertFalse(aliceCommitment.executed);

        vm.stopPrank();
    }

    function test_CommitSwap_UpdatesCommitmentCount() public {
        uint256 batchId = hook.currentBatchId();

        // Alice commits
        _commitUser(alice, batchId, 0);

        // Bob commits
        _commitUser(bob, batchId, 0);

        ThunderPrivacyHook.Batch memory batch = hook.getBatch(batchId);
        assertEq(batch.commitmentCount, 2);
    }

    function test_CommitSwap_RevertsAfterDeadline() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 nullifier = keccak256("nullifier");
        bytes32 commitment = keccak256("test");

        // Warp past commit deadline
        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        vm.startPrank(alice);
        vm.expectRevert(ThunderPrivacyHook.CommitmentPeriodEnded.selector);
        hook.commitSwap(batchId, commitment, nullifier, address(0));
        vm.stopPrank();
    }

    function test_CommitSwap_InvalidBatchId() public {
        bytes32 nullifier = keccak256("nullifier");
        bytes32 commitment = keccak256("test");

        vm.startPrank(alice);

        vm.expectRevert(ThunderPrivacyHook.InvalidBatchId.selector);
        hook.commitSwap(0, commitment, nullifier, address(0));

        vm.expectRevert(ThunderPrivacyHook.InvalidBatchId.selector);
        hook.commitSwap(999, commitment, nullifier, address(0));

        vm.stopPrank();
    }

    // ============ Reveal Tests ============

    function test_RevealSwap() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 secret = keccak256("alice_secret");
        bytes32 nullifier = hook.generateNullifier(alice, secret, 0);
        bytes32 salt = keccak256("alice_salt");
        bool zeroForOne = true;
        int256 amountSpecified = -1 ether;
        uint256 maxSlippage = 100; // 1%

        // Commit
        vm.startPrank(alice);

        bytes32 commitment = hook.generateCommitmentHash(
            alice,
            zeroForOne,
            amountSpecified,
            nullifier,
            salt
        );
        hook.commitSwap(batchId, commitment, nullifier, address(0));

        // Warp to reveal period
        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        // Reveal
        hook.revealSwap(batchId, zeroForOne, amountSpecified, maxSlippage, salt);

        ThunderPrivacyHook.Commitment memory aliceCommitment = hook.getCommitment(batchId, alice);
        assertTrue(aliceCommitment.revealed);
        assertEq(aliceCommitment.zeroForOne, zeroForOne);
        assertEq(aliceCommitment.amountSpecified, amountSpecified);
        assertEq(aliceCommitment.maxSlippage, maxSlippage);

        vm.stopPrank();
    }

    function test_RevealSwap_AuthorizesSwap() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 secret = keccak256("alice_secret");
        bytes32 nullifier = hook.generateNullifier(alice, secret, 0);
        bytes32 salt = keccak256("alice_salt");

        vm.startPrank(alice);

        bytes32 commitment = hook.generateCommitmentHash(alice, true, -1 ether, nullifier, salt);
        hook.commitSwap(batchId, commitment, nullifier, address(0));

        // Not authorized before reveal
        assertFalse(hook.authorizedSwaps(batchId, alice));

        vm.warp(block.timestamp + COMMIT_PERIOD + 1);
        hook.revealSwap(batchId, true, -1 ether, 100, salt);

        // Authorized after reveal
        assertTrue(hook.authorizedSwaps(batchId, alice));

        vm.stopPrank();
    }

    function test_RevealSwap_UpdatesRevealedCount() public {
        uint256 batchId = hook.currentBatchId();

        // Multiple users commit
        _commitUser(alice, batchId, 0);
        _commitUser(bob, batchId, 0);
        _commitUser(charlie, batchId, 0);

        // Warp to reveal period
        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        // All reveal
        _revealUser(alice, batchId, 0);
        _revealUser(bob, batchId, 0);
        _revealUser(charlie, batchId, 0);

        ThunderPrivacyHook.Batch memory batch = hook.getBatch(batchId);
        assertEq(batch.revealedCount, 3);
    }

    function test_RevealSwap_ExcessiveSlippage() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 secret = keccak256("alice_secret");
        bytes32 nullifier = hook.generateNullifier(alice, secret, 0);
        bytes32 salt = keccak256("alice_salt");

        vm.startPrank(alice);

        bytes32 commitment = hook.generateCommitmentHash(alice, true, -1 ether, nullifier, salt);
        hook.commitSwap(batchId, commitment, nullifier, address(0));

        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        // Try to reveal with excessive slippage (>5%)
        vm.expectRevert(ThunderPrivacyHook.ExcessiveSlippage.selector);
        hook.revealSwap(batchId, true, -1 ether, 600, salt); // 6%

        vm.stopPrank();
    }

    function test_RevealSwap_InvalidAmount() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 secret = keccak256("alice_secret");
        bytes32 nullifier = hook.generateNullifier(alice, secret, 0);
        bytes32 salt = keccak256("alice_salt");

        vm.startPrank(alice);

        bytes32 commitment = hook.generateCommitmentHash(alice, true, 0, nullifier, salt);
        hook.commitSwap(batchId, commitment, nullifier, address(0));

        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        vm.expectRevert(ThunderPrivacyHook.InvalidSwapAmount.selector);
        hook.revealSwap(batchId, true, 0, 100, salt);

        vm.stopPrank();
    }

    // ============ Privacy Metrics Tests ============

    function test_PrivacyMetrics_NotPrivateWithLowCount() public {
        uint256 batchId = hook.currentBatchId();

        // Only 2 users commit and reveal (below MIN_BATCH_SIZE of 3)
        _commitUser(alice, batchId, 0);
        _commitUser(bob, batchId, 0);

        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        _revealUser(alice, batchId, 0);
        _revealUser(bob, batchId, 0);

        (uint256 anonymitySet, bool isPrivate) = hook.getPrivacyMetrics(batchId);
        assertEq(anonymitySet, 2);
        assertFalse(isPrivate);
    }

    function test_PrivacyMetrics_PrivateWithSufficientCount() public {
        uint256 batchId = hook.currentBatchId();

        // 3 users commit and reveal (meets MIN_BATCH_SIZE)
        _commitUser(alice, batchId, 0);
        _commitUser(bob, batchId, 0);
        _commitUser(charlie, batchId, 0);

        vm.warp(block.timestamp + COMMIT_PERIOD + 1);

        _revealUser(alice, batchId, 0);
        _revealUser(bob, batchId, 0);
        _revealUser(charlie, batchId, 0);

        (uint256 anonymitySet, bool isPrivate) = hook.getPrivacyMetrics(batchId);
        assertEq(anonymitySet, 3);
        assertTrue(isPrivate);
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

        ThunderPrivacyHook.Batch memory batch = hook.getBatch(batchId);

        assertEq(batch.commitDeadline, beforeCreate + COMMIT_PERIOD);
        assertEq(batch.revealDeadline, beforeCreate + COMMIT_PERIOD + REVEAL_PERIOD);
        assertEq(batch.settleDeadline, beforeCreate + COMMIT_PERIOD + REVEAL_PERIOD + SETTLE_PERIOD);
    }

    function test_SettleBatch() public {
        uint256 batchId = hook.currentBatchId();
        ThunderPrivacyHook.Batch memory initialBatch = hook.getBatch(batchId);

        // Commit 3 users (MIN_BATCH_SIZE requirement)
        _commitUser(alice, batchId, 0);
        _commitUser(bob, batchId, 0);
        _commitUser(charlie, batchId, 0);

        // Warp to reveal period (just past commit deadline)
        vm.warp(initialBatch.commitDeadline + 1);

        // Reveal all users
        _revealUser(alice, batchId, 0);
        _revealUser(bob, batchId, 0);
        _revealUser(charlie, batchId, 0);

        // Warp to settle period (past reveal deadline)
        // Test contract is operator, so can settle immediately in settle period
        vm.warp(initialBatch.revealDeadline + 1);

        hook.settleBatch(batchId);

        ThunderPrivacyHook.Batch memory batch = hook.getBatch(batchId);
        assertTrue(batch.settled);
        assertNotEq(batch.executionSeed, bytes32(0));

        // New batch should be created
        assertEq(hook.currentBatchId(), batchId + 1);
    }

    function test_SettleBatch_RevertsIfAlreadySettled() public {
        uint256 batchId = hook.currentBatchId();
        ThunderPrivacyHook.Batch memory initialBatch = hook.getBatch(batchId);

        // Commit 3 users (MIN_BATCH_SIZE requirement)
        _commitUser(alice, batchId, 0);
        _commitUser(bob, batchId, 0);
        _commitUser(charlie, batchId, 0);

        // Warp to reveal period (just past commit deadline)
        vm.warp(initialBatch.commitDeadline + 1);

        // Reveal all users
        _revealUser(alice, batchId, 0);
        _revealUser(bob, batchId, 0);
        _revealUser(charlie, batchId, 0);

        // Warp to settle period (past reveal deadline)
        vm.warp(initialBatch.revealDeadline + 1);

        hook.settleBatch(batchId);

        vm.expectRevert(ThunderPrivacyHook.BatchAlreadySettled.selector);
        hook.settleBatch(batchId);
    }

    // ============ Batch Phase Tests ============

    function test_GetBatchPhase() public {
        uint256 batchId = hook.currentBatchId();
        ThunderPrivacyHook.Batch memory batch = hook.getBatch(batchId);

        // Phase 1: Commit (currently in commit period)
        assertEq(hook.getBatchPhase(batchId), 1);

        // Phase 2: Reveal (after commit deadline)
        vm.warp(batch.commitDeadline + 1);
        assertEq(hook.getBatchPhase(batchId), 2);

        // Phase 3: Settle (after reveal deadline)
        vm.warp(batch.revealDeadline + 1);
        assertEq(hook.getBatchPhase(batchId), 3);

        // Phase 4: Completed (after settle deadline)
        vm.warp(batch.settleDeadline + 1);
        assertEq(hook.getBatchPhase(batchId), 4);
    }

    function test_GetBatchPhase_InvalidBatchId() public view {
        assertEq(hook.getBatchPhase(0), 0);
        assertEq(hook.getBatchPhase(999), 0);
    }

    // ============ Emergency Functions Tests ============

    function test_EmergencyPause() public {
        hook.emergencyPause("Security issue");

        assertTrue(hook.paused());
    }

    function test_EmergencyPause_BlocksCommit() public {
        hook.emergencyPause("Security issue");

        uint256 batchId = hook.currentBatchId();
        bytes32 nullifier = keccak256("nullifier");
        bytes32 commitment = keccak256("test");

        vm.startPrank(alice);
        vm.expectRevert(ThunderPrivacyHook.ContractPaused.selector);
        hook.commitSwap(batchId, commitment, nullifier, address(0));
        vm.stopPrank();
    }

    function test_Unpause() public {
        hook.emergencyPause("Security issue");
        assertTrue(hook.paused());

        hook.unpause();
        assertFalse(hook.paused());
    }

    function test_OnlyOperator_Pause() public {
        vm.startPrank(alice);
        vm.expectRevert(ThunderPrivacyHook.OnlyOperator.selector);
        hook.emergencyPause("Unauthorized");
        vm.stopPrank();
    }

    function test_TransferOperator() public {
        hook.transferOperator(alice);
        assertEq(hook.operator(), alice);

        // New operator can pause
        vm.prank(alice);
        hook.emergencyPause("New operator action");
        assertTrue(hook.paused());
    }

    // ============ Full Flow Test ============

    function test_FullPrivateSwapFlow() public {
        uint256 batchId = hook.currentBatchId();
        uint256 startTime = block.timestamp;

        // Step 1: Multiple users commit (for privacy guarantee)
        _commitUser(alice, batchId, 0);
        _commitUser(bob, batchId, 0);
        _commitUser(charlie, batchId, 0);

        ThunderPrivacyHook.Batch memory batchAfterCommit = hook.getBatch(batchId);
        assertEq(batchAfterCommit.commitmentCount, 3);

        // Step 2: Move to reveal period and reveal
        vm.warp(startTime + COMMIT_PERIOD + 1);

        _revealUser(alice, batchId, 0);
        _revealUser(bob, batchId, 0);
        _revealUser(charlie, batchId, 0);

        ThunderPrivacyHook.Batch memory batchAfterReveal = hook.getBatch(batchId);
        assertEq(batchAfterReveal.revealedCount, 3);

        // Verify privacy guarantee is met
        (uint256 anonymitySet, bool isPrivate) = hook.getPrivacyMetrics(batchId);
        assertEq(anonymitySet, 3);
        assertTrue(isPrivate);

        // Step 3: Move to settle period
        vm.warp(startTime + COMMIT_PERIOD + REVEAL_PERIOD + 1);

        // All users are authorized to swap
        assertTrue(hook.authorizedSwaps(batchId, alice));
        assertTrue(hook.authorizedSwaps(batchId, bob));
        assertTrue(hook.authorizedSwaps(batchId, charlie));

        // Step 4: Settle the batch
        hook.settleBatch(batchId);

        ThunderPrivacyHook.Batch memory settledBatch = hook.getBatch(batchId);
        assertTrue(settledBatch.settled);
        assertNotEq(settledBatch.executionSeed, bytes32(0));

        // New batch created automatically
        assertEq(hook.currentBatchId(), batchId + 1);
    }

    // ============ Event Tests ============

    function test_EmitsBatchCreated() public {
        uint256 expectedBatchId = hook.currentBatchId() + 1;

        vm.expectEmit(true, false, false, false);
        emit ThunderPrivacyHook.BatchCreated(expectedBatchId, 0, 0, 0);

        hook.createBatch();
    }

    function test_EmitsSwapCommitted() public {
        uint256 batchId = hook.currentBatchId();
        bytes32 nullifier = keccak256("nullifier");
        bytes32 commitment = keccak256("test");

        vm.expectEmit(true, true, false, false);
        emit ThunderPrivacyHook.SwapCommitted(batchId, alice, commitment, 0);

        vm.prank(alice);
        hook.commitSwap(batchId, commitment, nullifier, address(0));
    }

    function test_EmitsBatchSettled() public {
        uint256 batchId = hook.currentBatchId();
        ThunderPrivacyHook.Batch memory initialBatch = hook.getBatch(batchId);

        // Commit 3 users (MIN_BATCH_SIZE requirement)
        _commitUser(alice, batchId, 0);
        _commitUser(bob, batchId, 0);
        _commitUser(charlie, batchId, 0);

        // Warp to reveal period (just past commit deadline)
        vm.warp(initialBatch.commitDeadline + 1);

        // Reveal all users
        _revealUser(alice, batchId, 0);
        _revealUser(bob, batchId, 0);
        _revealUser(charlie, batchId, 0);

        // Warp to settle period (past reveal deadline)
        vm.warp(initialBatch.revealDeadline + 1);

        vm.expectEmit(true, false, false, false);
        emit ThunderPrivacyHook.BatchSettled(batchId, 3, 0, 0, bytes32(0));

        hook.settleBatch(batchId);
    }

    // ============ Helper Functions ============

    function _commitUser(address user, uint256 batchId, uint256 nonce) internal {
        bytes32 secret = keccak256(abi.encodePacked(user, "secret"));
        bytes32 nullifier = hook.generateNullifier(user, secret, nonce);
        bytes32 salt = keccak256(abi.encodePacked(user, "salt", nonce));

        bytes32 commitment = hook.generateCommitmentHash(
            user,
            true,
            -1 ether,
            nullifier,
            salt
        );

        vm.prank(user);
        hook.commitSwap(batchId, commitment, nullifier, address(0));
    }

    function _revealUser(address user, uint256 batchId, uint256 nonce) internal {
        bytes32 salt = keccak256(abi.encodePacked(user, "salt", nonce));

        vm.prank(user);
        hook.revealSwap(batchId, true, -1 ether, 100, salt);
    }
}
