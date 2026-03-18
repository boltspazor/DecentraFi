const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SupporterNFT", function () {
  let nft;
  let owner;
  let other;

  beforeEach(async function () {
    [owner, other] = await ethers.getSigners();
    const SupporterNFT = await ethers.getContractFactory("SupporterNFT");
    nft = await SupporterNFT.deploy("Decentrigy Supporter", "DSUP");
    await nft.waitForDeployment();
  });

  it("mints NFT after qualifying contribution and sets correct owner", async function () {
    const amount = ethers.parseEther("0.5"); // qualifies for at least Silver
    const tokenUri = "ipfs://silver-metadata";

    const tx = await nft.connect(owner).mintSupporterNFT(other.address, amount, tokenUri);
    const receipt = await tx.wait();
    const event = receipt.logs.find(
      (l) => l.fragment && l.fragment.name === "NFTMinted"
    );
    expect(event).to.not.be.undefined;
    const tokenId = event.args.tokenId;

    expect(await nft.ownerOf(tokenId)).to.equal(other.address);
    expect(await nft.tokenURI(tokenId)).to.equal(tokenUri);
  });

  it("prevents duplicate or lower-level NFT mints for same supporter", async function () {
    const bronzeAmount = ethers.parseEther("0.1");
    const goldAmount = ethers.parseEther("1");

    await nft.mintSupporterNFT(other.address, bronzeAmount, "ipfs://bronze");
    // Cannot mint Bronze again
    await expect(
      nft.mintSupporterNFT(other.address, bronzeAmount, "ipfs://bronze-2")
    ).to.be.revertedWith("Level already granted");

    // Upgrade to Gold is allowed
    await nft.mintSupporterNFT(other.address, goldAmount, "ipfs://gold");

    // Cannot downgrade or re-mint Gold
    await expect(
      nft.mintSupporterNFT(other.address, bronzeAmount, "ipfs://bronze-again")
    ).to.be.revertedWith("Level already granted");
  });

  it("reverts when contribution is below Bronze threshold", async function () {
    const below = ethers.parseEther("0.05");
    await expect(
      nft.mintSupporterNFT(other.address, below, "ipfs://below")
    ).to.be.revertedWith("Contribution below thresholds");
  });

  it("reverts when contributor is zero address", async function () {
    const amount = ethers.parseEther("0.5");
    await expect(
      nft.mintSupporterNFT(ethers.ZeroAddress, amount, "ipfs://silver")
    ).to.be.revertedWith("Invalid contributor");
  });

  it("prevents non-owner from minting", async function () {
    const amount = ethers.parseEther("0.5");
    await expect(
      nft.connect(other).mintSupporterNFT(other.address, amount, "ipfs://silver")
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });
});

