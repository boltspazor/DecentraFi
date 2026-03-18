import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  // --- DAO stack ---
  const Token = await ethers.getContractFactory("DecentraFiGovernanceToken");
  const token = await Token.deploy(deployer.address);
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log("Governance token deployed:", tokenAddr);

  // Mint + delegate votes to deployer (for quick testing)
  await (await token.mint(deployer.address, ethers.parseEther("1000000"))).wait();
  await (await token.delegate(deployer.address)).wait();

  const minDelaySeconds = 60; // change as needed
  const Timelock = await ethers.getContractFactory("DecentraFiTimelock");
  const timelock = await Timelock.deploy(minDelaySeconds, [], [], deployer.address);
  await timelock.waitForDeployment();
  const timelockAddr = await timelock.getAddress();
  console.log("Timelock deployed:", timelockAddr);

  const votingDelayBlocks = 1;
  const votingPeriodBlocks = 25; // ~5 minutes on local hardhat if 12s blocks; adjust per chain
  const quorumPercent = 4;
  const Governor = await ethers.getContractFactory("DecentraFiGovernor");
  const governor = await Governor.deploy(tokenAddr, timelockAddr, votingDelayBlocks, votingPeriodBlocks, quorumPercent);
  await governor.waitForDeployment();
  const governorAddr = await governor.getAddress();
  console.log("Governor deployed:", governorAddr);

  // Timelock roles: governor proposes, anyone executes
  const PROPOSER_ROLE = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE();
  const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE();

  await (await timelock.grantRole(PROPOSER_ROLE, governorAddr)).wait();
  await (await timelock.grantRole(EXECUTOR_ROLE, ethers.ZeroAddress)).wait();
  // Renounce admin so timelock is self-governed
  await (await timelock.renounceRole(TIMELOCK_ADMIN_ROLE, deployer.address)).wait();

  const PlatformConfig = await ethers.getContractFactory("PlatformConfig");
  const platformConfig = await PlatformConfig.deploy(timelockAddr);
  await platformConfig.waitForDeployment();
  const platformAddr = await platformConfig.getAddress();
  console.log("PlatformConfig deployed:", platformAddr);

  // --- Campaign factory with DAO timelock as admin ---
  const CampaignFactory = await ethers.getContractFactory("CampaignFactory");
  const factory = await CampaignFactory.deploy(timelockAddr);
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("CampaignFactory deployed to:", factoryAddr);
  console.log("Save this address in frontend .env as VITE_CAMPAIGN_FACTORY_ADDRESS=", factoryAddr);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
