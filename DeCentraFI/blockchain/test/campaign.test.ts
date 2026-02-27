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

  // --- contribute() valid flow and state ---
  it("should accept valid ETH and update totalContributed and contributions mapping", async function () {
    const amount = ethers.parseEther("1");
    await campaign.connect(contributor1).contribute({ value: amount });
    expect(await campaign.totalContributed()).to.equal(amount);
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
    await ethers.provider.send("evm_increaseTime", [deadlineOffset + 1]);
    await ethers.provider.send("evm_mine", []);
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

  it("should accept contributions and emit Contributed + ContributionReceived", async function () {
    const amount = ethers.parseEther("1");
    await expect(campaign.connect(contributor1).contribute({ value: amount }))
      .to.emit(campaign, "Contributed")
      .withArgs(contributor1.address, amount);
    await expect(campaign.connect(contributor1).contribute({ value: amount }))
      .to.emit(campaign, "ContributionReceived")
      .withArgs(contributor1.address, amount);
    expect(await campaign.contributions(contributor1.address)).to.equal(ethers.parseEther("2"));
    expect(await campaign.totalContributed()).to.equal(ethers.parseEther("2"));
  });

  it("should update state correctly after multiple contributors", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("3") });
    await campaign.connect(contributor2).contribute({ value: ethers.parseEther("4") });
    expect(await campaign.totalContributed()).to.equal(ethers.parseEther("7"));
    expect(await campaign.contributions(contributor1.address)).to.equal(ethers.parseEther("3"));
    expect(await campaign.contributions(contributor2.address)).to.equal(ethers.parseEther("4"));
  });

  // --- withdrawFunds() ---
  it("should allow only creator to call withdrawFunds", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    await expect(
      campaign.connect(contributor1).withdrawFunds()
    ).to.be.revertedWithCustomError(campaign, "NotCreator");
  });

  it("should revert withdraw when goal not reached", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("5") });
    await expect(campaign.withdrawFunds()).to.be.revertedWithCustomError(campaign, "GoalNotReached");
  });

  it("should revert withdraw when deadline not passed and goal not reached", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("3") });
    await expect(campaign.withdrawFunds()).to.be.revertedWithCustomError(campaign, "GoalNotReached");
  });

  it("should revert double withdrawal", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    await campaign.withdrawFunds();
    await expect(campaign.withdrawFunds()).to.be.revertedWithCustomError(campaign, "AlreadyWithdrawn");
  });

  it("should transfer contract balance to creator and set fundsWithdrawn", async function () {
    const amount = ethers.parseEther("10");
    await campaign.connect(contributor1).contribute({ value: amount });
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(amount);

    const balanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await campaign.withdrawFunds();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(owner.address);

    expect(await ethers.provider.getBalance(campaign.target)).to.equal(0n);
    expect(await campaign.fundsWithdrawn()).to.be.true;
    expect(balanceAfter).to.equal(balanceBefore + amount - gasUsed);
  });

  it("should close and allow creator to withdraw when goal reached", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    expect(await campaign.closed()).to.be.true;
    const balanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await campaign.withdrawFunds();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(owner.address);
    expect(balanceAfter).to.equal(balanceBefore + ethers.parseEther("10") - gasUsed);
    expect(await campaign.fundsWithdrawn()).to.be.true;
  });

  it("should estimate gas for contribute and withdrawFunds", async function () {
    const amount = ethers.parseEther("1");
    const contributeGas = await campaign.connect(contributor1).contribute.estimateGas({ value: amount });
    expect(contributeGas).to.be.gt(0n);

    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    const withdrawGas = await campaign.withdrawFunds.estimateGas();
    expect(withdrawGas).to.be.gt(0n);
  });

  it("should revert contribute when campaign has ended", async function () {
    await ethers.provider.send("evm_increaseTime", [deadlineOffset + 1]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      campaign.connect(contributor1).contribute({ value: ethers.parseEther("1") })
    ).to.be.revertedWithCustomError(campaign, "CampaignEnded");
  });

  it("should revert contribute when goal already reached", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    await expect(
      campaign.connect(contributor2).contribute({ value: ethers.parseEther("1") })
    ).to.be.revertedWithCustomError(campaign, "GoalReached");
  });
});
