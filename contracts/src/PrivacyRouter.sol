// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {ThunderPrivacyHook} from "./ThunderPrivacyHook.sol";

/// @title PrivacyRouter
/// @notice User-friendly router for privacy-preserving Uniswap v4 swaps
/// @dev Handles token transfers, commitment generation, and batch coordination
/// @author thunderFi Team
///
/// This router simplifies the privacy swap flow:
/// 1. User calls `preparePrivateSwap` to generate commitment data
/// 2. User calls `commitPrivateSwap` during commit period
/// 3. User calls `revealPrivateSwap` during reveal period
/// 4. User calls `executePrivateSwap` during settle period
///
/// The router handles:
/// - Token approvals and transfers
/// - Commitment hash generation
/// - Nullifier management
/// - Interaction with the privacy hook
contract PrivacyRouter is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Events ============

    event PrivateSwapPrepared(
        address indexed user,
        uint256 indexed batchId,
        bytes32 commitmentHash,
        bytes32 nullifier
    );

    event PrivateSwapCommitted(
        address indexed user,
        uint256 indexed batchId
    );

    event PrivateSwapRevealed(
        address indexed user,
        uint256 indexed batchId
    );

    event PrivateSwapExecuted(
        address indexed user,
        uint256 indexed batchId,
        int256 amount0Delta,
        int256 amount1Delta
    );

    // ============ Errors ============

    error InvalidHook();
    error InvalidPoolManager();
    error InvalidAmount();
    error SwapNotPrepared();
    error InsufficientBalance();
    error TransferFailed();

    // ============ Structs ============

    /// @notice Prepared swap data stored for user
    struct PreparedSwap {
        uint256 batchId;
        bytes32 commitmentHash;
        bytes32 nullifier;
        bytes32 salt;
        bool zeroForOne;
        int256 amountSpecified;
        uint256 maxSlippage;
        address tokenIn;
        address tokenOut;
        uint256 depositAmount;
        bool committed;
        bool revealed;
        bool executed;
    }

    // ============ State Variables ============

    /// @notice The Uniswap v4 PoolManager
    IPoolManager public immutable poolManager;

    /// @notice The ThunderPrivacyHook
    ThunderPrivacyHook public immutable privacyHook;

    /// @notice User nonce for nullifier generation
    mapping(address => uint256) public userNonces;

    /// @notice User's prepared swaps
    mapping(address => PreparedSwap) public preparedSwaps;

    /// @notice User's secret for nullifier generation (set once)
    mapping(address => bytes32) public userSecrets;

    // ============ Constructor ============

    /// @param _poolManager The Uniswap v4 PoolManager address
    /// @param _privacyHook The ThunderPrivacyHook address
    constructor(address _poolManager, address _privacyHook) {
        if (_poolManager == address(0)) revert InvalidPoolManager();
        if (_privacyHook == address(0)) revert InvalidHook();

        poolManager = IPoolManager(_poolManager);
        privacyHook = ThunderPrivacyHook(_privacyHook);
    }

    // ============ Main Functions ============

    /// @notice Set user's secret for nullifier generation (only once)
    /// @param secret The secret to use for nullifier generation
    function setUserSecret(bytes32 secret) external {
        require(userSecrets[msg.sender] == bytes32(0), "Secret already set");
        require(secret != bytes32(0), "Invalid secret");
        userSecrets[msg.sender] = secret;
    }

    /// @notice Prepare a private swap (generates commitment data)
    /// @param batchId The batch ID to commit to
    /// @param tokenIn The token to swap from
    /// @param tokenOut The token to swap to
    /// @param amountIn The amount to swap
    /// @param maxSlippage Maximum slippage in basis points
    /// @return commitmentHash The commitment hash to submit
    /// @return nullifier The nullifier for this swap
    function preparePrivateSwap(
        uint256 batchId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 maxSlippage
    ) external returns (bytes32 commitmentHash, bytes32 nullifier) {
        if (amountIn == 0) revert InvalidAmount();

        // Determine swap direction (simplified - in production would check pool)
        bool zeroForOne = tokenIn < tokenOut;
        int256 amountSpecified = -int256(amountIn); // Exact input

        // Generate nullifier using user's secret and nonce
        bytes32 userSecret = userSecrets[msg.sender];
        if (userSecret == bytes32(0)) {
            // Auto-generate secret if not set
            userSecret = keccak256(abi.encodePacked(msg.sender, block.timestamp, block.prevrandao));
            userSecrets[msg.sender] = userSecret;
        }

        uint256 nonce = userNonces[msg.sender]++;
        nullifier = privacyHook.generateNullifier(msg.sender, userSecret, nonce);

        // Generate random salt
        bytes32 salt = keccak256(abi.encodePacked(
            msg.sender,
            block.timestamp,
            block.prevrandao,
            nonce
        ));

        // Generate commitment hash
        commitmentHash = privacyHook.generateCommitmentHash(
            msg.sender,
            zeroForOne,
            amountSpecified,
            nullifier,
            salt
        );

        // Store prepared swap
        preparedSwaps[msg.sender] = PreparedSwap({
            batchId: batchId,
            commitmentHash: commitmentHash,
            nullifier: nullifier,
            salt: salt,
            zeroForOne: zeroForOne,
            amountSpecified: amountSpecified,
            maxSlippage: maxSlippage,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            depositAmount: amountIn,
            committed: false,
            revealed: false,
            executed: false
        });

        emit PrivateSwapPrepared(msg.sender, batchId, commitmentHash, nullifier);

        return (commitmentHash, nullifier);
    }

    /// @notice Commit a prepared private swap
    /// @dev Transfers tokens from user and submits commitment to hook
    function commitPrivateSwap() external nonReentrant {
        PreparedSwap storage swap = preparedSwaps[msg.sender];
        if (swap.commitmentHash == bytes32(0)) revert SwapNotPrepared();
        require(!swap.committed, "Already committed");

        // Transfer tokens from user
        IERC20 tokenIn = IERC20(swap.tokenIn);
        if (tokenIn.balanceOf(msg.sender) < swap.depositAmount) {
            revert InsufficientBalance();
        }

        tokenIn.safeTransferFrom(msg.sender, address(this), swap.depositAmount);

        // Submit commitment to hook (no stealth address for simplicity)
        privacyHook.commitSwap(
            swap.batchId,
            swap.commitmentHash,
            swap.nullifier,
            address(0) // No stealth recipient
        );

        swap.committed = true;

        emit PrivateSwapCommitted(msg.sender, swap.batchId);
    }

    /// @notice Reveal a committed private swap
    function revealPrivateSwap() external {
        PreparedSwap storage swap = preparedSwaps[msg.sender];
        if (swap.commitmentHash == bytes32(0)) revert SwapNotPrepared();
        require(swap.committed, "Not committed");
        require(!swap.revealed, "Already revealed");

        privacyHook.revealSwap(
            swap.batchId,
            swap.zeroForOne,
            swap.amountSpecified,
            swap.maxSlippage,
            swap.salt
        );

        swap.revealed = true;

        emit PrivateSwapRevealed(msg.sender, swap.batchId);
    }

    /// @notice Execute a revealed private swap
    /// @dev In production, this would interact with PoolManager
    function executePrivateSwap() external nonReentrant {
        PreparedSwap storage swap = preparedSwaps[msg.sender];
        if (swap.commitmentHash == bytes32(0)) revert SwapNotPrepared();
        require(swap.revealed, "Not revealed");
        require(!swap.executed, "Already executed");

        // In production, this would:
        // 1. Call poolManager.swap() with the prepared parameters
        // 2. Pass the batchId in hookData for the privacy hook
        // 3. Handle the balance deltas and transfer tokens

        // For now, mark as executed
        swap.executed = true;

        emit PrivateSwapExecuted(
            msg.sender,
            swap.batchId,
            swap.amountSpecified,
            0 // Would be actual output amount
        );
    }

    /// @notice Cancel a prepared (but not committed) swap
    function cancelPreparedSwap() external {
        PreparedSwap storage swap = preparedSwaps[msg.sender];
        require(!swap.committed, "Already committed, cannot cancel");

        delete preparedSwaps[msg.sender];
    }

    /// @notice Refund tokens if swap was committed but batch failed
    /// @dev Only callable after batch settle deadline if swap wasn't executed
    function refundFailedSwap() external nonReentrant {
        PreparedSwap storage swap = preparedSwaps[msg.sender];
        require(swap.committed, "Not committed");
        require(!swap.executed, "Already executed");

        // Check if batch settle period has passed
        ThunderPrivacyHook.Batch memory batch = privacyHook.getBatch(swap.batchId);
        require(block.timestamp > batch.settleDeadline, "Batch not expired");

        // Refund tokens
        uint256 amount = swap.depositAmount;
        address tokenIn = swap.tokenIn;

        delete preparedSwaps[msg.sender];

        IERC20(tokenIn).safeTransfer(msg.sender, amount);
    }

    // ============ View Functions ============

    /// @notice Get current batch info
    function getCurrentBatchInfo() external view returns (
        uint256 batchId,
        uint8 phase,
        uint256 commitmentCount,
        uint256 revealedCount,
        uint256 commitDeadline,
        uint256 revealDeadline,
        uint256 settleDeadline
    ) {
        batchId = privacyHook.currentBatchId();
        phase = privacyHook.getBatchPhase(batchId);

        ThunderPrivacyHook.Batch memory batch = privacyHook.getBatch(batchId);
        commitmentCount = batch.commitmentCount;
        revealedCount = batch.revealedCount;
        commitDeadline = batch.commitDeadline;
        revealDeadline = batch.revealDeadline;
        settleDeadline = batch.settleDeadline;
    }

    /// @notice Get user's prepared swap
    function getUserSwap(address user) external view returns (PreparedSwap memory) {
        return preparedSwaps[user];
    }

    /// @notice Check if batch has enough participants for privacy
    function isBatchPrivate(uint256 batchId) external view returns (bool) {
        (, bool isPrivate) = privacyHook.getPrivacyMetrics(batchId);
        return isPrivate;
    }
}
