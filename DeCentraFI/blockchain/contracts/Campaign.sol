// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

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
    // Linear ETH streaming from escrow to creator after the campaign is successful.
    // Funds are released pro-rata over time (claimable per second).
    uint256 public constant DEFAULT_STREAM_DURATION_SECONDS = 30 days;
    uint256 public streamStartTime;
    uint256 public streamEndTime;
    uint256 public streamDurationSeconds;
    uint256 public streamTotalAmount;
    uint256 public streamWithdrawnAmount;
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

    struct Proposal {
        string description;
        uint256 voteCount;
        bool executed;
    }

    Proposal[] public proposals;
    mapping(uint256 => mapping(address => bool)) public proposalVoted;

    event Contributed(address indexed contributor, uint256 amount);
    event ContributionReceived(address indexed contributor, uint256 amount);
    event Withdrawal(address indexed creator, uint256 amount);
    event FundsReleased(address indexed creator, uint256 amount);
    event StreamStarted(
        address indexed creator,
        uint256 totalAmount,
        uint256 durationSeconds,
        uint256 ratePerSecond,
        uint256 startTime,
        uint256 endTime
    );
    event StreamWithdrawn(address indexed creator, uint256 amount, uint256 totalWithdrawn);
    event StreamStopped(address indexed creator, uint256 remainingAmount, uint256 totalWithdrawn);
    event Refund(address indexed contributor, uint256 amount);
    event RefundClaimed(address indexed contributor, uint256 amount);
    event CampaignClosed(bool goalReached);

    event MilestoneCreated(uint256 indexed milestoneId, uint256 percentage);
    event MilestoneApproved(uint256 indexed milestoneId, address indexed voter, uint256 weight);
    event MilestoneFundsReleased(uint256 indexed milestoneId, uint256 amount);
    event CampaignReported(address indexed reporter);
    event CampaignVerified(address indexed verifier);
    event ProposalCreated(uint256 indexed proposalId, string description);
    event ProposalVoted(uint256 indexed proposalId, address indexed voter);
    event ProposalExecuted(uint256 indexed proposalId);
    /// @notice Emitted for cross-chain indexing: same as Contributed but includes chainId for multi-chain tracking.
    event CrossChainDeposit(address indexed contributor, uint256 amount, uint256 chainId);

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
    error InvalidStreamDuration();
    error StreamNotActive();
    error NoStreamFunds();
    error StreamAlreadyEnded();
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
    error AlreadyVoted();
    error InvalidProposalId();
    error ProposalAlreadyExecuted();

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
        emit CrossChainDeposit(msg.sender, msg.value, block.chainid);
    }

    /// @notice Current chain id for cross-chain indexing and frontend display.
    function getChainId() external view returns (uint256) {
        return block.chainid;
    }

    function streamRatePerSecond() external view returns (uint256) {
        if (streamDurationSeconds == 0) return 0;
        return streamTotalAmount / streamDurationSeconds;
    }

    /// @notice Amount currently claimable from the active stream.
    function streamClaimable() external view returns (uint256) {
        if (streamDurationSeconds == 0 || streamStartTime == 0) return 0;
        uint256 end = block.timestamp < streamEndTime ? block.timestamp : streamEndTime;
        if (end <= streamStartTime) return 0;
        uint256 elapsed = end - streamStartTime;
        uint256 totalDue = (streamTotalAmount * elapsed) / streamDurationSeconds;
        if (totalDue <= streamWithdrawnAmount) return 0;
        return totalDue - streamWithdrawnAmount;
    }

    function _startStream(uint256 durationSeconds) internal {
        if (block.timestamp < deadline) revert DeadlineNotReached();
        if (!closed) revert GoalNotReached();
        // Prevent mixing milestone releases with streaming escrow pulls.
        if (streamStartTime != 0) revert AlreadyWithdrawn();
        if (durationSeconds == 0) revert InvalidStreamDuration();

        uint256 totalAmount = address(this).balance;
        if (totalAmount == 0) revert NoFundsToRelease();

        streamStartTime = block.timestamp;
        streamDurationSeconds = durationSeconds;
        streamEndTime = block.timestamp + durationSeconds;
        streamTotalAmount = totalAmount;
        streamWithdrawnAmount = 0;

        fundsWithdrawn = true;
        fundsReleased = false;

        uint256 rate = totalAmount / durationSeconds;
        emit StreamStarted(creator, totalAmount, durationSeconds, rate, streamStartTime, streamEndTime);
    }

    /// @notice Start real-time streaming of escrow funds to the campaign creator.
    /// @dev Funds are streamed pro-rata over `durationSeconds`; creator can pull via `withdrawFromStream()`.
    function startStreaming(uint256 durationSeconds) external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        _startStream(durationSeconds);
    }

    /// @notice DAO-controlled streaming start after deadline when goal is met.
    function daoStartStreaming(uint256 durationSeconds) external nonReentrant onlyAdmin {
        _startStream(durationSeconds);
    }

    /// @notice Withdraw the currently claimable streamed amount.
    function withdrawFromStream() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (!fundsWithdrawn || fundsReleased) revert StreamNotActive();
        if (streamStartTime == 0 || streamDurationSeconds == 0) revert StreamNotActive();

        uint256 end = block.timestamp < streamEndTime ? block.timestamp : streamEndTime;
        if (end <= streamStartTime) revert NoStreamFunds();

        uint256 elapsed = end - streamStartTime;
        uint256 totalDue = (streamTotalAmount * elapsed) / streamDurationSeconds;
        if (totalDue <= streamWithdrawnAmount) revert NoStreamFunds();

        uint256 amount = totalDue - streamWithdrawnAmount;
        streamWithdrawnAmount = totalDue;

        (bool ok,) = payable(creator).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit StreamWithdrawn(creator, amount, streamWithdrawnAmount);

        // Close the stream on final withdrawal.
        if (streamWithdrawnAmount >= streamTotalAmount) {
            fundsReleased = true;
            emit FundsReleased(creator, streamTotalAmount);
        }
    }

    /// @notice Stop the stream early and withdraw the remaining escrow immediately.
    /// @dev This is an explicit "stop" endpoint (creator-only).
    function stopStream() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        if (!fundsWithdrawn || fundsReleased) revert StreamNotActive();
        if (streamStartTime == 0 || streamDurationSeconds == 0) revert StreamNotActive();
        if (block.timestamp >= streamEndTime) revert StreamAlreadyEnded();

        uint256 remaining = streamTotalAmount - streamWithdrawnAmount;
        if (remaining == 0) revert NoStreamFunds();

        streamWithdrawnAmount = streamTotalAmount;
        streamEndTime = block.timestamp;

        (bool ok,) = payable(creator).call{value: remaining}("");
        if (!ok) revert TransferFailed();

        emit StreamWithdrawn(creator, remaining, streamWithdrawnAmount);
        emit StreamStopped(creator, remaining, streamWithdrawnAmount);
        fundsReleased = true;
        emit FundsReleased(creator, streamTotalAmount);
    }

    /// @notice Legacy entrypoint: starts streaming with the default duration.
    function releaseFunds() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        _startStream(DEFAULT_STREAM_DURATION_SECONDS);
    }

    /// @dev Legacy alias
    function withdrawFunds() external nonReentrant {
        if (msg.sender != creator) revert NotCreator();
        _startStream(DEFAULT_STREAM_DURATION_SECONDS);
    }

    /// @notice Legacy DAO entrypoint: starts streaming with the default duration.
    function daoReleaseFunds() external nonReentrant onlyAdmin {
        _startStream(DEFAULT_STREAM_DURATION_SECONDS);
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
        // Prevent mixing milestone releases with streaming escrow pulls.
        if (streamStartTime != 0) revert AlreadyWithdrawn();

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

    /// @notice DAO-controlled milestone release. Same checks as creator release, but callable by admin.
    function daoReleaseMilestoneFunds(uint256 milestoneId) external nonReentrant onlyAdmin {
        if (milestoneId >= milestones.length) revert InvalidMilestoneId();
        if (block.timestamp < deadline) revert DeadlineNotReached();
        if (!closed) revert GoalNotReached();
        if (fundsWithdrawn || fundsReleased) revert AlreadyWithdrawn();

        Milestone storage m = milestones[milestoneId];
        if (m.released) revert MilestoneAlreadyReleased();

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

    /// @notice Total number of governance proposals created for this campaign.
    function getProposalCount() external view returns (uint256) {
        return proposals.length;
    }

    /// @notice Create a new governance proposal about this campaign.
    /// Only creator or contributors may create proposals.
    function createProposal(string calldata description) external {
        if (msg.sender != creator && contributions[msg.sender] == 0) {
            revert NotContributor();
        }
        proposals.push(Proposal({description: description, voteCount: 0, executed: false}));
        uint256 proposalId = proposals.length - 1;
        emit ProposalCreated(proposalId, description);
    }

    /// @notice Vote on an existing proposal. Only contributors may vote; one vote per address.
    function voteProposal(uint256 proposalId) external {
        if (contributions[msg.sender] == 0) revert NotContributor();
        if (proposalId >= proposals.length) revert InvalidProposalId();
        Proposal storage p = proposals[proposalId];
        if (p.executed) revert ProposalAlreadyExecuted();
        if (proposalVoted[proposalId][msg.sender]) revert AlreadyVoted();
        proposalVoted[proposalId][msg.sender] = true;
        p.voteCount += 1;
        emit ProposalVoted(proposalId, msg.sender);
    }

    /// @notice Mark a proposal as executed once the off-chain decision has been applied.
    /// Only creator or admin may execute; requires at least one vote.
    function executeProposal(uint256 proposalId) external {
        if (msg.sender != creator && msg.sender != admin) revert NotAdmin();
        if (proposalId >= proposals.length) revert InvalidProposalId();
        Proposal storage p = proposals[proposalId];
        if (p.executed) revert ProposalAlreadyExecuted();
        if (p.voteCount == 0) revert ProposalAlreadyExecuted(); // re-use error for simplicity
        p.executed = true;
        emit ProposalExecuted(proposalId);
    }

    receive() external payable {
        this.contribute{value: msg.value}();
    }
}
