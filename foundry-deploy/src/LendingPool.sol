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

/// @title LendingPool
/// @notice Peer-to-peer lending pool where agents deposit USDT and lend to borrowers
/// @dev Uses fixed 5% APR, CEI pattern on all external calls
contract LendingPool {
    // --- Custom Errors ---
    error ZeroAmount();
    error InsufficientBalance();
    error InsufficientPoolLiquidity();
    error LoanNotFound();
    error LoanAlreadyApproved();
    error LoanAlreadyRepaid();
    error LoanNotApproved();
    error NotBorrower();
    error NotCoordinator();
    error TransferFailed();
    error InvalidDuration();

    // --- Types ---
    struct Loan {
        address borrower;
        uint256 amount;
        uint256 interestRate; // basis points (500 = 5%)
        uint256 startTime;
        uint256 duration; // seconds
        bool repaid;
        bool approved;
    }

    // --- State ---
    IERC20 public immutable usdt;
    address public coordinator;

    mapping(address => uint256) public lenderDeposits;
    mapping(uint256 => Loan) public loans;
    uint256 public nextLoanId;

    uint256 public totalDeposited;
    uint256 public totalLent;

    /// @dev 5% APR in basis points
    uint256 public constant INTEREST_RATE_BPS = 500;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // --- Events ---
    event Deposited(address indexed lender, uint256 amount);
    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 durationDays);
    event LoanApproved(uint256 indexed loanId, address indexed approver);
    event LoanRepaid(uint256 indexed loanId, uint256 principal, uint256 interest);
    event Withdrawn(address indexed lender, uint256 amount);
    event CoordinatorUpdated(address indexed oldCoordinator, address indexed newCoordinator);

    // --- Modifiers ---
    modifier onlyCoordinator() {
        if (msg.sender != coordinator) revert NotCoordinator();
        _;
    }

    constructor(address _usdt, address _coordinator) {
        usdt = IERC20(_usdt);
        coordinator = _coordinator;
    }

    /// @notice Deposit USDT into the lending pool
    /// @param amount Amount of USDT to deposit
    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        lenderDeposits[msg.sender] += amount;
        totalDeposited += amount;

        emit Deposited(msg.sender, amount);

        bool success = usdt.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();
    }

    /// @notice Request a loan from the pool
    /// @param amount Loan amount in USDT
    /// @param durationDays Loan duration in days
    /// @return loanId The ID of the created loan
    function requestLoan(uint256 amount, uint256 durationDays) external returns (uint256 loanId) {
        if (amount == 0) revert ZeroAmount();
        if (durationDays == 0) revert InvalidDuration();

        loanId = nextLoanId++;

        loans[loanId] = Loan({
            borrower: msg.sender,
            amount: amount,
            interestRate: INTEREST_RATE_BPS,
            startTime: 0,
            duration: durationDays * 1 days,
            repaid: false,
            approved: false
        });

        emit LoanRequested(loanId, msg.sender, amount, durationDays);
    }

    /// @notice Approve a pending loan and disburse funds to borrower
    /// @param loanId The ID of the loan to approve
    function approveLoan(uint256 loanId) external onlyCoordinator {
        Loan storage loan = loans[loanId];
        if (loan.borrower == address(0)) revert LoanNotFound();
        if (loan.approved) revert LoanAlreadyApproved();

        uint256 available = totalDeposited - totalLent;
        if (loan.amount > available) revert InsufficientPoolLiquidity();

        loan.approved = true;
        loan.startTime = block.timestamp;
        totalLent += loan.amount;

        emit LoanApproved(loanId, msg.sender);

        bool success = usdt.transfer(loan.borrower, loan.amount);
        if (!success) revert TransferFailed();
    }

    /// @notice Repay a loan with accrued interest
    /// @param loanId The ID of the loan to repay
    function repay(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        if (loan.borrower == address(0)) revert LoanNotFound();
        if (!loan.approved) revert LoanNotApproved();
        if (loan.repaid) revert LoanAlreadyRepaid();
        if (msg.sender != loan.borrower) revert NotBorrower();

        uint256 interest = _calculateInterest(loan.amount, loan.startTime);
        uint256 totalRepayment = loan.amount + interest;

        loan.repaid = true;
        totalLent -= loan.amount;
        totalDeposited += interest;

        emit LoanRepaid(loanId, loan.amount, interest);

        bool success = usdt.transferFrom(msg.sender, address(this), totalRepayment);
        if (!success) revert TransferFailed();
    }

    /// @notice Withdraw available USDT from the pool
    /// @param amount Amount to withdraw
    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (lenderDeposits[msg.sender] < amount) revert InsufficientBalance();

        uint256 available = totalDeposited - totalLent;
        if (amount > available) revert InsufficientPoolLiquidity();

        lenderDeposits[msg.sender] -= amount;
        totalDeposited -= amount;

        emit Withdrawn(msg.sender, amount);

        bool success = usdt.transfer(msg.sender, amount);
        if (!success) revert TransferFailed();
    }

    /// @notice Get full details of a loan
    /// @param loanId The loan ID to query
    /// @return borrower Borrower address
    /// @return amount Loan principal
    /// @return interestRate Rate in basis points
    /// @return startTime Timestamp when loan was approved
    /// @return duration Loan duration in seconds
    /// @return repaid Whether loan has been repaid
    /// @return approved Whether loan has been approved
    function getLoanDetails(uint256 loanId)
        external
        view
        returns (
            address borrower,
            uint256 amount,
            uint256 interestRate,
            uint256 startTime,
            uint256 duration,
            bool repaid,
            bool approved
        )
    {
        Loan storage loan = loans[loanId];
        if (loan.borrower == address(0)) revert LoanNotFound();
        return (
            loan.borrower,
            loan.amount,
            loan.interestRate,
            loan.startTime,
            loan.duration,
            loan.repaid,
            loan.approved
        );
    }

    /// @notice Get aggregate pool statistics
    /// @return _totalDeposited Total USDT deposited
    /// @return _totalLent Total USDT currently lent out
    /// @return _available USDT available for new loans
    function getPoolStats()
        external
        view
        returns (uint256 _totalDeposited, uint256 _totalLent, uint256 _available)
    {
        return (totalDeposited, totalLent, totalDeposited - totalLent);
    }

    /// @notice Update the coordinator address
    /// @param newCoordinator New coordinator address
    function setCoordinator(address newCoordinator) external onlyCoordinator {
        address old = coordinator;
        coordinator = newCoordinator;
        emit CoordinatorUpdated(old, newCoordinator);
    }

    /// @dev Calculates accrued interest: principal * rate * elapsed / (BPS * year)
    function _calculateInterest(uint256 principal, uint256 startTime) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - startTime;
        return (principal * INTEREST_RATE_BPS * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
    }
}
