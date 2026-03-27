import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { CampaignForm, CampaignFormData } from "../components/CampaignForm";
import { useCampaignFactory } from "../services/blockchain";
import * as api from "../services/api";
import { getTransactionErrorMessage } from "../utils/errorMessages";
import { recordWalletTransaction } from "../services/walletTransactions";

const SEPOLIA_ETHERSCAN = "https://sepolia.etherscan.io/tx/";

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
    if (chainId !== undefined && chainId !== sepolia.id) {
      setSubmitError("Switch to Sepolia network first");
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

  const isWrongNetwork = isConnected && chainId !== undefined && chainId !== sepolia.id;
  const isSubmitting = isTxPending;
  const canSubmit = isConnected && !isWrongNetwork && !isSubmitting;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Campaign</h1>

      {successTxHash && (
        <div className="mb-4 p-4 rounded bg-green-50 text-green-800 border border-green-200" role="alert">
          <p className="font-medium">Campaign created successfully</p>
          <p className="text-sm mt-1">Redirecting to home…</p>
          <a
            href={`${SEPOLIA_ETHERSCAN}${successTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm mt-2 inline-block text-green-700 underline"
          >
            View transaction on Etherscan
          </a>
        </div>
      )}

      {!isConnected && (
        <p className="mb-4 text-amber-700 bg-amber-50 p-3 rounded" role="status">
          Connect your wallet to create a campaign.
        </p>
      )}

      {isWrongNetwork && switchChain && (
        <div className="mb-4 p-3 rounded bg-amber-50 text-amber-800 border border-amber-200">
          <p className="font-medium">Wrong network</p>
          <p className="text-sm mt-1">Please switch to Sepolia testnet to create a campaign.</p>
          <button
            type="button"
            disabled={isSwitchPending}
            onClick={() => switchChain({ chainId: sepolia.id })}
            className="mt-2 px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
          >
            {isSwitchPending ? "Switching…" : "Switch to Sepolia"}
          </button>
        </div>
      )}

      {txError && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200" role="alert">
          {getTransactionErrorMessage(txError)}
        </div>
      )}

      {submitError && (
        <div className="mb-4 p-3 rounded bg-red-50 text-red-700 border border-red-200" role="alert">
          {submitError}
        </div>
      )}

      <CampaignForm
        onSubmit={(data) => {
          sessionStorage.setItem("decentrafi_create_form", JSON.stringify(data));
          handleSubmit(data);
        }}
        isSubmitting={isSubmitting}
      />

      {canSubmit && (
        <p className="mt-4 text-sm text-gray-500">
          You will be asked to confirm the transaction in your wallet. Ensure you are on Sepolia.
        </p>
      )}
    </div>
  );
}
