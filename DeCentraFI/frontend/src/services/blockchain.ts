import { getContract } from "viem";
import {
  usePublicClient,
  useWalletClient,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { decodeEventLog } from "viem";
import { campaignFactoryAbi } from "../abis/campaignFactory";

const factoryAddress = (import.meta.env.VITE_CAMPAIGN_FACTORY_ADDRESS || "") as `0x${string}`;
const configuredChainId = Number(import.meta.env.VITE_CHAIN_ID ?? "") || 11155111;
const confirmations = Number(import.meta.env.VITE_TX_CONFIRMATIONS ?? "") || 1;

export function useCampaignFactory() {
  const publicClient = usePublicClient({ chainId: configuredChainId });
  const { data: walletClient } = useWalletClient({ chainId: configuredChainId });
  const {
    writeContract,
    data: hash,
    isPending,
    error,
    reset,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({
    hash,
    chainId: configuredChainId,
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
      throw new Error("VITE_CAMPAIGN_FACTORY_ADDRESS is not set");
    }
    writeContract({
      address: factoryAddress,
      abi: campaignFactoryAbi,
      functionName: "createCampaign",
      args: [goalWei, deadlineUnix],
      chainId: configuredChainId,
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
    chainId: configuredChainId,
    isPending: isPending || isConfirming,
    isSuccess,
    error,
    reset,
    getCampaignAddressFromReceipt,
    receipt,
    factoryAddress: factoryAddress && factoryAddress !== "0x" ? factoryAddress : null,
  };
}
