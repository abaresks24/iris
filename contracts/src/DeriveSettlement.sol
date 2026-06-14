// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/**
 * @title DeriveSettlement
 * @notice On-chain settlement layer for options matched on Derive's orderbook.
 *
 *         Derive does the hard part off-chain — order signing, the matching
 *         engine, the maker that fills the user — and that all works. The ONE
 *         piece that can't finalise on Derive's testnet (its on-chain margin
 *         settlement reverts inside an unmaintained price feed) is reproduced
 *         here, on Arc, where Chainlink feeds are live and we control the code.
 *
 *         So the flow is:
 *           1. user order  →  signed + matched on Derive  (real fill, real fee)
 *           2. backend calls `record(...)` here with the matched fill
 *              →  a REAL on-chain settlement tx that SUCCEEDS (the trace)
 *           3. at expiry `settle(id)` reads the Chainlink feed and books the
 *              cash-settled payoff, paid from the protocol treasury.
 *
 * @dev Units mirror OptionVault: `strike` in feed decimals (USD*1e8), `size`
 *      1e18 per underlying unit, `premium`/USDC amounts 6 decimals. This is a
 *      treasury-backed clearing record — it does not custody user collateral
 *      (that lives on Derive); it makes the matched position real on Arc.
 */
contract DeriveSettlement {
    enum Kind {
        CASH_SECURED_PUT, // user SELLS a put   (short put)
        COVERED_CALL,     // user SELLS a call  (short call)
        LONG_CALL         // user BUYS a call   (long call)
    }

    struct Fill {
        address trader;          // the connected (Privy) wallet the fill is booked to
        Kind kind;
        AggregatorV3Interface feed; // settlement oracle for this underlying
        string instrument;       // Derive instrument name, e.g. "ETH-20260703-1800-P"
        bytes32 deriveTradeId;   // Derive matcher trade_id — links back to the off-chain fill
        uint256 strike;          // feed decimals (1e8)
        uint256 size;            // 1e18 per unit
        uint256 tradePrice;      // executed premium per unit, USDC (6 dec)
        uint256 premium;         // total premium, USDC (6 dec)
        uint64 expiry;           // unix seconds
        uint64 recordedAt;
        int256 settleSpot;       // feed answer captured at settlement (feed decimals)
        uint256 payoff;          // cash payoff to the trader at settlement, USDC (6 dec)
        bool settled;
    }

    IERC20 public immutable usdc; // 6 decimals — treasury asset
    address public owner;         // backend signer (deployer key)

    Fill[] public fills;
    mapping(address => uint256[]) internal _byTrader;

    event Recorded(
        uint256 indexed id,
        address indexed trader,
        bytes32 indexed deriveTradeId,
        Kind kind,
        string instrument,
        uint256 strike,
        uint256 size,
        uint256 premium,
        uint64 expiry
    );
    event Settled(uint256 indexed id, int256 spot, uint256 payoff);
    event TreasuryFunded(address indexed from, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        owner = msg.sender;
    }

    function setOwner(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    /// @notice Top up the treasury that backs settlement payoffs.
    function fund(uint256 amount) external {
        require(usdc.transferFrom(msg.sender, address(this), amount), "pull");
        emit TreasuryFunded(msg.sender, amount);
    }

    /**
     * @notice Record a Derive-matched fill on-chain. This is the settlement
     *         trace: it succeeds on Arc where Derive's testnet settlement reverts.
     * @param trader        wallet the position is booked to (the connected user)
     * @param kind          strategy type
     * @param feed          Chainlink-compatible feed used to settle at expiry
     * @param instrument    Derive instrument name (for display / audit)
     * @param deriveTradeId Derive matcher trade_id
     * @param strike        strike in feed decimals (1e8)
     * @param size          size in 1e18
     * @param tradePrice    executed premium per unit, USDC (6 dec)
     * @param premium       total premium, USDC (6 dec)
     * @param expiry        unix expiry
     */
    function record(
        address trader,
        Kind kind,
        address feed,
        string calldata instrument,
        bytes32 deriveTradeId,
        uint256 strike,
        uint256 size,
        uint256 tradePrice,
        uint256 premium,
        uint64 expiry
    ) external onlyOwner returns (uint256 id) {
        require(trader != address(0), "trader");
        require(feed != address(0), "feed");
        require(expiry > block.timestamp, "expiry");

        id = fills.length;
        fills.push(
            Fill({
                trader: trader,
                kind: kind,
                feed: AggregatorV3Interface(feed),
                instrument: instrument,
                deriveTradeId: deriveTradeId,
                strike: strike,
                size: size,
                tradePrice: tradePrice,
                premium: premium,
                expiry: expiry,
                recordedAt: uint64(block.timestamp),
                settleSpot: 0,
                payoff: 0,
                settled: false
            })
        );
        _byTrader[trader].push(id);

        emit Recorded(id, trader, deriveTradeId, kind, instrument, strike, size, premium, expiry);
    }

    /// @notice Settle a recorded fill at/after expiry using the Chainlink feed.
    ///         Cash-settled: the trader's intrinsic payoff is paid from treasury
    ///         (capped by the treasury balance for a self-funded demo).
    function settle(uint256 id) external {
        Fill storage f = fills[id];
        require(!f.settled, "settled");
        require(block.timestamp >= f.expiry, "not expired");

        (, int256 answer,,,) = f.feed.latestRoundData();
        require(answer > 0, "bad price");
        uint256 spot = uint256(answer);
        uint8 d = f.feed.decimals();

        uint256 intrinsicUsdc = _traderIntrinsic(f, spot, d);

        f.settled = true;
        f.settleSpot = answer;
        f.payoff = intrinsicUsdc;

        if (intrinsicUsdc > 0) {
            uint256 bal = usdc.balanceOf(address(this));
            uint256 pay = intrinsicUsdc > bal ? bal : intrinsicUsdc;
            if (pay > 0) require(usdc.transfer(f.trader, pay), "push");
        }

        emit Settled(id, answer, intrinsicUsdc);
    }

    // ─── Views ──────────────────────────────────────────────────────────

    function fillsLength() external view returns (uint256) {
        return fills.length;
    }

    function traderFills(address trader) external view returns (uint256[] memory) {
        return _byTrader[trader];
    }

    /// @notice Live intrinsic value (USDC, 6 dec) the trader would collect if
    ///         settled at the current feed price — for portfolio mark-to-market.
    function markIntrinsic(uint256 id) external view returns (uint256) {
        Fill storage f = fills[id];
        (, int256 answer,,,) = f.feed.latestRoundData();
        if (answer <= 0) return 0;
        return _traderIntrinsic(f, uint256(answer), f.feed.decimals());
    }

    // ─── Internal ───────────────────────────────────────────────────────

    /// Intrinsic cash value owed TO the trader at `spot`, in USDC (6 dec).
    function _traderIntrinsic(Fill storage f, uint256 spot, uint8 d) internal view returns (uint256) {
        if (f.kind == Kind.LONG_CALL) {
            // long call: gains (spot - strike) per unit when ITM
            if (spot > f.strike) return _usdToUsdc((spot - f.strike) * f.size / 1e18, d);
            return 0;
        }
        if (f.kind == Kind.COVERED_CALL) {
            // short call: trader (writer) OWES (spot - strike) when ITM → no cash to them
            return 0;
        }
        // CASH_SECURED_PUT: short put → writer OWES (strike - spot) when ITM → no cash to them
        return 0;
    }

    function _usdToUsdc(uint256 usdAmount, uint8 feedDecimals) internal pure returns (uint256) {
        return (usdAmount * 1e6) / (10 ** feedDecimals);
    }
}
