// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/utils/BaseHook.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {Currency} from "v4-core/types/Currency.sol";

/// @title ThunderPrivacyHook
/// @notice A Uniswap v4 hook implementing commit-reveal pattern for privacy-preserving batch swaps
/// @dev Part of the thunderFi gasless privacy-preserving trading platform
/// @author thunderFi Team
contract ThunderPrivacyHook is BaseHook {
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;

    // ============ Events ============

    /// @notice Emitted when a new batch is created
    event BatchCreated(uint256 indexed batchId, uint256 commitDeadline, uint256 revealDeadline);

    /// @notice Emitted when a user commits to a swap
    event SwapCommitted(uint256 indexed batchId, address indexed user, bytes32 commitment);

    /// @notice Emitted when a swap is revealed
    event SwapRevealed(uint256 indexed batchId, address indexed user, bool zeroForOne, int256 amountSpecified);

    /// @notice Emitted when a batch is settled
    event BatchSettled(uint256 indexed batchId, int256 netAmount0, int256 netAmount1);

    /// @notice Emitted when a swap executes as part of a batch
    event PrivateSwapExecuted(uint256 indexed batchId, address indexed user, bytes32 swapHash);

    // ============ Errors ============

    error BatchNotActive();
    error CommitmentPeriodEnded();
    error RevealPeriodNotStarted();
    error RevealPeriodEnded();
    error InvalidCommitment();
    error SwapNotRevealed();
    error UnauthorizedSwap();
    error BatchAlreadySettled();
    error InvalidBatchId();

    // ============ Structs ============

    /// @notice Represents a batch of private swaps
    struct Batch {
        uint256 commitDeadline;
        uint256 revealDeadline;
        uint256 settleDeadline;
        bool settled;
        uint256 swapCount;
        int256 netAmount0;
        int256 netAmount1;
    }

    /// @notice Represents a committed swap
    struct Commitment {
        bytes32 commitmentHash;
        bool revealed;
        bool executed;
        bool zeroForOne;
        int256 amountSpecified;
    }

    // ============ State Variables ============

    /// @notice Current batch ID
    uint256 public currentBatchId;

    /// @notice Duration of the commit period in seconds
    uint256 public immutable COMMIT_PERIOD;

    /// @notice Duration of the reveal period in seconds
    uint256 public immutable REVEAL_PERIOD;

    /// @notice Duration of the settle period in seconds
    uint256 public immutable SETTLE_PERIOD;

    /// @notice Mapping from batch ID to batch data
    mapping(uint256 => Batch) public batches;

    /// @notice Mapping from batch ID => user => commitment
    mapping(uint256 => mapping(address => Commitment)) public commitments;

    /// @notice Mapping to track authorized batch swaps (batchId => user => authorized)
    mapping(uint256 => mapping(address => bool)) public authorizedSwaps;

    /// @notice The pool key this hook is associated with
    PoolKey public poolKey;

    /// @notice Flag to indicate if pool is initialized
    bool public poolInitialized;

    // ============ Constructor ============

    /// @notice Creates a new ThunderPrivacyHook
    /// @param _manager The Uniswap v4 PoolManager
    /// @param _commitPeriod Duration of commit period in seconds
    /// @param _revealPeriod Duration of reveal period in seconds
    /// @param _settlePeriod Duration of settle period in seconds
    constructor(
        IPoolManager _manager,
        uint256 _commitPeriod,
        uint256 _revealPeriod,
        uint256 _settlePeriod
    ) BaseHook(_manager) {
        COMMIT_PERIOD = _commitPeriod;
        REVEAL_PERIOD = _revealPeriod;
        SETTLE_PERIOD = _settlePeriod;
    }

    // ============ Hook Permissions ============

    /// @notice Returns the hook permissions
    /// @return Permissions struct indicating which hooks are enabled
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ============ Hook Callbacks ============

    /// @notice Called before pool initialization
    /// @dev Stores the pool key for future reference
    function _beforeInitialize(address, PoolKey calldata key, uint160)
        internal
        override
        returns (bytes4)
    {
        poolKey = key;
        poolInitialized = true;

        // Create the first batch
        _createNewBatch();

        return BaseHook.beforeInitialize.selector;
    }

    /// @notice Called before a swap is executed
    /// @dev Validates that the swap is part of a revealed batch
    function _beforeSwap(
        address sender,
        PoolKey calldata,
        SwapParams calldata params,
        bytes calldata hookData
    ) internal view override returns (bytes4, BeforeSwapDelta, uint24) {
        // Decode the batch ID from hook data
        if (hookData.length > 0) {
            uint256 batchId = abi.decode(hookData, (uint256));

            // Verify this is an authorized batch swap
            if (!authorizedSwaps[batchId][sender]) {
                revert UnauthorizedSwap();
            }

            Batch storage batch = batches[batchId];

            // Ensure batch is in settle period
            if (block.timestamp < batch.revealDeadline) {
                revert RevealPeriodNotStarted();
            }
            if (block.timestamp > batch.settleDeadline) {
                revert RevealPeriodEnded();
            }
            if (batch.settled) {
                revert BatchAlreadySettled();
            }

            // Verify the swap matches the revealed commitment
            Commitment storage commitment = commitments[batchId][sender];
            if (!commitment.revealed) {
                revert SwapNotRevealed();
            }
            if (commitment.executed) {
                revert UnauthorizedSwap();
            }
            if (commitment.zeroForOne != params.zeroForOne ||
                commitment.amountSpecified != params.amountSpecified) {
                revert InvalidCommitment();
            }
        }

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    /// @notice Called after a swap is executed
    /// @dev Records the swap in the batch and updates net amounts
    function _afterSwap(
        address sender,
        PoolKey calldata,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) internal override returns (bytes4, int128) {
        if (hookData.length > 0) {
            uint256 batchId = abi.decode(hookData, (uint256));

            Commitment storage commitment = commitments[batchId][sender];
            commitment.executed = true;

            // Update batch net amounts
            Batch storage batch = batches[batchId];
            batch.netAmount0 += delta.amount0();
            batch.netAmount1 += delta.amount1();

            // Generate swap hash for privacy
            bytes32 swapHash = keccak256(abi.encodePacked(
                batchId,
                sender,
                params.zeroForOne,
                params.amountSpecified,
                block.timestamp
            ));

            emit PrivateSwapExecuted(batchId, sender, swapHash);
        }

        return (BaseHook.afterSwap.selector, 0);
    }

    // ============ Batch Management ============

    /// @notice Creates a new batch
    /// @return batchId The ID of the newly created batch
    function createBatch() external returns (uint256 batchId) {
        return _createNewBatch();
    }

    /// @notice Internal function to create a new batch
    function _createNewBatch() internal returns (uint256 batchId) {
        currentBatchId++;
        batchId = currentBatchId;

        uint256 commitDeadline = block.timestamp + COMMIT_PERIOD;
        uint256 revealDeadline = commitDeadline + REVEAL_PERIOD;
        uint256 settleDeadline = revealDeadline + SETTLE_PERIOD;

        batches[batchId] = Batch({
            commitDeadline: commitDeadline,
            revealDeadline: revealDeadline,
            settleDeadline: settleDeadline,
            settled: false,
            swapCount: 0,
            netAmount0: 0,
            netAmount1: 0
        });

        emit BatchCreated(batchId, commitDeadline, revealDeadline);

        return batchId;
    }

    // ============ Commit-Reveal Functions ============

    /// @notice Commits to a swap in the current batch
    /// @param batchId The batch ID to commit to
    /// @param commitmentHash Hash of (sender, zeroForOne, amountSpecified, salt)
    function commitSwap(uint256 batchId, bytes32 commitmentHash) external {
        if (batchId == 0 || batchId > currentBatchId) {
            revert InvalidBatchId();
        }

        Batch storage batch = batches[batchId];

        if (block.timestamp > batch.commitDeadline) {
            revert CommitmentPeriodEnded();
        }

        commitments[batchId][msg.sender] = Commitment({
            commitmentHash: commitmentHash,
            revealed: false,
            executed: false,
            zeroForOne: false,
            amountSpecified: 0
        });

        batch.swapCount++;

        emit SwapCommitted(batchId, msg.sender, commitmentHash);
    }

    /// @notice Reveals a previously committed swap
    /// @param batchId The batch ID
    /// @param zeroForOne Direction of the swap
    /// @param amountSpecified Amount to swap
    /// @param salt Random salt used in commitment
    function revealSwap(
        uint256 batchId,
        bool zeroForOne,
        int256 amountSpecified,
        bytes32 salt
    ) external {
        if (batchId == 0 || batchId > currentBatchId) {
            revert InvalidBatchId();
        }

        Batch storage batch = batches[batchId];

        if (block.timestamp < batch.commitDeadline) {
            revert RevealPeriodNotStarted();
        }
        if (block.timestamp > batch.revealDeadline) {
            revert RevealPeriodEnded();
        }

        Commitment storage commitment = commitments[batchId][msg.sender];

        // Verify the commitment
        bytes32 expectedHash = keccak256(abi.encodePacked(
            msg.sender,
            zeroForOne,
            amountSpecified,
            salt
        ));

        if (commitment.commitmentHash != expectedHash) {
            revert InvalidCommitment();
        }

        // Store revealed data
        commitment.revealed = true;
        commitment.zeroForOne = zeroForOne;
        commitment.amountSpecified = amountSpecified;

        // Authorize the swap execution
        authorizedSwaps[batchId][msg.sender] = true;

        emit SwapRevealed(batchId, msg.sender, zeroForOne, amountSpecified);
    }

    /// @notice Settles a batch after all swaps are executed
    /// @param batchId The batch ID to settle
    function settleBatch(uint256 batchId) external {
        if (batchId == 0 || batchId > currentBatchId) {
            revert InvalidBatchId();
        }

        Batch storage batch = batches[batchId];

        if (batch.settled) {
            revert BatchAlreadySettled();
        }
        if (block.timestamp < batch.revealDeadline) {
            revert RevealPeriodNotStarted();
        }

        batch.settled = true;

        emit BatchSettled(batchId, batch.netAmount0, batch.netAmount1);

        // Create next batch automatically
        _createNewBatch();
    }

    // ============ View Functions ============

    /// @notice Gets the current batch information
    /// @return batch The current batch data
    function getCurrentBatch() external view returns (Batch memory) {
        return batches[currentBatchId];
    }

    /// @notice Gets a user's commitment for a batch
    /// @param batchId The batch ID
    /// @param user The user address
    /// @return commitment The commitment data
    function getCommitment(uint256 batchId, address user)
        external
        view
        returns (Commitment memory)
    {
        return commitments[batchId][user];
    }

    /// @notice Checks if a batch is in the commit period
    /// @param batchId The batch ID
    /// @return True if in commit period
    function isCommitPeriod(uint256 batchId) external view returns (bool) {
        if (batchId == 0 || batchId > currentBatchId) return false;
        return block.timestamp <= batches[batchId].commitDeadline;
    }

    /// @notice Checks if a batch is in the reveal period
    /// @param batchId The batch ID
    /// @return True if in reveal period
    function isRevealPeriod(uint256 batchId) external view returns (bool) {
        if (batchId == 0 || batchId > currentBatchId) return false;
        Batch storage batch = batches[batchId];
        return block.timestamp > batch.commitDeadline &&
               block.timestamp <= batch.revealDeadline;
    }

    /// @notice Checks if a batch is in the settle period
    /// @param batchId The batch ID
    /// @return True if in settle period
    function isSettlePeriod(uint256 batchId) external view returns (bool) {
        if (batchId == 0 || batchId > currentBatchId) return false;
        Batch storage batch = batches[batchId];
        return block.timestamp > batch.revealDeadline &&
               block.timestamp <= batch.settleDeadline;
    }

    /// @notice Generates a commitment hash for a swap
    /// @param user The user address
    /// @param zeroForOne Direction of swap
    /// @param amountSpecified Amount to swap
    /// @param salt Random salt
    /// @return The commitment hash
    function generateCommitmentHash(
        address user,
        bool zeroForOne,
        int256 amountSpecified,
        bytes32 salt
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(user, zeroForOne, amountSpecified, salt));
    }
}
