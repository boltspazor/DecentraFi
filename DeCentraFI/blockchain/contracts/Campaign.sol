// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * Campaign escrow: contributions locked until deadline.
 * After deadline: creator may releaseFunds() if goal met; else contributors may claimRefund().
 */
contract Campaign is ReentrancyGuard {
    address public creator;
    address public admin;
    uint256 public goal;
    uint256 public deadline;
    uint256 public totalContributed;
    uint256 public totalRaised;
    uint256 public totalMilestoneReleased;
    bool public closed;
    bool public fundsWithdrawn;
    bool public fundsReleased;
    bool public refundEnabled;
    bool public finalized;
    bool public isVerified;
    uint256 public reportCount;
    mapping(address => bool) public reporters;
    mapping(address => uint256) public contributions;

    struct Milestone {
        uint256 percentage;
        bool released;
    }

    Milestone[] public milestones;
    mapping(uint256 => uint256) public milestoneApprovalWeight;
    mapping(uint256 => mapping(address => bool)) public milestoneVoted;

    event Contributed(address indexed contributor, uint256 amount);
    event ContributionReceived(address indexed contributor, uint256 amount);
    event Withdrawal(address indexed creator, uint256 amount);
    event FundsReleased(address indexed creator, uint256 amount);
    event Refund(address indexed contributor, uint256 amount);
    event RefundClaimed(address indexed contributor, uint256 amount);
    event CampaignClosed(bool goalReached);

    event MilestoneCreated(uint256 indexed milestoneId, uint256 percentage);
    event MilestoneApproved(uint256 indexed milestoneId, address indexed voter, uint256 weight);
    event MilestoneFundsReleased(uint256 indexed milestoneId, uint256 amount);
    event CampaignReported(address indexed reporter);
    event CampaignVerified(address indexed verifier);

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
    error MilestonesAlreadySet();
    error InvalidPercentage();
    error NoMilestones();
    error InvalidMilestoneId();
    error MilestoneAlreadyReleased();
    error NotContributor();
    error MilestoneNotApproved();
    error NoFundsToRelease();
    error NotAdmin();
    error AlreadyReported();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    constructor(address _creator, uint256 _goal, uint256 _deadline, address _admin) {
        creator = _creator;
        admin = _admin;
        goal = _goal;
        deadline = _deadline;
    }

    /// @notice Report this campaign (one report per address).
    function reportCampaign() external {
        if (reporters[msg.sender]) revert AlreadyReported();
        reporters[msg.sender] = true;
        reportCount += 1;
        emit CampaignReported(msg.sender);
    }

    /// @notice Mark campaign as verified. Only admin (e.g. factory owner) can call.
    function verifyCampaign() external onlyAdmin {
        isVerified = true;
        emit CampaignVerified(msg.sender);
    }

    /// @notice Define milestones as percentages totaling 100. Callable once by creator before funds logic depends on them.
    function setMilestones(uint256[] calldata percentages) external {
        if (msg.sender != creator) revert NotCreator();
        if (milestones.length != 0) revert MilestonesAlreadySet();
        if (percentages.length == 0) revert NoMilestones();

        uint256 sum;
        for (uint256 i = 0; i < percentages.length; i++) {
            uint256 p = percentages[i];
            if (p == 0) revert InvalidPercentage();
            sum += p;
            milestones.push(Milestone({percentage: p, released: false}));
            emit MilestoneCreated(i, p);
        }
        if (sum != 100) revert InvalidPercentage();
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

    /// @notice Contributors approve a milestone using their contribution weight. One vote per contributor per milestone.
    function approveMilestone(uint256 milestoneId) external {
        if (milestoneId >= milestones.length) revert InvalidMilestoneId();
        if (contributions[msg.sender] == 0) revert NotContributor();
        Milestone storage m = milestones[milestoneId];
        if (m.released) revert MilestoneAlreadyReleased();
        if (milestoneVoted[milestoneId][msg.sender]) {
            return;
        }
        milestoneVoted[milestoneId][msg.sender] = true;
        uint256 weight = contributions[msg.sender];
        milestoneApprovalWeight[milestoneId] += weight;
        emit MilestoneApproved(milestoneId, msg.sender, weight);
    }

    /// @notice After deadline and when goal met, creator can release proportional funds for an approved milestone.
    function releaseMilestoneFunds(uint256 milestoneId) external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (milestoneId >= milestones.length) revert InvalidMilestoneId();
        if (block.timestamp < deadline) revert DeadlineNotReached();
        if (!closed) revert GoalNotReached();

        Milestone storage m = milestones[milestoneId];
        if (m.released) revert MilestoneAlreadyReleased();

        // Require simple majority by contribution weight.
        if (milestoneApprovalWeight[milestoneId] * 2 < totalContributed) {
            revert MilestoneNotApproved();
        }

        uint256 targetTotal = (totalRaised * m.percentage) / 100;
        if (targetTotal <= totalMilestoneReleased) revert NoFundsToRelease();
        uint256 amount = targetTotal - totalMilestoneReleased;
        totalMilestoneReleased = targetTotal;
        m.released = true;

        (bool ok,) = payable(creator).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit MilestoneFundsReleased(milestoneId, amount);

        if (totalMilestoneReleased >= totalRaised) {
            fundsReleased = true;
            fundsWithdrawn = true;
        }
    }

    receive() external payable {
        this.contribute{value: msg.value}();
    }
}
