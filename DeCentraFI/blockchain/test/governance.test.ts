const { expect } = require("chai");
const { ethers } = require("hardhat");

async function mineBlocks(n) {
  for (let i = 0; i < n; i++) {
    await ethers.provider.send("evm_mine", []);
  }
}

describe("DAO Governance (Governor + Timelock)", function () {
  it("voting weight uses delegated ERC20Votes snapshots", async function () {
    const [deployer, voter1] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("DecentraFiGovernanceToken");
    const token = await Token.deploy(deployer.address);
    await token.waitForDeployment();

    await (await token.mint(voter1.address, ethers.parseEther("123"))).wait();
    // No delegation => 0 votes
    expect(await token.getVotes(voter1.address)).to.equal(0n);

    await (await token.connect(voter1).delegate(voter1.address)).wait();
    // Votes update after a block
    await mineBlocks(1);
    expect(await token.getVotes(voter1.address)).to.equal(ethers.parseEther("123"));
  });

  it("proposal lifecycle: Pending -> Active -> Succeeded -> Queued -> Executed", async function () {
    const [deployer, voter] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("DecentraFiGovernanceToken");
    const token = await Token.deploy(deployer.address);
    await token.waitForDeployment();
    await (await token.mint(voter.address, ethers.parseEther("1000"))).wait();
    await (await token.connect(voter).delegate(voter.address)).wait();

    const Timelock = await ethers.getContractFactory("DecentraFiTimelock");
    const timelock = await Timelock.deploy(1, [], [], deployer.address);
    await timelock.waitForDeployment();

    const Governor = await ethers.getContractFactory("DecentraFiGovernor");
    const governor = await Governor.deploy(
      await token.getAddress(),
      await timelock.getAddress(),
      1,
      5,
      1
    );
    await governor.waitForDeployment();

    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();
    await (await timelock.grantRole(PROPOSER_ROLE, await governor.getAddress())).wait();
    await (await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress)).wait();
    await (await timelock.renounceRole(TIMELOCK_ADMIN_ROLE, deployer.address)).wait();

    const PlatformConfig = await ethers.getContractFactory("PlatformConfig");
    const config = await PlatformConfig.deploy(await timelock.getAddress());
    await config.waitForDeployment();

    const key = ethers.keccak256(ethers.toUtf8Bytes("platform.param"));
    const calldata = config.interface.encodeFunctionData("setUint", [key, 1]);
    const description = "Set param to 1";

    const proposeTx = await governor.propose([config.target], [0], [calldata], description);
    const rc = await proposeTx.wait();
    const proposalId = rc.logs.find((l) => l.fragment && l.fragment.name === "ProposalCreated").args.proposalId;

    expect(await governor.state(proposalId)).to.equal(0); // Pending
    // votingDelay = 1 => becomes Active after snapshot block passes
    await mineBlocks(2);
    expect(await governor.state(proposalId)).to.equal(1); // Active

    await (await governor.connect(voter).castVote(proposalId, 1)).wait();
    await mineBlocks(6);
    expect(await governor.state(proposalId)).to.equal(4); // Succeeded

    const descHash = ethers.id(description);
    await (await governor.queue([config.target], [0], [calldata], descHash)).wait();
    expect(await governor.state(proposalId)).to.equal(5); // Queued
    await ethers.provider.send("evm_increaseTime", [2]);
    await ethers.provider.send("evm_mine", []);
    await (await governor.execute([config.target], [0], [calldata], descHash)).wait();
    expect(await governor.state(proposalId)).to.equal(7); // Executed
    expect(await config.uintParams(key)).to.equal(1);
  });

  it("execution requires quorum; low participation leads to Defeated", async function () {
    const [deployer, whale, smallVoter] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("DecentraFiGovernanceToken");
    const token = await Token.deploy(deployer.address);
    await token.waitForDeployment();
    await (await token.mint(whale.address, ethers.parseEther("10000"))).wait();
    await (await token.mint(smallVoter.address, ethers.parseEther("1"))).wait();
    await (await token.connect(whale).delegate(whale.address)).wait();
    await (await token.connect(smallVoter).delegate(smallVoter.address)).wait();

    const Timelock = await ethers.getContractFactory("DecentraFiTimelock");
    const timelock = await Timelock.deploy(1, [], [], deployer.address);
    await timelock.waitForDeployment();

    // Require 20% quorum
    const Governor = await ethers.getContractFactory("DecentraFiGovernor");
    const governor = await Governor.deploy(
      await token.getAddress(),
      await timelock.getAddress(),
      1,
      5,
      20
    );
    await governor.waitForDeployment();

    const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
    const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
    const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();
    await (await timelock.grantRole(PROPOSER_ROLE, await governor.getAddress())).wait();
    await (await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress)).wait();
    await (await timelock.renounceRole(TIMELOCK_ADMIN_ROLE, deployer.address)).wait();

    const PlatformConfig = await ethers.getContractFactory("PlatformConfig");
    const config = await PlatformConfig.deploy(await timelock.getAddress());
    await config.waitForDeployment();

    const key = ethers.keccak256(ethers.toUtf8Bytes("platform.param2"));
    const calldata = config.interface.encodeFunctionData("setUint", [key, 2]);
    const description = "Set param to 2";
    const proposeTx = await governor.propose([config.target], [0], [calldata], description);
    const rc = await proposeTx.wait();
    const proposalId = rc.logs.find((l) => l.fragment && l.fragment.name === "ProposalCreated").args.proposalId;

    await mineBlocks(1);
    // Only small voter participates: should not reach quorum
    await (await governor.connect(smallVoter).castVote(proposalId, 1)).wait();
    await mineBlocks(6);
    expect(await governor.state(proposalId)).to.equal(3); // Defeated
  });

  it("edge case: double voting is rejected", async function () {
    const [deployer, voter] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("DecentraFiGovernanceToken");
    const token = await Token.deploy(deployer.address);
    await token.waitForDeployment();
    await (await token.mint(voter.address, ethers.parseEther("100"))).wait();
    await (await token.connect(voter).delegate(voter.address)).wait();

    const Timelock = await ethers.getContractFactory("DecentraFiTimelock");
    const timelock = await Timelock.deploy(1, [], [], deployer.address);
    await timelock.waitForDeployment();

    const Governor = await ethers.getContractFactory("DecentraFiGovernor");
    const governor = await Governor.deploy(await token.getAddress(), await timelock.getAddress(), 1, 5, 1);
    await governor.waitForDeployment();

    const PlatformConfig = await ethers.getContractFactory("PlatformConfig");
    const config = await PlatformConfig.deploy(await timelock.getAddress());
    await config.waitForDeployment();

    const key = ethers.keccak256(ethers.toUtf8Bytes("platform.doublevote"));
    const calldata = config.interface.encodeFunctionData("setUint", [key, 1]);
    const description = "Double vote test";

    const proposeTx = await governor.propose([config.target], [0], [calldata], description);
    const rc = await proposeTx.wait();
    const proposalId = rc.logs.find((l) => l.fragment && l.fragment.name === "ProposalCreated").args.proposalId;

    await mineBlocks(1);
    await (await governor.connect(voter).castVote(proposalId, 1)).wait();
    await expect(governor.connect(voter).castVote(proposalId, 1)).to.be.reverted;
  });

  it("edge case: invalid proposals are rejected (mismatched arrays / wrong description hash)", async function () {
    const [deployer, voter] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("DecentraFiGovernanceToken");
    const token = await Token.deploy(deployer.address);
    await token.waitForDeployment();
    await (await token.mint(voter.address, ethers.parseEther("1000"))).wait();
    await (await token.connect(voter).delegate(voter.address)).wait();

    const Timelock = await ethers.getContractFactory("DecentraFiTimelock");
    const timelock = await Timelock.deploy(1, [], [], deployer.address);
    await timelock.waitForDeployment();

    const Governor = await ethers.getContractFactory("DecentraFiGovernor");
    const governor = await Governor.deploy(await token.getAddress(), await timelock.getAddress(), 1, 5, 1);
    await governor.waitForDeployment();

    const PlatformConfig = await ethers.getContractFactory("PlatformConfig");
    const config = await PlatformConfig.deploy(await timelock.getAddress());
    await config.waitForDeployment();

    const key = ethers.keccak256(ethers.toUtf8Bytes("platform.invalid"));
    const calldata = config.interface.encodeFunctionData("setUint", [key, 9]);

    // mismatched lengths should revert
    await expect(
      governor.propose([config.target], [0, 0], [calldata], "bad arrays")
    ).to.be.reverted;

    // create a valid proposal, succeed it, then try queue with wrong description hash
    const description = "Valid proposal";
    const proposeTx = await governor.propose([config.target], [0], [calldata], description);
    const rc = await proposeTx.wait();
    const proposalId = rc.logs.find((l) => l.fragment && l.fragment.name === "ProposalCreated").args.proposalId;
    await mineBlocks(1);
    await (await governor.connect(voter).castVote(proposalId, 1)).wait();
    await mineBlocks(6);
    expect(await governor.state(proposalId)).to.equal(4); // Succeeded

    const wrongHash = ethers.id("Wrong description");
    await expect(
      governor.queue([config.target], [0], [calldata], wrongHash)
    ).to.be.reverted;
  });

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

    const streamDurationSeconds = 10n; // keep test fast
    const calldataRelease = campaign.interface.encodeFunctionData("daoStartStreaming", [streamDurationSeconds]);
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

    const exec2 = await governor.execute(
      [campaign.target, campaign.target],
      [0, 0],
      [calldataVerify, calldataRelease],
      descHash2
    );
    const rc2 = await exec2.wait();

    expect(await campaign.isVerified()).to.equal(true);

    // DAO starts the stream; funds are not transferred lump-sum.
    expect(await campaign.fundsWithdrawn()).to.equal(true);
    expect(await campaign.fundsReleased()).to.equal(false);
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(goal);

    // Advance to the end of the stream and let creator pull the remaining escrow.
    await ethers.provider.send("evm_increaseTime", [Number(streamDurationSeconds + 1n)]);
    await ethers.provider.send("evm_mine", []);

    const creatorBalBeforeWithdraw = await ethers.provider.getBalance(deployer.address);
    const txWithdraw = await campaign.connect(deployer).withdrawFromStream();
    const rcWithdraw = await txWithdraw.wait();
    const gasUsedWithdraw = rcWithdraw.gasUsed * rcWithdraw.gasPrice;
    const creatorBalAfterWithdraw = await ethers.provider.getBalance(deployer.address);

    expect(await campaign.fundsReleased()).to.equal(true);
    expect(await ethers.provider.getBalance(campaign.target)).to.equal(0n);
    expect(creatorBalAfterWithdraw).to.equal(creatorBalBeforeWithdraw + goal - gasUsedWithdraw);
  });
});

