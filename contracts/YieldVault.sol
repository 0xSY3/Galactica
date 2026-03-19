// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title YieldVault
/// @notice Vault that agents use to optimize USDT yield across DeFi protocols
/// @dev Share-based accounting — depositors receive shares proportional to vault assets
contract YieldVault {
    // --- Custom Errors ---
    error ZeroAmount();
    error ZeroAddress();
    error ZeroShares();
    error InsufficientShares();
    error InsufficientAssets();
    error NotOwner();
    error NotAgent();
    error AgentAlreadyAuthorized();
    error AgentNotAuthorized();
    error TransferFailed();

    // --- Types ---
    struct YieldReport {
        uint256 timestamp;
        uint256 profit;
        uint256 performanceFee;
    }

    // --- State ---
    IERC20 public immutable usdt;
    address public owner;
    address public treasury;

    mapping(address => uint256) public balanceOf;
    uint256 public totalShares;
    uint256 public totalAssets;

    mapping(address => bool) public authorizedAgents;
    /// @dev Tracks how much USDT is allocated to each external protocol
    mapping(address => uint256) public protocolAllocations;

    YieldReport[] public yieldHistory;

    /// @dev 10% of yield goes to treasury (1000 bps)
    uint256 public constant PERFORMANCE_FEE_BPS = 1_000;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // --- Events ---
    event Deposited(address indexed depositor, uint256 assets, uint256 shares);
    event Withdrawn(address indexed withdrawer, uint256 shares, uint256 assets);
    event Rebalanced(address indexed agent, address indexed protocol, uint256 amount);
    event YieldReported(address indexed agent, uint256 profit, uint256 performanceFee);
    event AgentAdded(address indexed agent);
    event AgentRemoved(address indexed agent);
    event EmergencyWithdrawal(address indexed owner, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    // --- Modifiers ---
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAgent() {
        if (!authorizedAgents[msg.sender]) revert NotAgent();
        _;
    }

    constructor(address _usdt, address _treasury) {
        usdt = IERC20(_usdt);
        owner = msg.sender;
        treasury = _treasury;
    }

    /// @notice Deposit USDT into the vault and receive shares
    /// @param amount Amount of USDT to deposit
    /// @return shares Number of shares minted
    function deposit(uint256 amount) external returns (uint256 shares) {
        if (amount == 0) revert ZeroAmount();

        shares = _convertToShares(amount);
        if (shares == 0) revert ZeroShares();

        balanceOf[msg.sender] += shares;
        totalShares += shares;
        totalAssets += amount;

        emit Deposited(msg.sender, amount, shares);

        bool success = usdt.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
    }

    /// @notice Withdraw USDT by burning vault shares
    /// @param shares Number of shares to burn
    /// @return assets Amount of USDT returned
    function withdraw(uint256 shares) external returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        if (balanceOf[msg.sender] < shares) revert InsufficientShares();

        assets = _convertToAssets(shares);

        uint256 available = usdt.balanceOf(address(this));
        if (assets > available) revert InsufficientAssets();

        balanceOf[msg.sender] -= shares;
        totalShares -= shares;
        totalAssets -= assets;

        emit Withdrawn(msg.sender, shares, assets);

        bool success = usdt.transfer(msg.sender, assets);
        if (!success) revert TransferFailed();
    }

    /// @notice Move vault funds to a higher-yield protocol (agent-only)
    /// @param newProtocol Address of the target protocol
    /// @param amount Amount of USDT to allocate
    function rebalance(address newProtocol, uint256 amount) external onlyAgent {
        if (newProtocol == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        uint256 available = usdt.balanceOf(address(this));
        if (amount > available) revert InsufficientAssets();

        protocolAllocations[newProtocol] += amount;

        emit Rebalanced(msg.sender, newProtocol, amount);

        bool success = usdt.transfer(newProtocol, amount);
        if (!success) revert TransferFailed();
    }

    /// @notice Report yield earned from protocol allocations (agent-only)
    /// @dev 10% performance fee is deducted and sent to treasury
    /// @param profit Gross profit amount in USDT (must already be in the vault)
    function reportYield(uint256 profit) external onlyAgent {
        if (profit == 0) revert ZeroAmount();

        uint256 fee = (profit * PERFORMANCE_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netProfit = profit - fee;

        totalAssets += netProfit;

        yieldHistory.push(YieldReport({
            timestamp: block.timestamp,
            profit: profit,
            performanceFee: fee
        }));

        emit YieldReported(msg.sender, profit, fee);

        if (fee > 0) {
            bool success = usdt.transfer(treasury, fee);
            if (!success) revert TransferFailed();
        }
    }

    /// @notice Current price per share (scaled by 1e18)
    /// @return price Share price in USDT, scaled by 1e18
    function getSharePrice() external view returns (uint256 price) {
        if (totalShares == 0) return 1e18;
        return (totalAssets * 1e18) / totalShares;
    }

    /// @notice Get aggregate vault statistics
    /// @return _totalAssets Total USDT under management
    /// @return _totalShares Total outstanding shares
    /// @return _availableAssets USDT held directly by the vault
    function getVaultStats()
        external
        view
        returns (uint256 _totalAssets, uint256 _totalShares, uint256 _availableAssets)
    {
        return (totalAssets, totalShares, usdt.balanceOf(address(this)));
    }

    /// @notice Get the number of yield reports
    /// @return count Length of yield history
    function getYieldHistoryLength() external view returns (uint256 count) {
        return yieldHistory.length;
    }

    /// @notice Emergency withdrawal of all vault USDT to owner (owner-only)
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = usdt.balanceOf(address(this));
        if (balance == 0) revert InsufficientAssets();

        emit EmergencyWithdrawal(msg.sender, balance);

        bool success = usdt.transfer(owner, balance);
        if (!success) revert TransferFailed();
    }

    /// @notice Authorize an agent to rebalance and report yield (owner-only)
    /// @param agent Address to authorize
    function addAgent(address agent) external onlyOwner {
        if (agent == address(0)) revert ZeroAddress();
        if (authorizedAgents[agent]) revert AgentAlreadyAuthorized();

        authorizedAgents[agent] = true;
        emit AgentAdded(agent);
    }

    /// @notice Revoke an agent's authorization (owner-only)
    /// @param agent Address to revoke
    function removeAgent(address agent) external onlyOwner {
        if (!authorizedAgents[agent]) revert AgentNotAuthorized();

        authorizedAgents[agent] = false;
        emit AgentRemoved(agent);
    }

    /// @notice Update treasury address (owner-only)
    /// @param newTreasury New treasury address
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        address old = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(old, newTreasury);
    }

    /// @notice Transfer ownership of the contract
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address old = owner;
        owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }

    /// @dev Convert USDT amount to shares based on current ratio
    function _convertToShares(uint256 assets) internal view returns (uint256) {
        if (totalShares == 0 || totalAssets == 0) return assets;
        return (assets * totalShares) / totalAssets;
    }

    /// @dev Convert shares to USDT amount based on current ratio
    function _convertToAssets(uint256 shares) internal view returns (uint256) {
        if (totalShares == 0) return 0;
        return (shares * totalAssets) / totalShares;
    }
}
