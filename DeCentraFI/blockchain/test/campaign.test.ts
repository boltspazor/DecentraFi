const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Campaign", function () {
  let campaign;
  let factory;
  let owner;
  let contributor1;
  let contributor2;

  const goal = ethers.parseEther("10");
  const deadlineOffset = 60 * 60 * 24 * 7; // 7 days

  async function advancePastDeadline() {
    await ethers.provider.send("evm_increaseTime", [deadlineOffset + 1]);
    await ethers.provider.send("evm_mine", []);
  }

  beforeEach(async function () {
    [owner, contributor1, contributor2] = await ethers.getSigners();
    const CampaignFactory = await ethers.getContractFactory("CampaignFactory");
    factory = await CampaignFactory.deploy(owner.address);
    await factory.waitForDeployment();
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + deadlineOffset;
    await factory.createCampaign(goal, deadline);
    const campaignAddr = await factory.campaigns(0);
    const Campaign = await ethers.getContractFactory("Campaign");
    campaign = Campaign.attach(campaignAddr);
  });

  it("should set creator, goal, deadline", async function () {
    expect(await campaign.creator()).to.equal(owner.address);
    expect(await campaign.goal()).to.equal(goal);
    expect(await campaign.deadline()).to.be.gt(0);
  });

  // --- Escrow: contributions locked in contract ---
  it("should lock contributions in contract until deadline", async function () {
    const amount = ethers.parseEther("3");
    await campaign.connect(contributor1).contribute({ value: amount });
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(amount);
    expect(await campaign.totalRaised()).to.equal(amount);
    expect(await campaign.totalContributed()).to.equal(amount);
  });

  it("should not allow early withdrawal before deadline even if goal reached", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    expect(await campaign.closed()).to.be.true;
    await expect(campaign.withdrawFunds()).to.be.revertedWithCustomError(campaign, "DeadlineNotReached");
    await expect(campaign.releaseFunds()).to.be.revertedWithCustomError(campaign, "DeadlineNotReached");
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(ethers.parseEther("10"));
  });

  // --- contribute() ---
  it("should accept valid ETH and update totalContributed, totalRaised and contributions mapping", async function () {
    const amount = ethers.parseEther("1");
    await campaign.connect(contributor1).contribute({ value: amount });
    expect(await campaign.totalContributed()).to.equal(amount);
    expect(await campaign.totalRaised()).to.equal(amount);
    expect(await campaign.contributions(contributor1.address)).to.equal(amount);
  });

  it("should emit ContributionReceived with accurate contributor address and amount", async function () {
    const amount = ethers.parseEther("2");
    await expect(campaign.connect(contributor1).contribute({ value: amount }))
      .to.emit(campaign, "ContributionReceived")
      .withArgs(contributor1.address, amount);
  });

  describe("Cross-chain deposit logic, event emission, and chain tracking", function () {
    it("should emit CrossChainDeposit with contributor, amount, and chainId on contribute", async function () {
      const amount = ethers.parseEther("1.5");
      const chainId = await campaign.getChainId();
      await expect(campaign.connect(contributor1).contribute({ value: amount }))
        .to.emit(campaign, "CrossChainDeposit")
        .withArgs(contributor1.address, amount, chainId);
    });

    it("should emit Contributed, ContributionReceived, and CrossChainDeposit on contribute", async function () {
      const amount = ethers.parseEther("1");
      const chainId = await campaign.getChainId();
      const tx = campaign.connect(contributor2).contribute({ value: amount });
      await expect(tx).to.emit(campaign, "Contributed").withArgs(contributor2.address, amount);
      await expect(tx).to.emit(campaign, "ContributionReceived").withArgs(contributor2.address, amount);
      await expect(tx).to.emit(campaign, "CrossChainDeposit").withArgs(contributor2.address, amount, chainId);
    });

    it("getChainId() should return current network chain id", async function () {
      const chainId = await campaign.getChainId();
      const network = await ethers.provider.getNetwork();
      expect(chainId).to.equal(network.chainId);
      expect(chainId).to.be.gt(0);
    });

    it("should track chain id per contribution for multi-chain indexing", async function () {
      const amount = ethers.parseEther("1");
      await campaign.connect(contributor1).contribute({ value: amount });
      const chainId = await campaign.getChainId();
      expect(chainId).to.equal((await ethers.provider.getNetwork()).chainId);
    });
  });

  it("should revert contribute with zero ETH", async function () {
    await expect(
      campaign.connect(contributor1).contribute({ value: 0 })
    ).to.be.revertedWithCustomError(campaign, "ZeroContribution");
  });

  it("should revert contribute after deadline", async function () {
    await advancePastDeadline();
    await expect(
      campaign.connect(contributor1).contribute({ value: ethers.parseEther("1") })
    ).to.be.revertedWithCustomError(campaign, "CampaignEnded");
  });

  it("should accumulate multiple contributions from same address", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("1") });
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("3") });
    expect(await campaign.contributions(contributor1.address)).to.equal(ethers.parseEther("4"));
    expect(await campaign.totalContributed()).to.equal(ethers.parseEther("4"));
  });

  it("should update state correctly after multiple contributors", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("3") });
    await campaign.connect(contributor2).contribute({ value: ethers.parseEther("4") });
    expect(await campaign.totalContributed()).to.equal(ethers.parseEther("7"));
    expect(await campaign.contributions(contributor1.address)).to.equal(ethers.parseEther("3"));
    expect(await campaign.contributions(contributor2.address)).to.equal(ethers.parseEther("4"));
  });

  it("should revert contribute when goal already reached", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    await expect(
      campaign.connect(contributor2).contribute({ value: ethers.parseEther("1") })
    ).to.be.revertedWithCustomError(campaign, "GoalReached");
  });

  // --- releaseFunds() after deadline ---
  it("should allow only creator to call releaseFunds", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    await advancePastDeadline();
    await expect(
      campaign.connect(contributor1).releaseFunds()
    ).to.be.revertedWithCustomError(campaign, "NotCreator");
  });

  it("should revert releaseFunds when goal not reached", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("5") });
    await advancePastDeadline();
    await expect(campaign.releaseFunds()).to.be.revertedWithCustomError(campaign, "GoalNotReached");
  });

  it("should revert releaseFunds before deadline", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    await expect(campaign.releaseFunds()).to.be.revertedWithCustomError(campaign, "DeadlineNotReached");
  });

  it("should start streaming to creator after deadline when goal met", async function () {
    const amount = ethers.parseEther("10");
    await campaign.connect(contributor1).contribute({ value: amount });
    await advancePastDeadline();

    const contractBalanceBefore = await ethers.provider.getBalance(campaign.target);
    const tx = await campaign.connect(owner).releaseFunds();

    await expect(tx).to.emit(campaign, "StreamStarted");
    const contractBalanceAfter = await ethers.provider.getBalance(campaign.target);

    // No lump-sum transfer; funds remain in escrow until creator pulls.
    expect(contractBalanceAfter).to.equal(contractBalanceBefore);
    expect(await campaign.fundsWithdrawn()).to.be.true;
    expect(await campaign.fundsReleased()).to.be.false;
    expect(await campaign.streamTotalAmount()).to.equal(amount);
    expect(await campaign.streamWithdrawnAmount()).to.equal(0n);
  });

  it("should stream funds pro-rata per second via withdrawFromStream", async function () {
    const amount = ethers.parseEther("10");
    const durationSeconds = 10n;
    const elapsedSeconds1 = 5n;

    await campaign.connect(contributor1).contribute({ value: amount });
    await advancePastDeadline();

    const txStart = await campaign.connect(owner).startStreaming(durationSeconds);
    await expect(txStart).to.emit(campaign, "StreamStarted");
    const startTime = await campaign.streamStartTime();

    // Advance half the duration.
    await ethers.provider.send("evm_increaseTime", [Number(elapsedSeconds1)]);
    await ethers.provider.send("evm_mine", []);

    const balanceBefore = await ethers.provider.getBalance(owner.address);

    const tx1 = await campaign.connect(owner).withdrawFromStream();
    await expect(tx1).to.emit(campaign, "StreamWithdrawn");

    const receipt1 = await tx1.wait();
    const gasUsed1 = receipt1.gasUsed * receipt1.gasPrice;

    const block1 = await ethers.provider.getBlock(receipt1.blockNumber);
    const timestamp1 = BigInt(block1!.timestamp);
    const endTime = startTime + durationSeconds;
    const elapsed1Actual = timestamp1 < endTime ? timestamp1 - startTime : durationSeconds;
    const expectedDue1 = (amount * elapsed1Actual) / durationSeconds;

    expect(await campaign.streamWithdrawnAmount()).to.equal(expectedDue1);
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(amount - expectedDue1);
    const balanceAfter1 = await ethers.provider.getBalance(owner.address);
    expect(balanceAfter1).to.equal(balanceBefore + expectedDue1 - gasUsed1);
    expect(await campaign.fundsReleased()).to.be.false;

    // Advance to the end and withdraw remaining.
    const remaining = Number(durationSeconds - elapsedSeconds1 + 1n);
    await ethers.provider.send("evm_increaseTime", [remaining]);
    await ethers.provider.send("evm_mine", []);

    const tx2 = await campaign.connect(owner).withdrawFromStream();
    await expect(tx2).to.emit(campaign, "FundsReleased").withArgs(owner.address, amount);

    expect(await campaign.fundsReleased()).to.be.true;
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(0n);
    expect(await campaign.streamWithdrawnAmount()).to.equal(amount);
  });

  it("should calculate streamRatePerSecond correctly (integer division)", async function () {
    const amount = ethers.parseEther("10");
    const durationSeconds = 123n;

    await campaign.connect(contributor1).contribute({ value: amount });
    await advancePastDeadline();

    await campaign.connect(owner).startStreaming(durationSeconds);

    const expectedRate = amount / durationSeconds;
    expect(await campaign.streamRatePerSecond()).to.equal(expectedRate);
  });

  it("should revert withdrawFromStream when claimable due rounds to zero", async function () {
    const amount = ethers.parseEther("10"); // must reach goal to close campaign
    const durationSeconds = 10n ** 25n; // so rate/claimable rounds to 0

    await campaign.connect(contributor1).contribute({ value: amount });
    await advancePastDeadline();
    await campaign.connect(owner).startStreaming(durationSeconds);

    // Next block should still have totalDue == 0 due to integer division.
    await ethers.provider.send("evm_mine", []);

    await expect(campaign.connect(owner).withdrawFromStream()).to.be.revertedWithCustomError(
      campaign,
      "NoStreamFunds"
    );
  });

  it("should support early termination via stopStream()", async function () {
    const amount = ethers.parseEther("10");
    const durationSeconds = 100n;
    const elapsedSeconds = 20n;

    await campaign.connect(contributor1).contribute({ value: amount });
    await advancePastDeadline();

    await campaign.connect(owner).startStreaming(durationSeconds);
    await ethers.provider.send("evm_increaseTime", [Number(elapsedSeconds)]);
    await ethers.provider.send("evm_mine", []);

    const stopTx = await campaign.connect(owner).stopStream();
    await expect(stopTx).to.emit(campaign, "StreamStopped");

    expect(await campaign.streamWithdrawnAmount()).to.equal(amount);
    expect(await campaign.fundsReleased()).to.be.true;
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(0n);
  });

  it("stopStream should withdraw remaining after partial withdrawFromStream", async function () {
    const amount = ethers.parseEther("10");
    const durationSeconds = 100n;

    await campaign.connect(contributor1).contribute({ value: amount });
    await advancePastDeadline();

    await campaign.connect(owner).startStreaming(durationSeconds);
    await ethers.provider.send("evm_increaseTime", [30]);
    await ethers.provider.send("evm_mine", []);

    await campaign.connect(owner).withdrawFromStream();

    expect(await campaign.fundsReleased()).to.be.false;

    const withdrawn = await campaign.streamWithdrawnAmount();
    const remainingExpected = amount - withdrawn;
    const stopTx = await campaign.connect(owner).stopStream();
    await expect(stopTx)
      .to.emit(campaign, "StreamStopped")
      .withArgs(owner.address, remainingExpected, amount);

    expect(await campaign.streamWithdrawnAmount()).to.equal(amount);
    expect(await campaign.fundsReleased()).to.be.true;
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(0n);
  });

  it("should prevent overlapping streams (start while active)", async function () {
    const amount = ethers.parseEther("10");
    const durationSeconds = 100n;

    await campaign.connect(contributor1).contribute({ value: amount });
    await advancePastDeadline();

    await campaign.connect(owner).startStreaming(durationSeconds);

    // Attempt to start again before the first stream ends.
    await expect(campaign.connect(owner).startStreaming(50n)).to.be.revertedWithCustomError(
      campaign,
      "AlreadyWithdrawn"
    );
  });

  it("should revert stopStream after stream end time (stream already ended)", async function () {
    const amount = ethers.parseEther("10");
    const durationSeconds = 10n;

    await campaign.connect(contributor1).contribute({ value: amount });
    await advancePastDeadline();

    await campaign.connect(owner).startStreaming(durationSeconds);
    await ethers.provider.send("evm_increaseTime", [Number(durationSeconds + 1n)]);
    await ethers.provider.send("evm_mine", []);

    await expect(campaign.connect(owner).stopStream()).to.be.revertedWithCustomError(
      campaign,
      "StreamAlreadyEnded"
    );
  });

  it("should revert double release", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    await advancePastDeadline();
    await campaign.connect(owner).releaseFunds();
    await expect(campaign.connect(owner).releaseFunds()).to.be.revertedWithCustomError(campaign, "AlreadyWithdrawn");
  });

  // --- finalizeAfterDeadline & claimRefund ---
  it("should enable refunds after deadline when goal not met", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("3") });
    await campaign.connect(contributor2).contribute({ value: ethers.parseEther("2") });
    expect(await campaign.refundEnabled()).to.be.false;
    await advancePastDeadline();
    await campaign.finalizeAfterDeadline();
    expect(await campaign.refundEnabled()).to.be.true;
  });

  it("should revert finalizeBeforeDeadline before deadline", async function () {
    await expect(campaign.finalizeAfterDeadline()).to.be.revertedWithCustomError(campaign, "DeadlineNotReached");
  });

  it("should revert double finalize", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("2") });
    await advancePastDeadline();
    await campaign.finalizeAfterDeadline();
    await expect(campaign.finalizeAfterDeadline()).to.be.revertedWithCustomError(campaign, "AlreadyFinalized");
  });

  it("should let contributor claimRefund and emit RefundClaimed when goal not met", async function () {
    const amount = ethers.parseEther("2");
    await campaign.connect(contributor1).contribute({ value: amount });
    await advancePastDeadline();
    await campaign.finalizeAfterDeadline();
    const balanceBefore = await ethers.provider.getBalance(contributor1.address);
    const tx = await campaign.connect(contributor1).claimRefund();
    await expect(tx).to.emit(campaign, "RefundClaimed").withArgs(contributor1.address, amount);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(contributor1.address);
    expect(balanceAfter).to.equal(balanceBefore + amount - gasUsed);
    expect(await campaign.contributions(contributor1.address)).to.equal(0n);
  });

  it("should refund correct amount and update balances", async function () {
    const amount = ethers.parseEther("2");
    await campaign.connect(contributor1).contribute({ value: amount });
    await advancePastDeadline();
    await campaign.finalizeAfterDeadline();
    const balanceBefore = await ethers.provider.getBalance(contributor1.address);
    const tx = await campaign.connect(contributor1).claimRefund();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(contributor1.address);
    expect(await campaign.contributions(contributor1.address)).to.equal(0n);
    expect(balanceAfter).to.equal(balanceBefore + amount - gasUsed);
  });

  it("should revert claimRefund when refund not enabled", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("2") });
    await expect(campaign.connect(contributor1).claimRefund()).to.be.revertedWithCustomError(campaign, "RefundNotEnabled");
  });

  it("should revert double claimRefund", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("2") });
    await advancePastDeadline();
    await campaign.finalizeAfterDeadline();
    await campaign.connect(contributor1).claimRefund();
    await expect(campaign.connect(contributor1).claimRefund()).to.be.revertedWithCustomError(campaign, "NoContribution");
  });

  it("should revert claimRefund for non-contributor", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("2") });
    await advancePastDeadline();
    await campaign.finalizeAfterDeadline();
    await expect(campaign.connect(contributor2).claimRefund()).to.be.revertedWithCustomError(campaign, "NoContribution");
  });

  it("should estimate gas for contribute, releaseFunds, and claimRefund", async function () {
    const amount = ethers.parseEther("1");
    const contributeGas = await campaign.connect(contributor1).contribute.estimateGas({ value: amount });
    expect(contributeGas).to.be.gt(0n);

    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    await advancePastDeadline();
    const releaseGas = await campaign.releaseFunds.estimateGas();
    expect(releaseGas).to.be.gt(0n);
  });

  it("should revert claimRefund before deadline (refund not enabled until finalize)", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("1") });
    await expect(campaign.connect(contributor1).claimRefund()).to.be.revertedWithCustomError(
      campaign,
      "RefundNotEnabled"
    );
  });

  it("should leave contract balance zero after all contributors claim refund", async function () {
    const a1 = ethers.parseEther("2");
    const a2 = ethers.parseEther("3");
    await campaign.connect(contributor1).contribute({ value: a1 });
    await campaign.connect(contributor2).contribute({ value: a2 });
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(a1 + a2);
    await advancePastDeadline();
    await campaign.finalizeAfterDeadline();
    await campaign.connect(contributor1).claimRefund();
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(a2);
    await campaign.connect(contributor2).claimRefund();
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(0n);
  });

  // --- Milestone-based fund releases ---
  it("allows creator to define milestones that sum to 100%", async function () {
    await campaign.setMilestones([25, 25, 25, 25]);
    const m0 = await campaign.milestones(0);
    expect(m0.percentage).to.equal(25);
    expect(m0.released).to.equal(false);
  });

  it("allows contributors to approve a milestone and creator to release proportional funds", async function () {
    // Define 2 milestones: 50% and 50%
    await campaign.setMilestones([50, 50]);

    const amount1 = ethers.parseEther("6");
    const amount2 = ethers.parseEther("4");
    await campaign.connect(contributor1).contribute({ value: amount1 });
    await campaign.connect(contributor2).contribute({ value: amount2 });
    expect(await campaign.totalContributed()).to.equal(ethers.parseEther("10"));
    await advancePastDeadline();

    // Both contributors approve milestone 0
    await campaign.connect(contributor1).approveMilestone(0);
    await campaign.connect(contributor2).approveMilestone(0);

    const balanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await campaign.releaseMilestoneFunds(0);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(owner.address);

    // 50% of totalRaised (10 ETH) = 5 ETH
    expect(balanceAfter).to.equal(balanceBefore + ethers.parseEther("5") - gasUsed);
    expect(await campaign.totalMilestoneReleased()).to.equal(ethers.parseEther("5"));
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(ethers.parseEther("5"));
  });

  it("should revert milestone release if caller is not creator", async function () {
    await campaign.setMilestones([100]);
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    await advancePastDeadline();
    await campaign.connect(contributor1).approveMilestone(0);

    await expect(
      campaign.connect(contributor1).releaseMilestoneFunds(0)
    ).to.be.revertedWithCustomError(campaign, "NotCreator");
  });

  it("should revert milestone release if milestone already released", async function () {
    await campaign.setMilestones([100]);
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    await advancePastDeadline();
    await campaign.connect(contributor1).approveMilestone(0);

    await campaign.releaseMilestoneFunds(0);
    await expect(campaign.releaseMilestoneFunds(0)).to.be.revertedWithCustomError(
      campaign,
      "MilestoneAlreadyReleased"
    );
  });

  it("should revert approve and release for invalid milestone index", async function () {
    // no milestones defined yet; index 0 is invalid
    await expect(
      campaign.connect(contributor1).approveMilestone(0)
    ).to.be.revertedWithCustomError(campaign, "InvalidMilestoneId");

    // creator calling release with invalid index
    await expect(campaign.releaseMilestoneFunds(0)).to.be.revertedWithCustomError(
      campaign,
      "InvalidMilestoneId"
    );
  });

  it("should revert release when approvals are insufficient", async function () {
    // contributor1: 6 ETH, contributor2: 4 ETH
    await campaign.setMilestones([100]);
    const amount1 = ethers.parseEther("6");
    const amount2 = ethers.parseEther("4");
    await campaign.connect(contributor1).contribute({ value: amount1 });
    await campaign.connect(contributor2).contribute({ value: amount2 });
    await advancePastDeadline();

    // Only contributor1 approves: 6 * 2 = 12, totalContributed = 10 -> passes threshold.
    // So use only contributor2 (4 ETH) so 4 * 2 = 8 < 10.
    const campaign2Goal = ethers.parseEther("10");
    const CampaignFactory = await ethers.getContractFactory("CampaignFactory");
    const factory2 = await CampaignFactory.deploy(owner.address);
    await factory2.waitForDeployment();
    const deadline2 = (await ethers.provider.getBlock("latest")).timestamp + deadlineOffset;
    await factory2.createCampaign(campaign2Goal, deadline2);
    const addr2 = await factory2.campaigns(0);
    const Campaign = await ethers.getContractFactory("Campaign");
    const campaign2 = Campaign.attach(addr2);

    await campaign2.setMilestones([100]);
    await campaign2.connect(contributor1).contribute({ value: amount1 });
    await campaign2.connect(contributor2).contribute({ value: amount2 });
    await ethers.provider.send("evm_increaseTime", [deadlineOffset + 1]);
    await ethers.provider.send("evm_mine", []);

    await campaign2.connect(contributor2).approveMilestone(0);
    await expect(campaign2.releaseMilestoneFunds(0)).to.be.revertedWithCustomError(
      campaign2,
      "MilestoneNotApproved"
    );
  });

  describe("Governance: proposals", function () {
    it("allows creator to create a proposal", async function () {
      await expect(campaign.connect(owner).createProposal("Update campaign details"))
        .to.emit(campaign, "ProposalCreated")
        .withArgs(0, "Update campaign details");
      const p = await campaign.proposals(0);
      expect(p.description).to.equal("Update campaign details");
      expect(p.voteCount).to.equal(0);
      expect(p.executed).to.equal(false);
    });

    it("allows contributor to vote once on proposal and prevents double vote", async function () {
      await campaign.connect(contributor1).contribute({ value: ethers.parseEther("1") });
      await campaign.connect(owner).createProposal("Approve milestone plan");
      await expect(campaign.connect(contributor1).voteProposal(0))
        .to.emit(campaign, "ProposalVoted")
        .withArgs(0, contributor1.address);
      const p = await campaign.proposals(0);
      expect(p.voteCount).to.equal(1);
      await expect(
        campaign.connect(contributor1).voteProposal(0)
      ).to.be.revertedWithCustomError(campaign, "AlreadyVoted");
    });

    it("reverts vote from non-contributor", async function () {
      await campaign.connect(owner).createProposal("Test");
      await expect(
        campaign.connect(contributor1).voteProposal(0)
      ).to.be.revertedWithCustomError(campaign, "NotContributor");
    });

    it("allows creator or admin to execute proposal after votes", async function () {
      await campaign.connect(contributor1).contribute({ value: ethers.parseEther("1") });
      await campaign.connect(owner).createProposal("Allow early withdrawal");
      await campaign.connect(contributor1).voteProposal(0);
      await expect(campaign.connect(owner).executeProposal(0))
        .to.emit(campaign, "ProposalExecuted")
        .withArgs(0);
      const p = await campaign.proposals(0);
      expect(p.executed).to.equal(true);
    });

    it("reverts when executing already executed proposal", async function () {
      await campaign.connect(contributor1).contribute({ value: ethers.parseEther("1") });
      await campaign.connect(owner).createProposal("Test execution");
      await campaign.connect(contributor1).voteProposal(0);
      await campaign.connect(owner).executeProposal(0);
      await expect(
        campaign.connect(owner).executeProposal(0)
      ).to.be.revertedWithCustomError(campaign, "ProposalAlreadyExecuted");
    });
  });

  describe("Fraud detection: report and verify", function () {
    it("should allow users to report campaign", async function () {
      await campaign.connect(contributor1).reportCampaign();
      expect(await campaign.reporters(contributor1.address)).to.be.true;
      expect(await campaign.reportCount()).to.equal(1);
    });

    it("should prevent duplicate report by same user", async function () {
      await campaign.connect(contributor1).reportCampaign();
      await expect(
        campaign.connect(contributor1).reportCampaign()
      ).to.be.revertedWithCustomError(campaign, "AlreadyReported");
    });

    it("should increment report count for each unique reporter", async function () {
      await campaign.connect(contributor1).reportCampaign();
      expect(await campaign.reportCount()).to.equal(1);
      await campaign.connect(contributor2).reportCampaign();
      expect(await campaign.reportCount()).to.equal(2);
    });

    it("should allow only admin to verify campaign", async function () {
      await campaign.connect(owner).verifyCampaign();
      expect(await campaign.isVerified()).to.be.true;
    });

    it("should emit CampaignReported when reported", async function () {
      await expect(campaign.connect(contributor1).reportCampaign())
        .to.emit(campaign, "CampaignReported")
        .withArgs(contributor1.address);
    });

    it("should emit CampaignVerified when admin verifies", async function () {
      await expect(campaign.connect(owner).verifyCampaign())
        .to.emit(campaign, "CampaignVerified")
        .withArgs(owner.address);
    });

    it("non-admin verifying campaign should revert", async function () {
      await expect(
        campaign.connect(contributor1).verifyCampaign()
      ).to.be.revertedWithCustomError(campaign, "NotAdmin");
    });

    it("duplicate report by same address should revert", async function () {
      await campaign.connect(contributor2).reportCampaign();
      await expect(
        campaign.connect(contributor2).reportCampaign()
      ).to.be.revertedWithCustomError(campaign, "AlreadyReported");
    });
  });
});
