import { CampaignForm, CampaignFormData } from '../components/CampaignForm'

export function CreateCampaign() {
  const handleSubmit = async (data: CampaignFormData) => {
    // TODO: call blockchain + API to create campaign
    console.log('Create campaign:', data)
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 800, margin: '0 auto' }}>
      <h1>Create Campaign</h1>
      <CampaignForm onSubmit={handleSubmit} />
    </div>
  )
}
