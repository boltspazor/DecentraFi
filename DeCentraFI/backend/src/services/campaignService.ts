import mongoose from 'mongoose'

export interface ICampaign {
  title: string
  description: string
  goal: string
  deadline: Date
  creator: string
  txHash?: string
  createdAt: Date
}

const campaignSchema = new mongoose.Schema<ICampaign>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    goal: { type: String, required: true },
    deadline: { type: Date, required: true },
    creator: { type: String, required: true },
    txHash: { type: String },
  },
  { timestamps: true }
)

export const Campaign = mongoose.model<ICampaign>('Campaign', campaignSchema)

export async function create(data: {
  title: string
  description: string
  goal: string
  deadline: string
  creator: string
  txHash?: string
}) {
  const campaign = new Campaign({
    ...data,
    deadline: new Date(data.deadline),
  })
  return campaign.save()
}

export async function findAll() {
  return Campaign.find().sort({ createdAt: -1 }).lean()
}

export async function findById(id: string) {
  return Campaign.findById(id).lean()
}
