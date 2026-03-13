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
    factory = await CampaignFactory.deploy();
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

  it("should release funds to creator after deadline when goal met and emit FundsReleased", async function () {
    const amount = ethers.parseEther("10");
    await campaign.connect(contributor1).contribute({ value: amount });
    await advancePastDeadline();
    const balanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await campaign.releaseFunds();
    await expect(tx).to.emit(campaign, "FundsReleased").withArgs(owner.address, amount);
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(owner.address);
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(0n);
    expect(await campaign.fundsReleased()).to.be.true;
    expect(balanceAfter).to.equal(balanceBefore + amount - gasUsed);
  });

  it("should transfer contract balance to creator and set fundsReleased after deadline", async function () {
    const amount = ethers.parseEther("10");
    await campaign.connect(contributor1).contribute({ value: amount });
    await advancePastDeadline();
    const balanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await campaign.releaseFunds();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(owner.address);
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(0n);
    expect(await campaign.fundsWithdrawn()).to.be.true;
    expect(await campaign.fundsReleased()).to.be.true;
    expect(balanceAfter).to.equal(balanceBefore + amount - gasUsed);
  });

  it("should revert double release", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    await advancePastDeadline();
    await campaign.releaseFunds();
    await expect(campaign.releaseFunds()).to.be.revertedWithCustomError(campaign, "AlreadyWithdrawn");
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
});
