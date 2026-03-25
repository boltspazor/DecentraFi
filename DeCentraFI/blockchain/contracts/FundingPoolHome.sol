// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./InvestmentShareToken.sol";

// Minimal LayerZero endpoint interface (send only).
interface ILayerZeroEndpoint {
    function send(
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParams
    ) external payable;
}

// Minimal Semaphore interface (v4-style).
// This is deliberately small so the repo can use real Semaphore later without coupling
// this contract to a specific npm package version.
interface ISemaphore {
    struct SemaphoreProof {
        uint256 merkleTreeDepth;
        uint256 merkleTreeRoot;
        uint256 nullifier;
        uint256 message;
        uint256 scope;
        uint256[8] points;
    }

    function verifyProof(uint256 groupId, SemaphoreProof calldata proof) external view returns (bool);
}

/**
 * @title FundingPoolHome
 * @notice Option A: single "home" pool that receives deposits from remote chains via LayerZero.
 *
 * Design notes:
 * - Campaigns are created on the home pool, and are referenced by `campaignId` across chains.
 * - Remote chains use `FundingGateway` to send cross-chain deposit messages to this contract.
 * - This contract maintains its own escrow accounting per campaign and supports
 *   linear ETH streaming (start/withdraw/stop) after the deadline when the goal is met.
 */
