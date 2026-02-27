import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { CampaignForm, CampaignFormData } from "../components/CampaignForm";
import { useCampaignFactory } from "../services/blockchain";
import * as api from "../services/api";

export function CreateCampaign() {
  const navigate = useNavigate();
  const { address, isConnected, chainId } = useAccount();
  const { switchChain, isPending: isSwitchPending } = useSwitchChain();
  const {
    createCampaign: createOnChain,
    isPending: isTxPending,
    isSuccess: isTxSuccess,
    hash: txHash,
    getCampaignAddressFromReceipt,
    error: txError,
  } = useCampaignFactory();

  const [submitError, setSubmitError] = useState<string | null>(null);

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
    if (!isConnected || !address) {
      setSubmitError("Connect your wallet first");
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
      setSubmitError((e as Error).message);
    }
  };

  // After tx confirms, save to backend and redirect
  useEffect(() => {
    if (!isTxSuccess || !txHash) return;
    const campaignAddress = getCampaignAddressFromReceipt();
    if (!campaignAddress) return;

    const formData = sessionStorage.getItem("decentrafi_create_form");
    if (!formData) return;
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
        navigate("/", { replace: true });
        window.dispatchEvent(new Event("campaigns-refresh"));
      })
      .catch((e) => setSubmitError((e as Error).message));
  }, [isTxSuccess, txHash, address, getCampaignAddressFromReceipt, navigate]);

  const isWrongNetwork = isConnected && chainId !== undefined && chainId !== sepolia.id;
  const isSubmitting = isTxPending;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Campaign</h1>
      {!isConnected && (
        <p className="mb-4 text-amber-700 bg-amber-50 p-3 rounded">
          Connect your wallet to create a campaign.
        </p>
      )}
      {isWrongNetwork && switchChain && (
        <div className="mb-4 p-3 rounded bg-amber-50 text-amber-800">
          <p className="font-medium">Wrong network</p>
          <p className="text-sm mt-1">Please switch to Sepolia testnet.</p>
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
        <p className="mb-4 text-red-700 bg-red-50 p-3 rounded">{txError.message}</p>
      )}
      {submitError && (
        <p className="mb-4 text-red-700 bg-red-50 p-3 rounded">{submitError}</p>
      )}
      <CampaignForm
        onSubmit={(data) => {
          sessionStorage.setItem("decentrafi_create_form", JSON.stringify(data));
          handleSubmit(data);
        }}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
