import { getContract } from "viem";
import {
  useChainId,
  usePublicClient,
  useWalletClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { decodeEventLog } from "viem";
import { campaignFactoryAbi } from "../abis/campaignFactory";

const sepoliaFactoryAddress = (import.meta.env.VITE_CAMPAIGN_FACTORY_ADDRESS_SEPOLIA || "") as `0x${string}`;
const mainnetFactoryAddress = (import.meta.env.VITE_CAMPAIGN_FACTORY_ADDRESS_MAINNET || "") as `0x${string}`;
const allowMainnet = String(import.meta.env.VITE_ALLOW_MAINNET ?? "false").toLowerCase() === "true";
const confirmations = Number(import.meta.env.VITE_TX_CONFIRMATIONS ?? "") || 1;

function getFactoryAddress(chainId: number): `0x${string}` {
  if (chainId === 11155111) return sepoliaFactoryAddress;
  if (chainId === 1 && allowMainnet) return mainnetFactoryAddress;
  return "0x" as `0x${string}`;
}

export function useCampaignFactory() {
  const chainId = useChainId();
  const factoryAddress = getFactoryAddress(chainId);
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useWalletClient({ chainId });
  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
    chainId,
    confirmations,
  });

  const contract =
    publicClient && factoryAddress && factoryAddress !== "0x"
      ? getContract({
          address: factoryAddress,
          abi: campaignFactoryAbi,
          client: { public: publicClient, wallet: walletClient ?? undefined },
        })
      : null;

  function createCampaign(goalWei: bigint, deadlineUnix: bigint) {
    if (!factoryAddress || factoryAddress === "0x") {
      throw new Error("Campaign factory address is not set for this network");
    }
    writeContract({
      address: factoryAddress,
      abi: campaignFactoryAbi,
      functionName: "createCampaign",
      args: [goalWei, deadlineUnix],
      chainId,
    });
  }

  function getCampaignAddressFromReceipt(): `0x${string}` | null {
    if (!receipt || !receipt.logs.length) return null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: campaignFactoryAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "CampaignCreated" && "campaign" in decoded.args) {
          return decoded.args.campaign as `0x${string}`;
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  return {
    contract,
    createCampaign,
    hash,
    chainId,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
    getCampaignAddressFromReceipt,
    receipt,
    factoryAddress: factoryAddress && factoryAddress !== "0x" ? factoryAddress : null,
  };
}
