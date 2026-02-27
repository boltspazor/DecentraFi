const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CampaignFactory", function () {
  let factory;
  let owner;
  let deadlineOffset;

  beforeEach(async function () {
    [owner] = await ethers.getSigners();
    const CampaignFactory = await ethers.getContractFactory("CampaignFactory");
    factory = await CampaignFactory.deploy();
    await factory.waitForDeployment();
    deadlineOffset = 60 * 60 * 24 * 7; // 7 days
  });

  describe("createCampaign", function () {
    it("should deploy a new Campaign and emit CampaignCreated", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + deadlineOffset;
      const goal = ethers.parseEther("5");

      const tx = await factory.createCampaign(goal, deadline);
      const receipt = await tx.wait();

      expect(receipt.logs.length).to.be.gt(0);
      const campaignAddr = await factory.campaigns(0);
      expect(campaignAddr).to.properAddress;

      const Campaign = await ethers.getContractFactory("Campaign");
      const campaign = Campaign.attach(campaignAddr);
      expect(await campaign.creator()).to.equal(owner.address);
      expect(await campaign.goal()).to.equal(goal);
      expect(await campaign.deadline()).to.equal(deadline);
      expect(await campaign.totalContributed()).to.equal(0);
      expect(await campaign.closed()).to.be.false;
    });

    it("should revert when goal is zero", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + deadlineOffset;

      await expect(factory.createCampaign(0, deadline)).to.be.revertedWithCustomError(
        factory,
        "InvalidGoal"
      );
    });

    it("should revert when deadline is in the past", async function () {
      const block = await ethers.provider.getBlock("latest");
      const pastDeadline = block.timestamp - 1;
      const goal = ethers.parseEther("1");

      await expect(factory.createCampaign(goal, pastDeadline)).to.be.revertedWithCustomError(
        factory,
        "InvalidDeadline"
      );
    });

    it("should revert when deadline is current block", async function () {
      const block = await ethers.provider.getBlock("latest");
      const goal = ethers.parseEther("1");

      await expect(factory.createCampaign(goal, block.timestamp)).to.be.revertedWithCustomError(
        factory,
        "InvalidDeadline"
      );
    });

    it("should return the deployed campaign address", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + deadlineOffset;
      const goal = ethers.parseEther("2");

      const addr = await factory.createCampaign.staticCall(goal, deadline);
      expect(addr).to.properAddress;

      const tx = await factory.createCampaign(goal, deadline);
      await tx.wait();
      expect(await factory.campaigns(0)).to.equal(addr);
    });
  });

  describe("getCampaigns", function () {
    it("should return empty array when no campaigns", async function () {
      const addrs = await factory.getCampaigns();
      expect(addrs).to.deep.equal([]);
    });

    it("should return all deployed campaign addresses", async function () {
      const block = await ethers.provider.getBlock("latest");
      const deadline = block.timestamp + deadlineOffset;
      await factory.createCampaign(ethers.parseEther("1"), deadline);
      await factory.createCampaign(ethers.parseEther("2"), deadline + 1);

      const addrs = await factory.getCampaigns();
      expect(addrs.length).to.equal(2);
      expect(addrs[0]).to.properAddress;
      expect(addrs[1]).to.properAddress;
      expect(addrs[0]).to.not.equal(addrs[1]);
    });
  });
});
