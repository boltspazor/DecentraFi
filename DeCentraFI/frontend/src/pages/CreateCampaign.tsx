import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useSwitchChain } from "wagmi";
import { CampaignForm, CampaignFormData } from "../components/CampaignForm";
import { useCampaignFactory } from "../services/blockchain";
import * as api from "../services/api";
import { getTransactionErrorMessage } from "../utils/errorMessages";
import { recordWalletTransaction } from "../services/walletTransactions";
import { getBlockExplorerTxUrl } from "../utils/blockExplorer";
import { PageShell } from "../components/PageShell";
import { SepoliaTestEthPanel } from "../components/SepoliaTestEthPanel";
import { nativeCurrencyLabel } from "../utils/nativeCurrency";

const SUPPORTED_CHAIN_IDS = [1, 11155111] as const;

export function CreateCampaign() {
  const navigate = useNavigate();
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitchPending } = useSwitchChain();
  const {
    createCampaign: createOnChain,
    isPending: isTxPending,
    isSuccess: isTxSuccess,
    hash: txHash,
    chainId: txChainId,
    receipt,
    getCampaignAddressFromReceipt,
    error: txError,
    reset: resetTx,
  } = useCampaignFactory();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!isTxSuccess || !txHash) return;
    const campaignAddress = getCampaignAddressFromReceipt();
    if (!campaignAddress) {
      setSubmitError("Could not read campaign address from transaction");
      return;
    }
    setSubmitError(null);
  }, [isTxSuccess, txHash, getCampaignAddressFromReceipt]);

  const handleSubmit = async (data: CampaignFormData) => {
    setSubmitError(null);
    resetTx?.();
    if (!isConnected || !address) {
      setSubmitError("Connect your wallet first");
      return;
    }
    if (chainId !== undefined && !SUPPORTED_CHAIN_IDS.includes(chainId as (typeof SUPPORTED_CHAIN_IDS)[number])) {
      setSubmitError("Switch to Sepolia or Ethereum mainnet first");
      return;
    }
    const goalWei = BigInt(data.goalWei);
    const deadlineDate = new Date(data.deadline);
    if (deadlineDate.getTime() < Date.now()) {
      setSubmitError("Deadline must be in the future");
      return;
    }
    const deadlineUnix = BigInt(Math.floor(deadlineDate.getTime() / 1000));
    try {
      createOnChain(goalWei, deadlineUnix);
    } catch (e) {
      setSubmitError(getTransactionErrorMessage(e));
    }
  };

  useEffect(() => {
    if (!isTxSuccess || !txHash || savedRef.current) return;
    const campaignAddress = getCampaignAddressFromReceipt();
    if (!campaignAddress) return;

    recordWalletTransaction({
      txHash,
      chainId: txChainId,
      from: receipt?.from,
      to: receipt?.to ?? undefined,
      valueWei: "0",
      gasUsedWei: receipt?.gasUsed ? receipt.gasUsed.toString() : undefined,
      effectiveGasPriceWei: receipt?.effectiveGasPrice ? receipt.effectiveGasPrice.toString() : undefined,
      blockNumber: receipt?.blockNumber ? receipt.blockNumber.toString() : undefined,
      status: receipt?.status === "success" ? "success" : "reverted",
      capturedAtIso: new Date().toISOString(),
    });

    const formData = sessionStorage.getItem("decentrafi_create_form");
    if (!formData) return;

    savedRef.current = true;
    const parsed = JSON.parse(formData) as CampaignFormData;
    sessionStorage.removeItem("decentrafi_create_form");

    api
      .createCampaign({
        title: parsed.title,
        description: parsed.description,
        goal: parsed.goalWei,
        deadline: parsed.deadline,
        creator: address!,
        campaignAddress,
        txHash,
      })
      .then(() => {
        setSuccessTxHash(txHash);
        setTimeout(() => {
          navigate("/", { replace: true });
          window.dispatchEvent(new Event("campaigns-refresh"));
        }, 2500);
      })
      .catch((e: unknown) => {
        savedRef.current = false;
        const msg = e instanceof api.ApiError ? e.message : (e as Error)?.message ?? "Failed to save campaign metadata";
        if (e instanceof api.ApiError && e.status === 409) {
          setSubmitError("This campaign is already registered. It may have been created in another tab.");
        } else {
          setSubmitError(msg);
        }
      });
  }, [isTxSuccess, txHash, address, getCampaignAddressFromReceipt, navigate]);

  const isWrongNetwork =
    isConnected &&
    chainId !== undefined &&
    !SUPPORTED_CHAIN_IDS.includes(chainId as (typeof SUPPORTED_CHAIN_IDS)[number]);
  const isSubmitting = isTxPending;
  const canSubmit = isConnected && !isWrongNetwork && !isSubmitting;

  return (
    <PageShell maxWidth="narrow">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Create campaign</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        Deploy a new campaign contract and list it in the app.
      </p>
      <div className="mt-8 space-y-6">
      <SepoliaTestEthPanel />

      {successTxHash && (
        <div className="mb-4 p-4 rounded bg-green-50 text-green-800 border border-green-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/50" role="alert">
          <p className="font-medium">Campaign created successfully</p>
          <p className="text-sm mt-1">Redirecting to home…</p>
          <a
            href={getBlockExplorerTxUrl(txChainId ?? 11155111, successTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm mt-2 inline-block text-green-700 underline dark:text-emerald-300"
          >
            View transaction on block explorer
          </a>
        </div>
      )}

      {!isConnected && (
        <p className="mb-4 text-amber-800 bg-amber-50 p-3 rounded dark:bg-amber-950/40 dark:text-amber-200 dark:ring-1 dark:ring-amber-900/40" role="status">
          Connect your wallet to create a campaign.
        </p>
      )}

      {isWrongNetwork && switchChain && (
        <div className="mb-4 p-3 rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/50">
          <p className="font-medium">Wrong network</p>
          <p className="text-sm mt-1">Please switch to Sepolia or Ethereum mainnet to create a campaign.</p>
          <button
            type="button"
            disabled={isSwitchPending}
            onClick={() => switchChain({ chainId: 11155111 })}
            className="mt-2 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {isSwitchPending ? "Switching…" : "Switch to Sepolia"}
          </button>
        </div>
      )}

      {txError && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50" role="alert">
          {getTransactionErrorMessage(txError)}
        </div>
      )}

      {submitError && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50" role="alert">
          {submitError}
        </div>
      )}

      <CampaignForm
        currencyLabel={nativeCurrencyLabel(chainId)}
        onSubmit={(data) => {
          sessionStorage.setItem("decentrafi_create_form", JSON.stringify(data));
          handleSubmit(data);
        }}
        isSubmitting={isSubmitting}
      />

      {canSubmit && (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          You will confirm a transaction in your wallet. On Sepolia, gas and campaign stakes use free test ETH from a
          faucet — not real money.
        </p>
      )}
      </div>
    </PageShell>
  );
}
