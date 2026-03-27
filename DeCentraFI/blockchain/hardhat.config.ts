import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
const MAINNET_RPC = process.env.MAINNET_RPC_URL || "";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

function remoteAccounts(): string[] {
  if (PRIVATE_KEY && PRIVATE_KEY.startsWith("0x")) {
    return [PRIVATE_KEY];
  }
  return [];
}

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: SEPOLIA_RPC,
      chainId: 11155111,
      accounts: remoteAccounts(),
    },
    mainnet: {
      url: MAINNET_RPC,
      chainId: 1,
      accounts: remoteAccounts(),
    },
  },
};

export default config;
