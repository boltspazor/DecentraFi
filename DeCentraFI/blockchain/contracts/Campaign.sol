// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Campaign is ReentrancyGuard {
    address public creator;
    uint256 public goal;
    uint256 public deadline;
    uint256 public totalContributed;
    bool public closed;
    bool public fundsWithdrawn;
    mapping(address => uint256) public contributions;

    event Contributed(address indexed contributor, uint256 amount);
    event ContributionReceived(address indexed contributor, uint256 amount);
    event Withdrawal(address indexed creator, uint256 amount);
    event Refund(address indexed contributor, uint256 amount);
    event CampaignClosed(bool goalReached);

    error ZeroContribution();
    error CampaignEnded();
    error GoalReached();
    error GoalNotReached();
    error NotCreator();
    error NoContribution();
    error TransferFailed();
    error AlreadyWithdrawn();

    constructor(address _creator, uint256 _goal, uint256 _deadline) {
        creator = _creator;
        goal = _goal;
        deadline = _deadline;
    }

    function contribute() external payable nonReentrant {
        if (msg.value == 0) revert ZeroContribution();
        if (block.timestamp >= deadline) revert CampaignEnded();
        if (closed) revert GoalReached();
        contributions[msg.sender] += msg.value;
        totalContributed += msg.value;
        if (totalContributed >= goal) {
            closed = true;
            emit CampaignClosed(true);
        }
        emit Contributed(msg.sender, msg.value);
        emit ContributionReceived(msg.sender, msg.value);
    }

    function withdrawFunds() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (!closed) revert GoalNotReached();
        if (fundsWithdrawn) revert AlreadyWithdrawn();
        uint256 amount = address(this).balance;
        fundsWithdrawn = true;
        (bool ok,) = payable(creator).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawal(creator, amount);
    }

    /// @dev Legacy alias for withdrawFunds (creator withdraws when goal reached)
    function withdraw() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (!closed) revert GoalNotReached();
        if (fundsWithdrawn) revert AlreadyWithdrawn();
        uint256 amount = address(this).balance;
        fundsWithdrawn = true;
        (bool ok,) = payable(creator).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawal(creator, amount);
    }

    function refund() external nonReentrant {
        if (block.timestamp < deadline && !closed) revert GoalNotReached();
        uint256 amount = contributions[msg.sender];
        if (amount == 0) revert NoContribution();
        contributions[msg.sender] = 0;
        totalContributed -= amount;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Refund(msg.sender, amount);
    }

    function goalReached() external view returns (bool) {
        return totalContributed >= goal;
    }

    receive() external payable {
        this.contribute{value: msg.value}();
    }
}
