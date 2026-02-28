// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * Campaign escrow: contributions locked until deadline.
 * After deadline: creator may releaseFunds() if goal met; else contributors may claimRefund().
 */
contract Campaign is ReentrancyGuard {
    address public creator;
    uint256 public goal;
    uint256 public deadline;
    uint256 public totalContributed;
    uint256 public totalRaised;
    bool public closed;
    bool public fundsWithdrawn;
    bool public fundsReleased;
    bool public refundEnabled;
    bool public finalized;
    mapping(address => uint256) public contributions;

    event Contributed(address indexed contributor, uint256 amount);
    event ContributionReceived(address indexed contributor, uint256 amount);
    event Withdrawal(address indexed creator, uint256 amount);
    event FundsReleased(address indexed creator, uint256 amount);
    event Refund(address indexed contributor, uint256 amount);
    event RefundClaimed(address indexed contributor, uint256 amount);
    event CampaignClosed(bool goalReached);

    error ZeroContribution();
    error CampaignEnded();
    error GoalReached();
    error GoalNotReached();
    error NotCreator();
    error NoContribution();
    error TransferFailed();
    error AlreadyWithdrawn();
    error RefundNotEnabled();
    error AlreadyFinalized();
    error DeadlineNotReached();

    constructor(address _creator, uint256 _goal, uint256 _deadline) {
        creator = _creator;
        goal = _goal;
        deadline = _deadline;
    }

    /// @notice Contribute ETH. Locked in contract until deadline. Reverts after deadline or if campaign closed.
    function contribute() external payable nonReentrant {
        if (msg.value == 0) revert ZeroContribution();
        if (block.timestamp >= deadline) revert CampaignEnded();
        if (closed) revert GoalReached();
        contributions[msg.sender] += msg.value;
        totalContributed += msg.value;
        totalRaised = totalContributed;
        if (totalContributed >= goal) {
            closed = true;
            emit CampaignClosed(true);
        }
        emit Contributed(msg.sender, msg.value);
        emit ContributionReceived(msg.sender, msg.value);
    }

    /// @notice After deadline, if goal was met, only creator can release full balance. Funds stay in escrow until deadline.
    function releaseFunds() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (block.timestamp < deadline) revert DeadlineNotReached();
        if (!closed) revert GoalNotReached();
        if (fundsWithdrawn || fundsReleased) revert AlreadyWithdrawn();
        uint256 amount = address(this).balance;
        fundsWithdrawn = true;
        fundsReleased = true;
        (bool ok,) = payable(creator).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawal(creator, amount);
        emit FundsReleased(creator, amount);
    }

    /// @dev Legacy alias
    function withdrawFunds() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (block.timestamp < deadline) revert DeadlineNotReached();
        if (!closed) revert GoalNotReached();
        if (fundsWithdrawn || fundsReleased) revert AlreadyWithdrawn();
        uint256 amount = address(this).balance;
        fundsWithdrawn = true;
        fundsReleased = true;
        (bool ok,) = payable(creator).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawal(creator, amount);
        emit FundsReleased(creator, amount);
    }

    /// @notice Call after deadline to enable refunds when goal was not met. Anyone may call once.
    function finalizeAfterDeadline() external {
        if (finalized) revert AlreadyFinalized();
        if (block.timestamp < deadline) revert DeadlineNotReached();
        finalized = true;
        if (totalRaised < goal) {
            refundEnabled = true;
        }
    }

    /// @notice If goal not met after deadline, contributor claims refund. One claim per address.
    function claimRefund() external nonReentrant {
        if (!refundEnabled) revert RefundNotEnabled();
        uint256 amount = contributions[msg.sender];
        if (amount == 0) revert NoContribution();
        contributions[msg.sender] = 0;
        totalContributed -= amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Refund(msg.sender, amount);
        emit RefundClaimed(msg.sender, amount);
    }

    /// @dev Legacy alias for claimRefund
    function refund() external nonReentrant {
        if (!refundEnabled) revert RefundNotEnabled();
        uint256 amount = contributions[msg.sender];
        if (amount == 0) revert NoContribution();
        contributions[msg.sender] = 0;
        totalContributed -= amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Refund(msg.sender, amount);
        emit RefundClaimed(msg.sender, amount);
    }

    function goalReached() external view returns (bool) {
        return totalContributed >= goal;
    }

    receive() external payable {
        this.contribute{value: msg.value}();
    }
}