contract FundingPoolHome is ReentrancyGuard {
    address public immutable endpoint;
    address public owner;

    // ---- Semaphore (anonymous donations) ----
    ISemaphore public semaphoreVerifier;
    uint256 public semaphoreGroupId;
    bool public semaphoreConfigured;

    // srcChainId => srcAddress bytes (gateway address encoded as bytes in LZ payload/path)
    mapping(uint16 => bytes) public trustedRemoteLookup;

    // Prevent processing the same LayerZero message more than once.
    // lz uses (srcChainId, srcAddress, nonce) as a unique message identifier.
    mapping(uint16 => mapping(bytes32 => mapping(uint64 => bool))) public processedNonces;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _endpoint) {
        endpoint = _endpoint;
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero owner");
        owner = newOwner;
    }

    function setTrustedRemote(uint16 srcChainId, bytes calldata srcAddress) external onlyOwner {
        trustedRemoteLookup[srcChainId] = srcAddress;
    }

    function setSemaphore(address _semaphoreVerifier, uint256 _groupId) external onlyOwner {
        require(_semaphoreVerifier != address(0), "Zero verifier");
        semaphoreVerifier = ISemaphore(_semaphoreVerifier);
        semaphoreGroupId = _groupId;
        semaphoreConfigured = true;
    }

    // ---- Campaign state ----
    struct Campaign {
        address creator;
        uint256 goal;
        uint256 deadline;
        uint256 totalContributed;
        uint256 totalRaised;
        bool closed;
        bool fundsWithdrawn; // true after streaming starts (prevents overlap)
        bool fundsReleased; // true after stream is fully completed or stopped
        bool refundEnabled;
        bool finalized;
        bool exists;
    }

    uint256 public nextCampaignId = 1;
    mapping(uint256 => Campaign) public campaigns;

    // campaignId => ERC20 investment shares (non-transferable).
    mapping(uint256 => address) public shareTokenByCampaign;

    // campaignId => contributor => amount
    mapping(uint256 => mapping(address => uint256)) public contributions;
    // campaignId => nullifier => amount (anonymous donation accounting)
    mapping(uint256 => mapping(uint256 => uint256)) public anonymousContributions;
    // campaignId => nullifier => used (prevents duplicate anonymous deposits)
    mapping(uint256 => mapping(uint256 => bool)) public anonymousNullifierUsed;
    // campaignId => escrow held for this campaign
    mapping(uint256 => uint256) public escrowBalance;

    // ---- Streaming state (per campaign) ----
    uint256 public constant DEFAULT_STREAM_DURATION_SECONDS = 30 days;

    mapping(uint256 => uint256) public streamStartTime;
    mapping(uint256 => uint256) public streamEndTime;
    mapping(uint256 => uint256) public streamDurationSeconds;
    mapping(uint256 => uint256) public streamTotalAmount;
    mapping(uint256 => uint256) public streamWithdrawnAmount;

    // ---- Events ----
    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        uint256 goal,
        uint256 deadline
    );
    event ContributionReceived(address indexed contributor, uint256 amount, uint256 indexed campaignId, uint256 originChainId);
    event RefundClaimed(address indexed contributor, uint256 amount, uint256 indexed campaignId);
    event AnonymousContributionReceived(uint256 indexed campaignId, uint256 indexed nullifier, uint256 amount, uint256 originChainId);
    event AnonymousRefundClaimed(uint256 indexed campaignId, uint256 indexed nullifier, uint256 amount);

    event StreamStarted(
        address indexed creator,
        uint256 indexed campaignId,
        uint256 totalAmount,
        uint256 durationSeconds,
        uint256 ratePerSecond,
        uint256 startTime,
        uint256 endTime
    );
    event StreamWithdrawn(address indexed creator, uint256 indexed campaignId, uint256 amount, uint256 totalWithdrawn);
    event StreamStopped(
        address indexed creator,
        uint256 indexed campaignId,
        uint256 remainingAmount,
        uint256 totalWithdrawn
    );
    event FundsReleased(address indexed creator, uint256 indexed campaignId, uint256 amount);

    // ---- Errors (modeled after Campaign.sol) ----
    error InvalidGoal();
    error InvalidDeadline();
    error CampaignEnded();
    error GoalReached();
    error DeadlineNotReached();
    error NotCreator();
    error NoContribution();
    error TransferFailed();
    error AlreadyWithdrawn();
    error RefundNotEnabled();
    error AlreadyFinalized();
    error StreamNotActive();
    error InvalidStreamDuration();
    error NoStreamFunds();
    error StreamAlreadyEnded();
    error CampaignNotFound();
    error GoalNotReached();
    error DuplicateDeposit();
    error SemaphoreNotConfigured();
    error InvalidSemaphoreProof();
    error DuplicateAnonNullifier();

    // ---- Campaign lifecycle: create + local contribute ----
    function createCampaign(uint256 goalWei, uint256 deadline) external returns (uint256 campaignId) {
        if (goalWei == 0) revert InvalidGoal();
        if (deadline <= block.timestamp) revert InvalidDeadline();

        campaignId = nextCampaignId++;
        campaigns[campaignId] = Campaign({
            creator: msg.sender,
            goal: goalWei,
            deadline: deadline,
            totalContributed: 0,
            totalRaised: 0,
            closed: false,
            fundsWithdrawn: false,
            fundsReleased: false,
            refundEnabled: false,
            finalized: false,
            exists: true
        });

        // Deploy a dedicated, non-transferable share token for this campaign.
        // Tokens are minted 1:1 with contributed wei and burned on refund.
        InvestmentShareToken token = new InvestmentShareToken(
            address(this),
            campaignId,
            "DecentraFI Investment Share",
            "DIFS"
        );
        shareTokenByCampaign[campaignId] = address(token);

        emit CampaignCreated(campaignId, msg.sender, goalWei, deadline);
    }

    function contribute(uint256 campaignId) external payable nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (msg.value == 0) revert NoContribution();
        if (block.timestamp >= c.deadline) revert CampaignEnded();
        if (c.closed) revert GoalReached();

        contributions[campaignId][msg.sender] += msg.value;
        c.totalContributed += msg.value;
        c.totalRaised = c.totalContributed;
        if (c.totalContributed >= c.goal) {
            c.closed = true;
        }

        escrowBalance[campaignId] += msg.value;

        // Mint investment shares for this contribution.
        InvestmentShareToken(shareTokenByCampaign[campaignId]).mint(msg.sender, msg.value);
        emit ContributionReceived(msg.sender, msg.value, campaignId, block.chainid);
    }

    function contributeAnon(
        uint256 campaignId,
        uint256 amountWei,
        ISemaphore.SemaphoreProof calldata proof
    ) external payable nonReentrant {
        if (!semaphoreConfigured) revert SemaphoreNotConfigured();

        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (amountWei == 0) revert NoContribution();
        if (block.timestamp >= c.deadline) revert CampaignEnded();
        if (c.closed) revert GoalReached();
        require(msg.value == amountWei, "Mismatched msg.value");

        // Nullifier is public in Semaphore proofs; we store it to prevent duplicates.
        uint256 nullifier = proof.nullifier;
        if (anonymousNullifierUsed[campaignId][nullifier]) revert DuplicateAnonNullifier();

        bool ok = semaphoreVerifier.verifyProof(semaphoreGroupId, proof);
        if (!ok) revert InvalidSemaphoreProof();

        // Mark nullifier used before mutating accounting to reduce reentrancy surface.
        anonymousNullifierUsed[campaignId][nullifier] = true;
        anonymousContributions[campaignId][nullifier] += amountWei;

        c.totalContributed += amountWei;
        c.totalRaised = c.totalContributed;
        if (c.totalContributed >= c.goal) {
            c.closed = true;
        }

        escrowBalance[campaignId] += amountWei;
        emit AnonymousContributionReceived(campaignId, nullifier, amountWei, block.chainid);
    }

    // helper: isolate accounting logic and allow lzReceive to reuse
    function _contributeFromRemote(uint256 campaignId, address contributor, uint256 amount, uint256 originChainId)
        internal
    {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (amount == 0) revert NoContribution();
        if (block.timestamp >= c.deadline) revert CampaignEnded();
        if (c.closed) revert GoalReached();

        contributions[campaignId][contributor] += amount;
        c.totalContributed += amount;
        c.totalRaised = c.totalContributed;
        if (c.totalContributed >= c.goal) {
            c.closed = true;
        }

        escrowBalance[campaignId] += amount;

        // Mint shares credited to the contributor wallet on the home chain.
        InvestmentShareToken(shareTokenByCampaign[campaignId]).mint(contributor, amount);
        emit ContributionReceived(contributor, amount, campaignId, originChainId);
    }

    /**
     * @dev LayerZero receive hook.
     * Payload format: (uint256 campaignId, address contributor, uint256 amount, uint256 originChainId)
     *
     * IMPORTANT: This contract assumes the corresponding ETH value is delivered to this contract,
     * so `msg.value` must equal the bridged `amount`.
     */
    function lzReceive(
        uint16 _srcChainId,
        bytes calldata _srcAddress,
        uint64 _nonce,
        bytes calldata _payload
    ) external payable nonReentrant {
        require(msg.sender == endpoint, "Invalid endpoint");
        bytes memory trusted = trustedRemoteLookup[_srcChainId];
        require(trusted.length != 0 && keccak256(trusted) == keccak256(_srcAddress), "Untrusted remote");

        (uint256 campaignId, address contributor, uint256 amount, uint256 originChainId) =
            abi.decode(_payload, (uint256, address, uint256, uint256));

        require(msg.value == amount, "Mismatched bridged value");

        bytes32 srcAddrHash = keccak256(_srcAddress);
        if (processedNonces[_srcChainId][srcAddrHash][_nonce]) revert DuplicateDeposit();
        processedNonces[_srcChainId][srcAddrHash][_nonce] = true;

        _contributeFromRemote(campaignId, contributor, amount, originChainId);
    }

    // ---- Streaming views ----
    function streamRatePerSecond(uint256 campaignId) public view returns (uint256) {
        uint256 total = streamTotalAmount[campaignId];
        uint256 dur = streamDurationSeconds[campaignId];
        if (dur == 0) return 0;
        return total / dur;
    }

    function streamClaimable(uint256 campaignId) public view returns (uint256) {
        uint256 sst = streamStartTime[campaignId];
        uint256 sEnd = streamEndTime[campaignId];
        uint256 dur = streamDurationSeconds[campaignId];
        uint256 total = streamTotalAmount[campaignId];
        uint256 withdrawn = streamWithdrawnAmount[campaignId];
        if (sst == 0 || dur == 0) return 0;
        uint256 end = block.timestamp < sEnd ? block.timestamp : sEnd;
        if (end <= sst) return 0;
        uint256 elapsed = end - sst;
        uint256 totalDue = (total * elapsed) / dur;
        if (totalDue <= withdrawn) return 0;
        return totalDue - withdrawn;
    }

    // ---- Streaming: start/withdraw/stop ----
    function startStreaming(uint256 campaignId, uint256 durationSeconds) public nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (msg.sender != c.creator) revert NotCreator();
        if (block.timestamp < c.deadline) revert DeadlineNotReached();
        if (!c.closed) revert GoalNotReached();
        if (c.fundsWithdrawn || c.fundsReleased) revert AlreadyWithdrawn();
        if (durationSeconds == 0) revert InvalidStreamDuration();

        uint256 totalAmount = escrowBalance[campaignId];
        require(totalAmount > 0, "No funds");

        streamStartTime[campaignId] = block.timestamp;
        streamDurationSeconds[campaignId] = durationSeconds;
        streamEndTime[campaignId] = block.timestamp + durationSeconds;
        streamTotalAmount[campaignId] = totalAmount;
        streamWithdrawnAmount[campaignId] = 0;

        c.fundsWithdrawn = true;
        c.fundsReleased = false;

        uint256 rate = totalAmount / durationSeconds;
        emit StreamStarted(c.creator, campaignId, totalAmount, durationSeconds, rate, block.timestamp, streamEndTime[campaignId]);
    }

    function releaseFunds(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (msg.sender != c.creator) revert NotCreator();
        startStreaming(campaignId, DEFAULT_STREAM_DURATION_SECONDS);
    }

    function withdrawFromStream(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (msg.sender != c.creator) revert NotCreator();
        if (!c.fundsWithdrawn || c.fundsReleased) revert StreamNotActive();
        uint256 sst = streamStartTime[campaignId];
        uint256 dur = streamDurationSeconds[campaignId];
        if (sst == 0 || dur == 0) revert StreamNotActive();

        uint256 end = block.timestamp < streamEndTime[campaignId] ? block.timestamp : streamEndTime[campaignId];
        if (end <= sst) revert NoStreamFunds();

        uint256 elapsed = end - sst;
        uint256 totalDue = (streamTotalAmount[campaignId] * elapsed) / dur;
        uint256 withdrawn = streamWithdrawnAmount[campaignId];
        if (totalDue <= withdrawn) revert NoStreamFunds();

        uint256 amount = totalDue - withdrawn;
        streamWithdrawnAmount[campaignId] = totalDue;

        // Decrement campaign escrow. (We track escrowBalance so multiple campaigns can stream safely.)
        escrowBalance[campaignId] -= amount;

        (bool ok,) = payable(c.creator).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit StreamWithdrawn(c.creator, campaignId, amount, streamWithdrawnAmount[campaignId]);

        if (streamWithdrawnAmount[campaignId] >= streamTotalAmount[campaignId]) {
            c.fundsReleased = true;
            escrowBalance[campaignId] = 0;
            emit FundsReleased(c.creator, campaignId, streamTotalAmount[campaignId]);
        }
    }

    function stopStream(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (msg.sender != c.creator) revert NotCreator();
        if (!c.fundsWithdrawn || c.fundsReleased) revert StreamNotActive();

        uint256 sst = streamStartTime[campaignId];
        uint256 sEnd = streamEndTime[campaignId];
        uint256 dur = streamDurationSeconds[campaignId];
        if (sst == 0 || dur == 0) revert StreamNotActive();
        if (block.timestamp >= sEnd) revert StreamAlreadyEnded();

        uint256 remaining = streamTotalAmount[campaignId] - streamWithdrawnAmount[campaignId];
        if (remaining == 0) revert NoStreamFunds();

        streamWithdrawnAmount[campaignId] = streamTotalAmount[campaignId];
        escrowBalance[campaignId] = 0;

        (bool ok,) = payable(c.creator).call{value: remaining}("");
        if (!ok) revert TransferFailed();

        emit StreamWithdrawn(c.creator, campaignId, remaining, streamWithdrawnAmount[campaignId]);
        emit StreamStopped(c.creator, campaignId, remaining, streamWithdrawnAmount[campaignId]);

        c.fundsReleased = true;
        streamEndTime[campaignId] = block.timestamp;

        emit FundsReleased(c.creator, campaignId, streamTotalAmount[campaignId]);
    }

    // ---- Refunds: finalize + claim ----
    function finalizeAfterDeadline(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (c.finalized) revert AlreadyFinalized();
        if (block.timestamp < c.deadline) revert DeadlineNotReached();

        c.finalized = true;
        if (c.totalRaised < c.goal) {
            c.refundEnabled = true;
        }
    }

    function claimRefund(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (!c.refundEnabled) revert RefundNotEnabled();

        uint256 amount = contributions[campaignId][msg.sender];
        if (amount == 0) revert NoContribution();

        contributions[campaignId][msg.sender] = 0;
        c.totalContributed -= amount;
        c.totalRaised = c.totalContributed;
        escrowBalance[campaignId] -= amount;

        // Burn shares as the contributor exits.
        InvestmentShareToken(shareTokenByCampaign[campaignId]).burn(msg.sender, amount);

        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit RefundClaimed(msg.sender, amount, campaignId);
    }

    function claimRefundAnon(uint256 campaignId, ISemaphore.SemaphoreProof calldata proof) external nonReentrant {
        if (!semaphoreConfigured) revert SemaphoreNotConfigured();

        Campaign storage c = campaigns[campaignId];
        if (!c.exists) revert CampaignNotFound();
        if (!c.refundEnabled) revert RefundNotEnabled();

        bool ok = semaphoreVerifier.verifyProof(semaphoreGroupId, proof);
        if (!ok) revert InvalidSemaphoreProof();

        uint256 nullifier = proof.nullifier;
        uint256 amount = anonymousContributions[campaignId][nullifier];
        if (amount == 0) revert NoContribution();

        anonymousContributions[campaignId][nullifier] = 0;
        c.totalContributed -= amount;
        c.totalRaised = c.totalContributed;
        escrowBalance[campaignId] -= amount;

        (bool sent,) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert TransferFailed();

        emit AnonymousRefundClaimed(campaignId, nullifier, amount);
    }

    // ---- Owner convenience for tests/UX (optional admin start) ----
    // LayerZero remote settlement is expected; this just mirrors the "admin start" concept if needed later.
    function daoStartStreaming(uint256 campaignId, uint256 durationSeconds) external {
        // Intentionally no onlyOwner; wire to governance later if desired.
        startStreaming(campaignId, durationSeconds);
    }
}

