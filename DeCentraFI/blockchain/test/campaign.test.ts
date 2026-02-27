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

  it("should accept contributions", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("1") });
    expect(await campaign.contributions(contributor1.address)).to.equal(ethers.parseEther("1"));
    expect(await campaign.totalContributed()).to.equal(ethers.parseEther("1"));
  });

  it("should close and allow creator to withdraw when goal reached", async function () {
    await campaign.connect(contributor1).contribute({ value: ethers.parseEther("10") });
    expect(await campaign.closed()).to.be.true;
    const balanceBefore = await ethers.provider.getBalance(owner.address);
    const tx = await campaign.withdraw();
    const receipt = await tx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const balanceAfter = await ethers.provider.getBalance(owner.address);
    expect(balanceAfter).to.equal(balanceBefore + ethers.parseEther("10") - gasUsed);
  });

  it("should revert contribute when campaign has ended", async function () {
    await ethers.provider.send("evm_increaseTime", [deadlineOffset + 1]);
    await ethers.provider.send("evm_mine", []);
    await expect(
      campaign.connect(contributor1).contribute({ value: ethers.parseEther("1") })
    ).to.be.revertedWithCustomError(campaign, "CampaignEnded");
  });
});
