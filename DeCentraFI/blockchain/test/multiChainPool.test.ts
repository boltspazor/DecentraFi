const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FundingPoolHome (multi-chain option A)", function () {
  let endpoint;
  let pool;
  let gateway1;
  let gateway2;

  let owner;
  let creator;
  let contributor;

  const srcChainId = 101; // mock remote chain id (LayerZero srcChainId)
  const srcChainId2 = 102;
  let trustedSrcAddressBytes;
  let trustedSrcAddressBytes2;
  let nextNonce;

  async function advancePastDeadline(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  beforeEach(async function () {
    [owner, creator, contributor] = await ethers.getSigners();

    const MockEndpoint = await ethers.getContractFactory("MockLayerZeroEndpoint");
    endpoint = await MockEndpoint.deploy();
    await endpoint.waitForDeployment();

    const Pool = await ethers.getContractFactory("FundingPoolHome");
    pool = await Pool.deploy(await endpoint.getAddress());
    await pool.waitForDeployment();

    const dstChainId = 1;
    const homePool = await pool.getAddress();
    const destinationBytes = ethers.solidityPacked(["address"], [homePool]);

    const Gateway = await ethers.getContractFactory("FundingGateway");
    gateway1 = await Gateway.deploy(await endpoint.getAddress(), dstChainId, homePool, destinationBytes, "0x");
    await gateway1.waitForDeployment();

    gateway2 = await Gateway.deploy(await endpoint.getAddress(), dstChainId, homePool, destinationBytes, "0x");
    await gateway2.waitForDeployment();

    trustedSrcAddressBytes = ethers.solidityPacked(["address"], [await gateway1.getAddress()]);
    trustedSrcAddressBytes2 = ethers.solidityPacked(["address"], [await gateway2.getAddress()]);
    await pool.connect(owner).setTrustedRemote(srcChainId, trustedSrcAddressBytes);
    await pool.connect(owner).setTrustedRemote(srcChainId2, trustedSrcAddressBytes2);
    nextNonce = 1;
  });

  async function createGoalCampaign({ goalWei, deadlineOffsetSeconds }) {
    const deadline = (await ethers.provider.getBlock("latest")).timestamp + deadlineOffsetSeconds;
    const goal = goalWei;
    const nextId = await pool.nextCampaignId();

    await (await pool.connect(creator).createCampaign(goal, deadline)).wait();
    return nextId;
  }

  async function simulateCrossChainDeposit({
    campaignId,
    contributorAddr,
    amountWei,
    nonce,
    gateway,
    srcChainId: srcId,
    srcAddressBytes,
    triggerValueOverride,
  }) {
    const tx = await gateway.connect(contributor).deposit(campaignId, { value: amountWei });
    await tx.wait();

    const payload = await endpoint.lastPayload();
    const value = await endpoint.lastValue();

    // Endpoint calls lzReceive on pool (msg.sender == endpoint address).
    const triggerTx = await endpoint.triggerLzReceive(
      await pool.getAddress(),
      srcId,
      srcAddressBytes,
      nonce ?? nextNonce,
      payload,
      { value: triggerValueOverride ?? value }
    );
    await triggerTx.wait();

    if (nonce === undefined) nextNonce += 1;
  }

  it("credits cross-chain deposits and marks campaign closed at goal", async function () {
    const goal = ethers.parseEther("10");
    const campaignId = await createGoalCampaign({ goalWei: goal, deadlineOffsetSeconds: 100 });

    await simulateCrossChainDeposit({
      campaignId,
      contributorAddr: contributor.address,
      amountWei: ethers.parseEther("6"),
      gateway: gateway1,
      srcChainId: srcChainId,
      srcAddressBytes: trustedSrcAddressBytes,
    });
    let c = await pool.campaigns(campaignId);
    expect(c.totalRaised).to.equal(ethers.parseEther("6"));
    expect(c.closed).to.equal(false);

    await simulateCrossChainDeposit({
      campaignId,
      contributorAddr: contributor.address,
      amountWei: ethers.parseEther("4"),
      gateway: gateway1,
      srcChainId: srcChainId,
      srcAddressBytes: trustedSrcAddressBytes,
    });
    c = await pool.campaigns(campaignId);
    expect(c.totalRaised).to.equal(ethers.parseEther("10"));
    expect(c.closed).to.equal(true);
  });

  it("start/stop stream and withdraws in correct order", async function () {
    const goal = ethers.parseEther("10");
    const campaignId = await createGoalCampaign({ goalWei: goal, deadlineOffsetSeconds: 30 });

    await simulateCrossChainDeposit({
      campaignId,
      contributorAddr: contributor.address,
      amountWei: ethers.parseEther("10"),
      gateway: gateway1,
      srcChainId: srcChainId,
      srcAddressBytes: trustedSrcAddressBytes,
    });

    // After deadline, start streaming.
    await advancePastDeadline(31);

    const duration = 100n;
    const rateExpected = goal / duration;
    await expect(pool.connect(creator).startStreaming(campaignId, duration))
      .to.emit(pool, "StreamStarted");

    expect(await pool.streamRatePerSecond(campaignId)).to.equal(rateExpected);

    // Immediately stop the stream: should withdraw all remaining (i.e., full total).
    const stopTx = await pool.connect(creator).stopStream(campaignId);
    await expect(stopTx).to.emit(pool, "StreamStopped");

    expect((await pool.campaigns(campaignId)).fundsReleased).to.equal(true);
    expect(await pool.escrowBalance(campaignId)).to.equal(0n);
  });

  it("correct rate calculation + pro-rata claim and completion", async function () {
    const goal = ethers.parseEther("10");
    const campaignId = await createGoalCampaign({ goalWei: goal, deadlineOffsetSeconds: 10 });

    await simulateCrossChainDeposit({
      campaignId,
      contributorAddr: contributor.address,
      amountWei: goal,
      gateway: gateway1,
      srcChainId: srcChainId,
      srcAddressBytes: trustedSrcAddressBytes,
    });

    await advancePastDeadline(11);

    const duration = 10n;
    await pool.connect(creator).startStreaming(campaignId, duration);
    const startTime = await pool.streamStartTime(campaignId);

    // At t=5s, due should be floor(10 * 5 / 10) = 5 ETH (wei integer).
    await advancePastDeadline(5);

    const withdrawnBefore = await pool.streamWithdrawnAmount(campaignId);
    expect(withdrawnBefore).to.equal(0n);

    const tx = await pool.connect(creator).withdrawFromStream(campaignId);
    await expect(tx).to.emit(pool, "StreamWithdrawn");
    const receipt = await tx.wait();
    const ts = BigInt((await ethers.provider.getBlock(receipt.blockNumber)).timestamp);
    const endTime = await pool.streamEndTime(campaignId);
    const end = ts < endTime ? ts : endTime;
    const elapsed = end - startTime;
    const expectedDue = (goal * elapsed) / duration;
    expect(await pool.streamWithdrawnAmount(campaignId)).to.equal(expectedDue);

    // Advance to end and withdraw remainder.
    await advancePastDeadline(6);
    const tx2 = await pool.connect(creator).withdrawFromStream(campaignId);
    await expect(tx2).to.emit(pool, "FundsReleased");
    expect(await pool.escrowBalance(campaignId)).to.equal(0n);
    expect((await pool.campaigns(campaignId)).fundsReleased).to.equal(true);
  });

  it("reverts withdrawFromStream when claimable rounds to zero", async function () {
    const goal = ethers.parseEther("1");
    const campaignId = await createGoalCampaign({ goalWei: goal, deadlineOffsetSeconds: 10 });

    await simulateCrossChainDeposit({
      campaignId,
      contributorAddr: contributor.address,
      amountWei: goal,
      gateway: gateway1,
      srcChainId: srcChainId,
      srcAddressBytes: trustedSrcAddressBytes,
    });
    await advancePastDeadline(11);

    // huge duration => integer division rounds down to zero claimable at small elapsed time
    const duration = 10n ** 30n;
    await pool.connect(creator).startStreaming(campaignId, duration);

    await advancePastDeadline(1);
    await expect(pool.connect(creator).withdrawFromStream(campaignId)).to.be.revertedWithCustomError(
      pool,
      "NoStreamFunds"
    );
  });

  it("stopStream early termination after partial withdraw", async function () {
    const goal = ethers.parseEther("10");
    const campaignId = await createGoalCampaign({ goalWei: goal, deadlineOffsetSeconds: 10 });

    await simulateCrossChainDeposit({
      campaignId,
      contributorAddr: contributor.address,
      amountWei: goal,
      gateway: gateway1,
      srcChainId: srcChainId,
      srcAddressBytes: trustedSrcAddressBytes,
    });
    await advancePastDeadline(11);

    const duration = 100n;
    await pool.connect(creator).startStreaming(campaignId, duration);
    const startTime = await pool.streamStartTime(campaignId);

    await advancePastDeadline(20);
    const withdrawTx = await pool.connect(creator).withdrawFromStream(campaignId);
    const receipt = await withdrawTx.wait();
    const ts = BigInt((await ethers.provider.getBlock(receipt.blockNumber)).timestamp);
    const endTime = await pool.streamEndTime(campaignId);
    const end = ts < endTime ? ts : endTime;
    const elapsed = end - startTime;
    const expectedDue = (goal * elapsed) / duration;
    expect(await pool.streamWithdrawnAmount(campaignId)).to.equal(expectedDue);

    const stopTx = await pool.connect(creator).stopStream(campaignId);
    await expect(stopTx).to.emit(pool, "StreamStopped");

    expect(await pool.streamWithdrawnAmount(campaignId)).to.equal(goal);
    expect(await pool.escrowBalance(campaignId)).to.equal(0n);
    expect((await pool.campaigns(campaignId)).fundsReleased).to.equal(true);
  });

  it("prevents overlapping streams: start twice while active", async function () {
    const goal = ethers.parseEther("10");
    const campaignId = await createGoalCampaign({ goalWei: goal, deadlineOffsetSeconds: 10 });

    await simulateCrossChainDeposit({
      campaignId,
      contributorAddr: contributor.address,
      amountWei: goal,
      gateway: gateway1,
      srcChainId: srcChainId,
      srcAddressBytes: trustedSrcAddressBytes,
    });
    await advancePastDeadline(11);

    const duration = 100n;
    await pool.connect(creator).startStreaming(campaignId, duration);

    await expect(pool.connect(creator).startStreaming(campaignId, 50n)).to.be.revertedWithCustomError(
      pool,
      "AlreadyWithdrawn"
    );
  });

  it("reverts stopStream when stream end time already passed", async function () {
    const goal = ethers.parseEther("10");
    const campaignId = await createGoalCampaign({ goalWei: goal, deadlineOffsetSeconds: 10 });

    await simulateCrossChainDeposit({
      campaignId,
      contributorAddr: contributor.address,
      amountWei: goal,
      gateway: gateway1,
      srcChainId: srcChainId,
      srcAddressBytes: trustedSrcAddressBytes,
    });
    await advancePastDeadline(11);

    const duration = 10n;
    await pool.connect(creator).startStreaming(campaignId, duration);

    await advancePastDeadline(11);
    await expect(pool.connect(creator).stopStream(campaignId)).to.be.revertedWithCustomError(
      pool,
      "StreamAlreadyEnded"
    );
  });

  it("unified balance tracking across multiple chains", async function () {
    const goal = ethers.parseEther("10");
    const campaignId = await createGoalCampaign({ goalWei: goal, deadlineOffsetSeconds: 50 });

    await simulateCrossChainDeposit({
      campaignId,
      contributorAddr: contributor.address,
      amountWei: ethers.parseEther("6"),
      gateway: gateway1,
      srcChainId: srcChainId,
      srcAddressBytes: trustedSrcAddressBytes,
    });
    await simulateCrossChainDeposit({
      campaignId,
      contributorAddr: contributor.address,
      amountWei: ethers.parseEther("4"),
      gateway: gateway2,
      srcChainId: srcChainId2,
      srcAddressBytes: trustedSrcAddressBytes2,
    });

    expect((await pool.campaigns(campaignId)).totalRaised).to.equal(goal);
    expect((await pool.campaigns(campaignId)).closed).to.equal(true);
    expect(await pool.escrowBalance(campaignId)).to.equal(goal);
    expect(await pool.contributions(campaignId, contributor.address)).to.equal(goal);
  });

  it("reverts when source chain address bytes don't match trusted remote (chain mismatch)", async function () {
    const goal = ethers.parseEther("10");
    const campaignId = await createGoalCampaign({ goalWei: goal, deadlineOffsetSeconds: 50 });
    const amount = ethers.parseEther("6");

    // Produce a payload from gateway1 deposit.
    await (await gateway1.connect(contributor).deposit(campaignId, { value: amount })).wait();
    const payload = await endpoint.lastPayload();
    const value = await endpoint.lastValue();

    await expect(
      endpoint.triggerLzReceive(
        await pool.getAddress(),
        srcChainId,
        trustedSrcAddressBytes2, // mismatch srcAddress bytes
        999,
        payload,
        { value }
      )
    ).to.be.revertedWith("Untrusted remote");

    expect(await pool.escrowBalance(campaignId)).to.equal(0n);
  });

  it("reverts when bridged value doesn't match payload amount (failed bridge simulation)", async function () {
    const goal = ethers.parseEther("10");
    const campaignId = await createGoalCampaign({ goalWei: goal, deadlineOffsetSeconds: 50 });
    const amount = ethers.parseEther("6");

    await (await gateway1.connect(contributor).deposit(campaignId, { value: amount })).wait();
    const payload = await endpoint.lastPayload();
    const value = await endpoint.lastValue();

    await expect(
      endpoint.triggerLzReceive(
        await pool.getAddress(),
        srcChainId,
        trustedSrcAddressBytes,
        888,
        payload,
        { value: value - 1n } // wrong bridged value
      )
    ).to.be.revertedWith("Mismatched bridged value");

    expect(await pool.escrowBalance(campaignId)).to.equal(0n);
  });

  it("reverts duplicate LayerZero message delivery (duplicate tx)", async function () {
    const goal = ethers.parseEther("10");
    const campaignId = await createGoalCampaign({ goalWei: goal, deadlineOffsetSeconds: 50 });
    const amount = ethers.parseEther("6");

    await (await gateway1.connect(contributor).deposit(campaignId, { value: amount })).wait();
    const payload = await endpoint.lastPayload();
    const value = await endpoint.lastValue();

    const nonce = 777;

    await (await endpoint.triggerLzReceive(
      await pool.getAddress(),
      srcChainId,
      trustedSrcAddressBytes,
      nonce,
      payload,
      { value }
    )).wait();

    await expect(
      endpoint.triggerLzReceive(
        await pool.getAddress(),
        srcChainId,
        trustedSrcAddressBytes,
        nonce,
        payload,
        { value }
      )
    ).to.be.revertedWithCustomError(pool, "DuplicateDeposit");
  });
});

