// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
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
contract PrivacyRouter is ReentrancyGuard, IUnlockCallback {
    using SafeERC20 for IERC20;
    using CurrencyLibrary for Currency;

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
    error InvalidCaller();
    error SettlementFailed();

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

    /// @notice Callback data for pool manager unlock
    struct SwapCallbackData {
        address sender;
        PoolKey poolKey;
        bool zeroForOne;
        int256 amountSpecified;
        uint256 batchId;
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

    /// @notice The pool key for the privacy pool
    PoolKey public poolKey;

    /// @notice Flag indicating if pool key has been set
    bool public poolKeySet;

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

    /// @notice Set the pool key for privacy swaps
    /// @param key The pool key to use for swaps
    function setPoolKey(PoolKey calldata key) external {
        require(!poolKeySet, "Pool key already set");
        poolKey = key;
        poolKeySet = true;
    }

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

    /// @notice Execute a revealed private swap through poolManager.swap()
    /// @dev Calls poolManager.unlock() which triggers unlockCallback to execute the swap
    function executePrivateSwap() external nonReentrant {
        PreparedSwap storage swap = preparedSwaps[msg.sender];
        if (swap.commitmentHash == bytes32(0)) revert SwapNotPrepared();
        require(swap.revealed, "Not revealed");
        require(!swap.executed, "Already executed");
        require(poolKeySet, "Pool key not set");

        // Encode the callback data with batchId for the privacy hook
        bytes memory callbackData = abi.encode(SwapCallbackData({
            sender: msg.sender,
            poolKey: poolKey,
            zeroForOne: swap.zeroForOne,
            amountSpecified: swap.amountSpecified,
            batchId: swap.batchId
        }));

        // Mark as executed before external call (CEI pattern)
        swap.executed = true;

        // Call poolManager.unlock() to execute the swap
        // The unlockCallback will perform the actual swap and settle balances
        bytes memory result = poolManager.unlock(callbackData);

        // Decode the result to get the balance deltas
        BalanceDelta delta = abi.decode(result, (BalanceDelta));

        emit PrivateSwapExecuted(
            msg.sender,
            swap.batchId,
            delta.amount0(),
            delta.amount1()
        );
    }

    /// @notice Callback from PoolManager.unlock() to execute the swap
    /// @param data Encoded SwapCallbackData
    /// @return The encoded BalanceDelta from the swap
    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert InvalidCaller();

        SwapCallbackData memory callbackData = abi.decode(data, (SwapCallbackData));

        // Encode the batchId as hookData for the ThunderPrivacyHook
        bytes memory hookData = abi.encode(callbackData.batchId);

        // Execute the swap through the pool manager
        // The hook's beforeSwap will validate the swap is authorized
        // The hook's afterSwap will record the execution
        BalanceDelta delta = poolManager.swap(
            callbackData.poolKey,
            SwapParams({
                zeroForOne: callbackData.zeroForOne,
                amountSpecified: callbackData.amountSpecified,
                sqrtPriceLimitX96: callbackData.zeroForOne
                    ? 4295128740  // MIN_SQRT_RATIO + 1
                    : 1461446703485210103287273052203988822378723970341 // MAX_SQRT_RATIO - 1
            }),
            hookData
        );

        // Settle the balance deltas with the pool manager
        _settleCurrencyDeltas(callbackData, delta);

        return abi.encode(delta);
    }

    /// @notice Settle currency deltas after a swap
    /// @param data The swap callback data
    /// @param delta The balance delta from the swap
    function _settleCurrencyDeltas(
        SwapCallbackData memory data,
        BalanceDelta delta
    ) internal {
        // Get the currencies from the pool key
        Currency currency0 = data.poolKey.currency0;
        Currency currency1 = data.poolKey.currency1;

        // Handle amount0 (negative means we owe, positive means we receive)
        int128 amount0 = delta.amount0();
        if (amount0 < 0) {
            // We owe currency0 to the pool - transfer from user's deposited tokens
            _settle(currency0, uint128(-amount0));
        } else if (amount0 > 0) {
            // We receive currency0 from the pool - take and transfer to user
            _take(currency0, data.sender, uint128(amount0));
        }

        // Handle amount1
        int128 amount1 = delta.amount1();
        if (amount1 < 0) {
            // We owe currency1 to the pool
            _settle(currency1, uint128(-amount1));
        } else if (amount1 > 0) {
            // We receive currency1 from the pool
            _take(currency1, data.sender, uint128(amount1));
        }
    }

    /// @notice Settle (pay) a currency to the pool manager
    function _settle(Currency currency, uint128 amount) internal {
        if (currency.isAddressZero()) {
            // Native ETH
            poolManager.settle{value: amount}();
        } else {
            // ERC20 token - sync first, then settle
            poolManager.sync(currency);
            IERC20(Currency.unwrap(currency)).safeTransfer(address(poolManager), amount);
            poolManager.settle();
        }
    }

    /// @notice Take (receive) a currency from the pool manager
    function _take(Currency currency, address recipient, uint128 amount) internal {
        poolManager.take(currency, recipient, amount);
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
