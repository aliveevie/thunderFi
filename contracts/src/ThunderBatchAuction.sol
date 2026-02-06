// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title ThunderBatchAuction
/// @notice Frequent batch auction mechanism for fair price discovery
/// @dev Implements uniform-price batch auctions to eliminate MEV and provide fair execution
/// @author thunderFi Team
///
/// Privacy & Fairness Features:
/// - Uniform Clearing Price: All orders in a batch execute at the same price
/// - Blind Ordering: Order details hidden until batch clears
/// - Time-Priority Immunity: No advantage to being first in a batch
/// - MEV Resistance: Atomic batch execution prevents sandwich attacks
/// - Fair Information: All participants see the same clearing price
///
/// How it works:
/// 1. Collection Phase: Orders are submitted with hidden limit prices
/// 2. Auction Phase: Orders are revealed and matched
/// 3. Settlement Phase: All matched orders execute at uniform clearing price
///
/// This is particularly useful for large trades that would otherwise
/// suffer from adverse selection and information leakage.
contract ThunderBatchAuction is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Events ============

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed token0,
        address indexed token1,
        uint256 endTime
    );

    event OrderSubmitted(
        uint256 indexed auctionId,
        uint256 indexed orderId,
        address indexed trader,
        bool isBid,
        bytes32 commitment
    );

    event OrderRevealed(
        uint256 indexed auctionId,
        uint256 indexed orderId,
        uint256 amount,
        uint256 limitPrice
    );

    event AuctionCleared(
        uint256 indexed auctionId,
        uint256 clearingPrice,
        uint256 totalBidVolume,
        uint256 totalAskVolume,
        uint256 matchedVolume
    );

    event OrderFilled(
        uint256 indexed auctionId,
        uint256 indexed orderId,
        address indexed trader,
        uint256 filledAmount,
        uint256 price
    );

    // ============ Errors ============

    error AuctionNotFound();
    error AuctionNotInCollectionPhase();
    error AuctionNotInRevealPhase();
    error AuctionNotInSettlementPhase();
    error AuctionAlreadyCleared();
    error InvalidOrder();
    error OrderNotFound();
    error InvalidReveal();
    error InsufficientDeposit();
    error AlreadyRevealed();
    error NotOrderOwner();

    // ============ Structs ============

    /// @notice Represents a batch auction
    struct Auction {
        address token0;              // Base token
        address token1;              // Quote token
        uint256 collectionEndTime;   // End of order collection
        uint256 revealEndTime;       // End of reveal phase
        uint256 settlementEndTime;   // End of settlement
        uint256 clearingPrice;       // Uniform clearing price (token1 per token0, scaled by 1e18)
        uint256 totalBidVolume;      // Total bid volume revealed
        uint256 totalAskVolume;      // Total ask volume revealed
        uint256 matchedVolume;       // Total matched volume
        bool cleared;                // Whether auction has been cleared
        uint256 orderCount;          // Number of orders
    }

    /// @notice Represents an order in the auction
    struct Order {
        address trader;              // Order owner
        bytes32 commitment;          // Hash of order details
        bool isBid;                  // true = buy token0, false = sell token0
        uint256 amount;              // Amount of token0 (revealed)
        uint256 limitPrice;          // Limit price in token1 per token0 (revealed)
        uint256 deposit;             // Deposited collateral
        bool revealed;               // Whether order has been revealed
        bool filled;                 // Whether order has been filled
        uint256 filledAmount;        // Amount actually filled
    }

    // ============ Constants ============

    /// @notice Price precision (1e18)
    uint256 public constant PRICE_PRECISION = 1e18;

    /// @notice Minimum auction duration
    uint256 public constant MIN_COLLECTION_PERIOD = 60; // 1 minute

    /// @notice Reveal period duration
    uint256 public constant REVEAL_PERIOD = 60; // 1 minute

    /// @notice Settlement period duration
    uint256 public constant SETTLEMENT_PERIOD = 120; // 2 minutes

    // ============ State Variables ============

    /// @notice Current auction ID
    uint256 public currentAuctionId;

    /// @notice Mapping from auction ID to auction data
    mapping(uint256 => Auction) public auctions;

    /// @notice Mapping from auction ID => order ID => order
    mapping(uint256 => mapping(uint256 => Order)) public orders;

    /// @notice Operator address
    address public operator;

    // ============ Constructor ============

    constructor() {
        operator = msg.sender;
    }

    // ============ Auction Management ============

    /// @notice Create a new batch auction
    /// @param token0 The base token address
    /// @param token1 The quote token address
    /// @param collectionDuration Duration of collection phase in seconds
    /// @return auctionId The ID of the created auction
    function createAuction(
        address token0,
        address token1,
        uint256 collectionDuration
    ) external returns (uint256 auctionId) {
        require(token0 != address(0) && token1 != address(0), "Invalid tokens");
        require(collectionDuration >= MIN_COLLECTION_PERIOD, "Duration too short");

        currentAuctionId++;
        auctionId = currentAuctionId;

        uint256 collectionEnd = block.timestamp + collectionDuration;
        uint256 revealEnd = collectionEnd + REVEAL_PERIOD;
        uint256 settlementEnd = revealEnd + SETTLEMENT_PERIOD;

        auctions[auctionId] = Auction({
            token0: token0,
            token1: token1,
            collectionEndTime: collectionEnd,
            revealEndTime: revealEnd,
            settlementEndTime: settlementEnd,
            clearingPrice: 0,
            totalBidVolume: 0,
            totalAskVolume: 0,
            matchedVolume: 0,
            cleared: false,
            orderCount: 0
        });

        emit AuctionCreated(auctionId, token0, token1, collectionEnd);

        return auctionId;
    }

    // ============ Order Functions ============

    /// @notice Submit a hidden order to an auction
    /// @param auctionId The auction ID
    /// @param isBid True for buy order, false for sell order
    /// @param commitment Hash of (trader, amount, limitPrice, salt)
    /// @param deposit Collateral amount (token1 for bids, token0 for asks)
    /// @return orderId The ID of the submitted order
    function submitOrder(
        uint256 auctionId,
        bool isBid,
        bytes32 commitment,
        uint256 deposit
    ) external nonReentrant returns (uint256 orderId) {
        Auction storage auction = auctions[auctionId];
        if (auction.token0 == address(0)) revert AuctionNotFound();
        if (block.timestamp > auction.collectionEndTime) revert AuctionNotInCollectionPhase();
        if (deposit == 0) revert InsufficientDeposit();

        // Transfer deposit
        address depositToken = isBid ? auction.token1 : auction.token0;
        IERC20(depositToken).safeTransferFrom(msg.sender, address(this), deposit);

        auction.orderCount++;
        orderId = auction.orderCount;

        orders[auctionId][orderId] = Order({
            trader: msg.sender,
            commitment: commitment,
            isBid: isBid,
            amount: 0,
            limitPrice: 0,
            deposit: deposit,
            revealed: false,
            filled: false,
            filledAmount: 0
        });

        emit OrderSubmitted(auctionId, orderId, msg.sender, isBid, commitment);

        return orderId;
    }

    /// @notice Reveal an order during reveal phase
    /// @param auctionId The auction ID
    /// @param orderId The order ID
    /// @param amount The order amount
    /// @param limitPrice The limit price
    /// @param salt The salt used in commitment
    function revealOrder(
        uint256 auctionId,
        uint256 orderId,
        uint256 amount,
        uint256 limitPrice,
        bytes32 salt
    ) external {
        Auction storage auction = auctions[auctionId];
        if (auction.token0 == address(0)) revert AuctionNotFound();
        if (block.timestamp <= auction.collectionEndTime) revert AuctionNotInRevealPhase();
        if (block.timestamp > auction.revealEndTime) revert AuctionNotInRevealPhase();

        Order storage order = orders[auctionId][orderId];
        if (order.trader == address(0)) revert OrderNotFound();
        if (order.trader != msg.sender) revert NotOrderOwner();
        if (order.revealed) revert AlreadyRevealed();

        // Verify commitment
        bytes32 expectedCommitment = keccak256(abi.encodePacked(
            msg.sender,
            amount,
            limitPrice,
            salt
        ));
        if (order.commitment != expectedCommitment) revert InvalidReveal();

        // Validate deposit covers the order
        if (order.isBid) {
            // Bid: deposit should cover amount * limitPrice / PRICE_PRECISION
            uint256 maxCost = (amount * limitPrice) / PRICE_PRECISION;
            if (order.deposit < maxCost) revert InsufficientDeposit();
        } else {
            // Ask: deposit should cover amount
            if (order.deposit < amount) revert InsufficientDeposit();
        }

        order.amount = amount;
        order.limitPrice = limitPrice;
        order.revealed = true;

        // Update auction volumes
        if (order.isBid) {
            auction.totalBidVolume += amount;
        } else {
            auction.totalAskVolume += amount;
        }

        emit OrderRevealed(auctionId, orderId, amount, limitPrice);
    }

    /// @notice Clear the auction and determine clearing price
    /// @param auctionId The auction ID
    function clearAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        if (auction.token0 == address(0)) revert AuctionNotFound();
        if (block.timestamp <= auction.revealEndTime) revert AuctionNotInSettlementPhase();
        if (auction.cleared) revert AuctionAlreadyCleared();

        // Calculate clearing price using uniform price auction mechanism
        // In a real implementation, this would iterate through all orders
        // to find the price where supply meets demand

        // Simplified: use volume-weighted average of revealed limit prices
        uint256 clearingPrice = _calculateClearingPrice(auctionId);

        auction.clearingPrice = clearingPrice;
        auction.cleared = true;

        // Calculate matched volume (minimum of bid and ask at clearing price)
        uint256 eligibleBidVolume = _getEligibleVolume(auctionId, true, clearingPrice);
        uint256 eligibleAskVolume = _getEligibleVolume(auctionId, false, clearingPrice);
        auction.matchedVolume = eligibleBidVolume < eligibleAskVolume
            ? eligibleBidVolume
            : eligibleAskVolume;

        emit AuctionCleared(
            auctionId,
            clearingPrice,
            auction.totalBidVolume,
            auction.totalAskVolume,
            auction.matchedVolume
        );
    }

    /// @notice Settle an individual order after auction clears
    /// @param auctionId The auction ID
    /// @param orderId The order ID
    function settleOrder(uint256 auctionId, uint256 orderId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        if (!auction.cleared) revert AuctionNotInSettlementPhase();

        Order storage order = orders[auctionId][orderId];
        if (order.trader == address(0)) revert OrderNotFound();
        if (order.filled) revert InvalidOrder();
        if (!order.revealed) {
            // Unrevealed orders get refunded
            _refundOrder(auction, order);
            return;
        }

        // Check if order is eligible at clearing price
        bool eligible;
        if (order.isBid) {
            eligible = order.limitPrice >= auction.clearingPrice;
        } else {
            eligible = order.limitPrice <= auction.clearingPrice;
        }

        if (!eligible) {
            // Ineligible orders get refunded
            _refundOrder(auction, order);
            return;
        }

        // Calculate fill amount (may be partial if oversubscribed)
        uint256 fillAmount = _calculateFillAmount(auctionId, auction, order);

        order.filled = true;
        order.filledAmount = fillAmount;

        // Execute the fill
        _executeFill(auctionId, auction, order, fillAmount);

        emit OrderFilled(
            auctionId,
            orderId,
            order.trader,
            fillAmount,
            auction.clearingPrice
        );
    }

    // ============ Internal Functions ============

    /// @notice Calculate clearing price for an auction
    function _calculateClearingPrice(uint256 auctionId) internal view returns (uint256) {
        Auction storage auction = auctions[auctionId];

        // Simplified clearing price calculation
        // In production, would use order book intersection
        uint256 totalWeightedBid = 0;
        uint256 totalWeightedAsk = 0;
        uint256 bidVolume = 0;
        uint256 askVolume = 0;

        for (uint256 i = 1; i <= auction.orderCount; i++) {
            Order storage order = orders[auctionId][i];
            if (!order.revealed) continue;

            if (order.isBid) {
                totalWeightedBid += order.amount * order.limitPrice;
                bidVolume += order.amount;
            } else {
                totalWeightedAsk += order.amount * order.limitPrice;
                askVolume += order.amount;
            }
        }

        // Use midpoint of volume-weighted averages
        uint256 avgBid = bidVolume > 0 ? totalWeightedBid / bidVolume : 0;
        uint256 avgAsk = askVolume > 0 ? totalWeightedAsk / askVolume : 0;

        if (avgBid == 0) return avgAsk;
        if (avgAsk == 0) return avgBid;

        return (avgBid + avgAsk) / 2;
    }

    /// @notice Get total volume eligible at a given price
    function _getEligibleVolume(
        uint256 auctionId,
        bool isBid,
        uint256 price
    ) internal view returns (uint256 volume) {
        Auction storage auction = auctions[auctionId];

        for (uint256 i = 1; i <= auction.orderCount; i++) {
            Order storage order = orders[auctionId][i];
            if (!order.revealed || order.isBid != isBid) continue;

            bool eligible;
            if (isBid) {
                eligible = order.limitPrice >= price;
            } else {
                eligible = order.limitPrice <= price;
            }

            if (eligible) {
                volume += order.amount;
            }
        }
    }

    /// @notice Calculate fill amount for an order
    /// @param auctionId The auction ID
    /// @param auction The auction storage reference
    /// @param order The order storage reference
    function _calculateFillAmount(
        uint256 auctionId,
        Auction storage auction,
        Order storage order
    ) internal view returns (uint256) {
        // Get total eligible volume for this side
        uint256 totalEligible = _getEligibleVolume(
            auctionId,
            order.isBid,
            auction.clearingPrice
        );

        if (totalEligible == 0) return 0;

        // Pro-rata fill if oversubscribed
        uint256 fillRatio = (auction.matchedVolume * PRICE_PRECISION) / totalEligible;
        if (fillRatio > PRICE_PRECISION) fillRatio = PRICE_PRECISION;

        return (order.amount * fillRatio) / PRICE_PRECISION;
    }

    /// @notice Refund an order
    function _refundOrder(Auction storage auction, Order storage order) internal {
        order.filled = true;
        order.filledAmount = 0;

        address refundToken = order.isBid ? auction.token1 : auction.token0;
        IERC20(refundToken).safeTransfer(order.trader, order.deposit);
    }

    /// @notice Execute a fill
    /// @param auctionId The auction ID (for event emission)
    /// @param auction The auction storage reference
    /// @param order The order storage reference
    /// @param fillAmount Amount of token0 being filled
    function _executeFill(
        uint256 auctionId,
        Auction storage auction,
        Order storage order,
        uint256 fillAmount
    ) internal {
        uint256 quoteAmount = (fillAmount * auction.clearingPrice) / PRICE_PRECISION;

        if (order.isBid) {
            // Buyer: receive token0, pay token1
            // Token0 comes from matched sellers who deposited it

            // Transfer token0 to buyer (the amount they purchased)
            if (fillAmount > 0) {
                IERC20(auction.token0).safeTransfer(order.trader, fillAmount);
            }

            // Refund excess token1 deposit (what they didn't spend)
            uint256 usedDeposit = quoteAmount;
            if (order.deposit > usedDeposit) {
                IERC20(auction.token1).safeTransfer(order.trader, order.deposit - usedDeposit);
            }
        } else {
            // Seller: receive token1, give token0
            // Token1 comes from matched buyers who deposited it

            // Transfer token1 to seller (payment for their token0)
            if (quoteAmount > 0) {
                IERC20(auction.token1).safeTransfer(order.trader, quoteAmount);
            }

            // Refund excess token0 deposit (what they didn't sell)
            if (order.deposit > fillAmount) {
                IERC20(auction.token0).safeTransfer(order.trader, order.deposit - fillAmount);
            }
        }

        // Silence unused variable warning
        auctionId;
    }

    // ============ View Functions ============

    /// @notice Generate commitment hash for an order
    function generateCommitment(
        address trader,
        uint256 amount,
        uint256 limitPrice,
        bytes32 salt
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(trader, amount, limitPrice, salt));
    }

    /// @notice Get auction phase
    /// @return 0=not started, 1=collection, 2=reveal, 3=settlement, 4=completed
    function getAuctionPhase(uint256 auctionId) external view returns (uint8) {
        Auction storage auction = auctions[auctionId];
        if (auction.token0 == address(0)) return 0;

        if (block.timestamp <= auction.collectionEndTime) return 1;
        if (block.timestamp <= auction.revealEndTime) return 2;
        if (block.timestamp <= auction.settlementEndTime) return 3;
        return 4;
    }

    /// @notice Get auction info
    function getAuction(uint256 auctionId) external view returns (Auction memory) {
        return auctions[auctionId];
    }

    /// @notice Get order info
    function getOrder(uint256 auctionId, uint256 orderId) external view returns (Order memory) {
        return orders[auctionId][orderId];
    }
}
