export const campaignFactoryAbi = [
  {
    type: "function",
    name: "createCampaign",
    inputs: [
      { name: "_goal", type: "uint256", internalType: "uint256" },
      { name: "_deadline", type: "uint256", internalType: "uint256" },
    ],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "CampaignCreated",
    inputs: [
      { name: "campaign", type: "address", indexed: true, internalType: "address" },
      { name: "creator", type: "address", indexed: true, internalType: "address" },
      { name: "goal", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "deadline", type: "uint256", indexed: false, internalType: "uint256" },
    ],
  },
] as const;
