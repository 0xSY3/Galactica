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

/// @title TippingPool
/// @notice Community tipping pool for Rumble creator monetization via multi-agent system
/// @dev Agents are authorized to execute tips on behalf of fans
contract TippingPool {
    // --- Custom Errors ---
    error ZeroAmount();
    error ZeroAddress();
    error InsufficientBalance();
    error NotOwner();
    error NotAgent();
    error AgentAlreadyAuthorized();
    error AgentNotAuthorized();
    error ArrayLengthMismatch();
    error TransferFailed();
    error SharesSumMismatch();

    // --- State ---
    IERC20 public immutable usdt;
    address public owner;

    mapping(address => uint256) public fanBalances;
    mapping(address => uint256) public creatorEarnings;
    mapping(address => bool) public authorizedAgents;

    /// @dev Milestone threshold — emits MilestoneReached when a creator's cumulative tips exceed this
    uint256 public milestoneThreshold;
    mapping(address => bool) private _milestoneReached;

    uint256 public totalTipped;

    // --- Events ---
    event PoolDeposited(address indexed fan, uint256 amount);
    event Tipped(address indexed fan, address indexed creator, uint256 amount, string reason);
    event BatchTipped(address indexed agent, uint256 creatorCount, uint256 totalAmount);
    event TipSplit(address indexed agent, uint256 creatorCount, uint256 totalAmount);
    event FundsWithdrawn(address indexed fan, uint256 amount);
    event AgentAdded(address indexed agent);
    event AgentRemoved(address indexed agent);
    event MilestoneReached(address indexed creator, uint256 totalEarnings);
    event MilestoneThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
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

    constructor(address _usdt, uint256 _milestoneThreshold) {
        usdt = IERC20(_usdt);
        owner = msg.sender;
        milestoneThreshold = _milestoneThreshold;
    }

    /// @notice Deposit USDT into the tipping pool
    /// @param amount Amount of USDT to deposit
    function depositToPool(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        fanBalances[msg.sender] += amount;

        emit PoolDeposited(msg.sender, amount);

        bool success = usdt.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
    }

    /// @notice Tip a creator from the caller's pool balance (agent-only)
    /// @param creator Address of the content creator
    /// @param amount Tip amount in USDT
    /// @param reason Description of why this creator is being tipped
    function tip(address creator, uint256 amount, string calldata reason) external onlyAgent {
        if (creator == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (usdt.balanceOf(address(this)) < amount) revert InsufficientBalance();

        creatorEarnings[creator] += amount;
        totalTipped += amount;

        emit Tipped(msg.sender, creator, amount, reason);
        _checkMilestone(creator);

        bool success = usdt.transfer(creator, amount);
        if (!success) revert TransferFailed();
    }

    /// @notice Batch-tip multiple creators in a single transaction (agent-only)
    /// @param creators Array of creator addresses
    /// @param amounts Array of tip amounts (must match creators length)
    function tipBatch(address[] calldata creators, uint256[] calldata amounts) external onlyAgent {
        if (creators.length != amounts.length) revert ArrayLengthMismatch();

        uint256 totalAmount;
        for (uint256 i; i < creators.length;) {
            if (creators[i] == address(0)) revert ZeroAddress();
            if (amounts[i] == 0) revert ZeroAmount();

            creatorEarnings[creators[i]] += amounts[i];
            totalAmount += amounts[i];
            _checkMilestone(creators[i]);

            unchecked { ++i; }
        }

        if (usdt.balanceOf(address(this)) < totalAmount) revert InsufficientBalance();
        totalTipped += totalAmount;

        emit BatchTipped(msg.sender, creators.length, totalAmount);

        for (uint256 i; i < creators.length;) {
            bool success = usdt.transfer(creators[i], amounts[i]);
            if (!success) revert TransferFailed();
            unchecked { ++i; }
        }
    }

    /// @notice Split a tip among collaborating creators by share weights (agent-only)
    /// @param creators Array of creator addresses
    /// @param shares Relative share weights per creator (must sum to totalAmount)
    /// @param totalAmount Total USDT to distribute
    function tipSplit(
        address[] calldata creators,
        uint256[] calldata shares,
        uint256 totalAmount
    ) external onlyAgent {
        if (creators.length != shares.length) revert ArrayLengthMismatch();
        if (totalAmount == 0) revert ZeroAmount();
        if (usdt.balanceOf(address(this)) < totalAmount) revert InsufficientBalance();

        uint256 sharesSum;
        for (uint256 i; i < shares.length;) {
            sharesSum += shares[i];
            unchecked { ++i; }
        }
        if (sharesSum != totalAmount) revert SharesSumMismatch();

        totalTipped += totalAmount;

        for (uint256 i; i < creators.length;) {
            if (creators[i] == address(0)) revert ZeroAddress();
            creatorEarnings[creators[i]] += shares[i];
            _checkMilestone(creators[i]);
            unchecked { ++i; }
        }

        emit TipSplit(msg.sender, creators.length, totalAmount);

        for (uint256 i; i < creators.length;) {
            bool success = usdt.transfer(creators[i], shares[i]);
            if (!success) revert TransferFailed();
            unchecked { ++i; }
        }
    }

    /// @notice Withdraw unused funds from the pool
    /// @param amount Amount to withdraw
    function withdrawUnused(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (fanBalances[msg.sender] < amount) revert InsufficientBalance();

        fanBalances[msg.sender] -= amount;

        emit FundsWithdrawn(msg.sender, amount);

        bool success = usdt.transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
    }

    /// @notice Get total cumulative tips received by a creator
    /// @param creator Creator address to query
    /// @return Total USDT earned from tips
    function getCreatorEarnings(address creator) external view returns (uint256) {
        return creatorEarnings[creator];
    }

    /// @notice Get a fan's available pool balance
    /// @param fan Fan address to query
    /// @return Available USDT balance
    function getPoolBalance(address fan) external view returns (uint256) {
        return fanBalances[fan];
    }

    /// @notice Authorize an agent to execute tips (owner-only)
    /// @param agent Address to authorize
    function addAgent(address agent) external onlyOwner {
        if (agent == address(0)) revert ZeroAddress();
        if (authorizedAgents[agent]) revert AgentAlreadyAuthorized();

        authorizedAgents[agent] = true;
        emit AgentAdded(agent);
    }

    /// @notice Revoke an agent's tip authorization (owner-only)
    /// @param agent Address to revoke
    function removeAgent(address agent) external onlyOwner {
        if (!authorizedAgents[agent]) revert AgentNotAuthorized();

        authorizedAgents[agent] = false;
        emit AgentRemoved(agent);
    }

    /// @notice Update the milestone threshold (owner-only)
    /// @param newThreshold New cumulative tip threshold for milestone events
    function setMilestoneThreshold(uint256 newThreshold) external onlyOwner {
        uint256 old = milestoneThreshold;
        milestoneThreshold = newThreshold;
        emit MilestoneThresholdUpdated(old, newThreshold);
    }

    /// @notice Transfer ownership of the contract
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address old = owner;
        owner = newOwner;
        emit OwnershipTransferred(old, newOwner);
    }

    /// @dev Emits MilestoneReached if creator crosses threshold for the first time
    function _checkMilestone(address creator) internal {
        if (
            milestoneThreshold > 0 &&
            !_milestoneReached[creator] &&
            creatorEarnings[creator] >= milestoneThreshold
        ) {
            _milestoneReached[creator] = true;
            emit MilestoneReached(creator, creatorEarnings[creator]);
        }
    }
}
