// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";
import {IERC20} from "./interfaces/IERC20.sol";

/**
 * @title OptionVault
 * @notice Fully-collateralised, single-leg, cash-settled options — built for
 *         Arc (USDC is the gas token + quote asset). Two retail strategies:
 *
 *           CASH_SECURED_PUT  — lock USDC (strike×size), earn premium upfront.
 *           COVERED_CALL      — lock the underlying (WETH), earn premium upfront.
 *
 *         Prices/settlement come from a Chainlink-compatible feed
 *         (AggregatorV3Interface). The protocol treasury is the counterparty:
 *         it pays the premium upfront and collects the payoff if assigned.
 *         No margin, no liquidations — the worst case is always pre-funded.
 *
 * @dev Units: feed price has `feed.decimals()` (Chainlink: 8). `size` is 1e18
 *      per underlying unit. `strike` is quoted in feed decimals (USD * 1e8).
 *      USDC is 6 decimals.
 */
contract OptionVault {
    enum Kind { CASH_SECURED_PUT, COVERED_CALL }

    struct Market {
        AggregatorV3Interface feed; // price oracle (Chainlink or mock)
        IERC20 underlying;          // ERC20 used as covered-call collateral (e.g. WETH)
        uint16 aprBps;              // protocol-set yield used to price the premium
        bool enabled;
    }

    struct Position {
        address writer;
        Kind kind;
        uint8 marketId;
        uint256 strike;           // feed decimals
        uint256 size;             // 1e18 per unit
        uint256 collateral;       // locked amount (USDC for put, underlying for call)
        uint256 premium;          // USDC paid upfront
        uint64 openedAt;
        uint64 expiry;
        bool settled;
    }

    IERC20 public immutable usdc; // 6 decimals
    address public owner;
    uint8 public marketCount;

    mapping(uint8 => Market) public markets;
    Position[] public positions;

    uint256 internal constant YEAR = 365 days;

    event MarketAdded(uint8 id, address feed, address underlying, uint16 aprBps);
    event Opened(uint256 indexed id, address indexed writer, Kind kind, uint8 marketId, uint256 premium);
    event Settled(uint256 indexed id, int256 spot, uint256 payoffToTreasury, uint256 returnedToWriter);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
        owner = msg.sender;
    }

    // ─── Admin ──────────────────────────────────────────────────────────
    function addMarket(address feed, address underlying, uint16 aprBps) external onlyOwner returns (uint8 id) {
        id = marketCount++;
        markets[id] = Market(AggregatorV3Interface(feed), IERC20(underlying), aprBps, true);
        emit MarketAdded(id, feed, underlying, aprBps);
    }

    function setMarketApr(uint8 id, uint16 aprBps) external onlyOwner {
        markets[id].aprBps = aprBps;
    }

    /// @notice Fund the treasury (premiums are paid from here). Pull `amount` of `token`.
    function fund(address token, uint256 amount) external {
        _pull(IERC20(token), msg.sender, amount);
    }

    // ─── Pricing helpers ────────────────────────────────────────────────
    function _spot(Market storage m) internal view returns (uint256) {
        (, int256 answer,,,) = m.feed.latestRoundData();
        require(answer > 0, "bad price");
        return uint256(answer); // feed decimals
    }

    /// USD value (in feed decimals) of `size` units at `price`.
    function _notional(uint256 price, uint256 size) internal pure returns (uint256) {
        return (price * size) / 1e18;
    }

    /// Convert a USD amount expressed in `feedDecimals` to 6-decimal USDC.
    function _usdToUsdc(uint256 usdAmount, uint8 feedDecimals) internal pure returns (uint256) {
        return (usdAmount * 1e6) / (10 ** feedDecimals);
    }

    /// premium (USDC) = collateralUsdc * aprBps/10000 * duration/year
    function _premium(uint256 collateralUsdc, uint16 aprBps, uint256 duration) internal pure returns (uint256) {
        return (collateralUsdc * aprBps * duration) / (10_000 * YEAR);
    }

    // ─── Quotes (view) ──────────────────────────────────────────────────
    /// @return collateral required, premium paid upfront, for a put.
    function quoteCashSecuredPut(uint8 marketId, uint256 strike, uint256 size, uint64 expiry)
        public
        view
        returns (uint256 collateral, uint256 premium)
    {
        Market storage m = markets[marketId];
        uint8 d = m.feed.decimals();
        collateral = _usdToUsdc(_notional(strike, size), d); // strike×size in USDC
        premium = _premium(collateral, m.aprBps, expiry - block.timestamp);
    }

    /// @return collateral (underlying) required, premium (USDC) for a covered call.
    function quoteCoveredCall(uint8 marketId, uint256 size, uint64 expiry)
        public
        view
        returns (uint256 collateral, uint256 premium)
    {
        Market storage m = markets[marketId];
        uint8 d = m.feed.decimals();
        collateral = size; // 1 underlying per unit
        uint256 notionalUsdc = _usdToUsdc(_notional(_spot(m), size), d);
        premium = _premium(notionalUsdc, m.aprBps, expiry - block.timestamp);
    }

    // ─── Open positions ─────────────────────────────────────────────────
    function openCashSecuredPut(uint8 marketId, uint256 strike, uint256 size, uint64 expiry)
        external
        returns (uint256 id)
    {
        Market storage m = markets[marketId];
        require(m.enabled, "market");
        require(expiry > block.timestamp, "expiry");

        (uint256 collateral, uint256 premium) = quoteCashSecuredPut(marketId, strike, size, expiry);

        _pull(usdc, msg.sender, collateral);    // writer locks USDC collateral
        _push(usdc, msg.sender, premium);       // treasury pays premium upfront

        id = _record(msg.sender, Kind.CASH_SECURED_PUT, marketId, strike, size, collateral, premium, expiry);
    }

    function openCoveredCall(uint8 marketId, uint256 strike, uint256 size, uint64 expiry)
        external
        returns (uint256 id)
    {
        Market storage m = markets[marketId];
        require(m.enabled, "market");
        require(expiry > block.timestamp, "expiry");

        (uint256 collateral, uint256 premium) = quoteCoveredCall(marketId, size, expiry);

        _pull(m.underlying, msg.sender, collateral); // writer locks the underlying
        _push(usdc, msg.sender, premium);            // treasury pays premium upfront

        id = _record(msg.sender, Kind.COVERED_CALL, marketId, strike, size, collateral, premium, expiry);
    }

    // ─── Settlement ─────────────────────────────────────────────────────
    function settle(uint256 id) external {
        Position storage p = positions[id];
        require(!p.settled, "settled");
        require(block.timestamp >= p.expiry, "not expired");
        p.settled = true;

        Market storage m = markets[p.marketId];
        uint256 spot = _spot(m);
        uint8 d = m.feed.decimals();

        uint256 payoff; // taken from collateral, kept by treasury
        uint256 returned;

        if (p.kind == Kind.CASH_SECURED_PUT) {
            // ITM if spot < strike → writer owes (strike-spot)*size, in USDC
            if (spot < p.strike) {
                uint256 owedUsdc = _usdToUsdc(_notional(p.strike - spot, p.size), d);
                payoff = owedUsdc > p.collateral ? p.collateral : owedUsdc;
            }
            returned = p.collateral - payoff;
            if (returned > 0) _push(usdc, p.writer, returned);
            // payoff stays in the contract (treasury)
        } else {
            // COVERED_CALL: ITM if spot > strike → writer owes (spot-strike)*size USD,
            // settled in the underlying collateral at the current price.
            if (spot > p.strike) {
                uint256 owedUsd = _notional(spot - p.strike, p.size); // feed decimals
                uint256 underlyingOwed = (owedUsd * 1e18) / spot;     // back to 1e18 units
                payoff = underlyingOwed > p.collateral ? p.collateral : underlyingOwed;
            }
            returned = p.collateral - payoff;
            if (returned > 0) _push(m.underlying, p.writer, returned);
        }

        emit Settled(id, int256(spot), payoff, returned);
    }

    // ─── Views ──────────────────────────────────────────────────────────
    function positionsLength() external view returns (uint256) {
        return positions.length;
    }

    // ─── Internal ───────────────────────────────────────────────────────
    function _record(
        address writer,
        Kind kind,
        uint8 marketId,
        uint256 strike,
        uint256 size,
        uint256 collateral,
        uint256 premium,
        uint64 expiry
    ) internal returns (uint256 id) {
        id = positions.length;
        positions.push(
            Position(writer, kind, marketId, strike, size, collateral, premium, uint64(block.timestamp), expiry, false)
        );
        emit Opened(id, writer, kind, marketId, premium);
    }

    function _pull(IERC20 token, address from, uint256 amount) internal {
        require(token.transferFrom(from, address(this), amount), "pull");
    }

    function _push(IERC20 token, address to, uint256 amount) internal {
        require(token.transfer(to, amount), "push");
    }
}
