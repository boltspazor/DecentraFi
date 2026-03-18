const { expect } = require("chai");
const { ethers } = require("hardhat");

async function mineBlocks(n) {
  for (let i = 0; i < n; i++) {
    await ethers.provider.send("evm_mine", []);
  }
}

describe("DAO Governance (Governor + Timelock)", function () {
  it("executes platform change and campaign actions via proposals", async function () {
    const [deployer, voter1, voter2, contributor] = await ethers.getSigners();

    // Deploy token
    const Token = await ethers.getContractFactory("DecentraFiGovernanceToken");
    const token = await Token.deploy(deployer.address);
    await token.waitForDeployment();

    // Mint and delegate voting power
    await (await token.mint(deployer.address, ethers.parseEther("1000"))).wait();
    await (await token.mint(voter1.address, ethers.parseEther("1000"))).wait();
    await (await token.mint(voter2.address, ethers.parseEther("1000"))).wait();

    await (await token.connect(deployer).delegate(deployer.address)).wait();
    await (await token.connect(voter1).delegate(voter1.address)).wait();
    await (await token.connect(voter2).delegate(voter2.address)).wait();

    // Timelock (short delay for test)
    const Timelock = await ethers.getContractFactory("DecentraFiTimelock");
    const timelock = await Timelock.deploy(1, [], [], deployer.address);
    await timelock.waitForDeployment();

    // Governor
    const Governor = await ethers.getContractFactory("DecentraFiGovernor");
    const governor = await Governor.deploy(
      await token.getAddress(),
      await timelock.getAddress(),
      1, // votingDelay blocks
      10, // votingPeriod blocks
      1 // quorum 1%
    );
    await governor.waitForDeployment();

    // Wire roles
    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();
    await (await timelock.grantRole(PROPOSER_ROLE, await governor.getAddress())).wait();
    await (await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress)).wait();
    await (await timelock.renounceRole(TIMELOCK_ADMIN_ROLE, deployer.address)).wait();

    // Platform config owned by timelock
    const PlatformConfig = await ethers.getContractFactory("PlatformConfig");
    const config = await PlatformConfig.deploy(await timelock.getAddress());
    await config.waitForDeployment();

    // Factory uses timelock as admin (so DAO can verify campaign + release funds)
    const Factory = await ethers.getContractFactory("CampaignFactory");
    const factory = await Factory.deploy(await timelock.getAddress());
    await factory.waitForDeployment();

    const block = await ethers.provider.getBlock("latest");
    const deadline = block.timestamp + 60; // 60 seconds from now
    const goal = ethers.parseEther("1");
    await (await factory.connect(deployer).createCampaign(goal, deadline)).wait();
    const campaignAddr = await factory.campaigns(0);
    const Campaign = await ethers.getContractFactory("Campaign");
    const campaign = Campaign.attach(campaignAddr);

    // Contribute to reach goal
    await (await campaign.connect(contributor).contribute({ value: goal })).wait();
    expect(await campaign.closed()).to.equal(true);

    // --- Proposal 1: platform change ---
    const key = ethers.keccak256(ethers.toUtf8Bytes("platform.feeBps"));
    const calldata1 = config.interface.encodeFunctionData("setUint", [key, 250]);
    const description1 = "Set platform fee to 2.5%";

    const proposeTx1 = await governor.propose([config.target], [0], [calldata1], description1);
    const proposeRc1 = await proposeTx1.wait();
    const proposalId1 = proposeRc1.logs.find((l) => l.fragment && l.fragment.name === "ProposalCreated").args.proposalId;

    // wait votingDelay
    await mineBlocks(1);
    await (await governor.connect(voter1).castVote(proposalId1, 1)).wait(); // for
    await (await governor.connect(voter2).castVote(proposalId1, 1)).wait();
    await mineBlocks(11); // votingPeriod + 1
    expect(await governor.state(proposalId1)).to.equal(4); // Succeeded

    const descHash1 = ethers.id(description1);
    await (await governor.queue([config.target], [0], [calldata1], descHash1)).wait();
    expect(await governor.state(proposalId1)).to.equal(5); // Queued
    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine", []);
    await (await governor.execute([config.target], [0], [calldata1], descHash1)).wait();
    expect(await config.uintParams(key)).to.equal(250);

    // --- Proposal 2: campaign approval (verify) + fund release ---
    // verifyCampaign is onlyAdmin (timelock) => DAO can call.
    const calldataVerify = campaign.interface.encodeFunctionData("verifyCampaign", []);

    // advance time beyond deadline so funds can be released
    await ethers.provider.send("evm_increaseTime", [65]);
    await ethers.provider.send("evm_mine", []);

    const calldataRelease = campaign.interface.encodeFunctionData("daoReleaseFunds", []);
    const description2 = "Verify campaign and release escrow funds";

    const proposeTx2 = await governor.propose(
      [campaign.target, campaign.target],
      [0, 0],
      [calldataVerify, calldataRelease],
      description2
    );
    const proposeRc2 = await proposeTx2.wait();
    const proposalId2 = proposeRc2.logs.find((l) => l.fragment && l.fragment.name === "ProposalCreated").args.proposalId;

    await mineBlocks(1);
    await (await governor.connect(voter1).castVote(proposalId2, 1)).wait();
    await (await governor.connect(voter2).castVote(proposalId2, 1)).wait();
    await mineBlocks(11);
    expect(await governor.state(proposalId2)).to.equal(4); // Succeeded

    const descHash2 = ethers.id(description2);
    await (await governor.queue([campaign.target, campaign.target], [0, 0], [calldataVerify, calldataRelease], descHash2)).wait();
    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine", []);

    const creatorBalBefore = await ethers.provider.getBalance(deployer.address);
    const exec2 = await governor.execute(
      [campaign.target, campaign.target],
      [0, 0],
      [calldataVerify, calldataRelease],
      descHash2
    );
    const rc2 = await exec2.wait();
    const gasUsed2 = rc2.gasUsed * rc2.gasPrice;
    const creatorBalAfter = await ethers.provider.getBalance(deployer.address);

    expect(await campaign.isVerified()).to.equal(true);
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(0n);
    expect(creatorBalAfter).to.equal(creatorBalBefore + goal - gasUsed2);
  });
});

