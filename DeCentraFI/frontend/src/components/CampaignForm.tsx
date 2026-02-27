import { useState } from 'react'

export interface CampaignFormData {
  title: string
  description: string
  goal: string
  deadline: string
}

interface CampaignFormProps {
  onSubmit: (data: CampaignFormData) => void | Promise<void>
  isSubmitting?: boolean
}

export function CampaignForm({ onSubmit, isSubmitting = false }: CampaignFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [goal, setGoal] = useState('')
  const [deadline, setDeadline] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({ title, description, goal, deadline })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 480 }}>
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Campaign title"
          style={{ width: '100%', padding: '0.5rem' }}
        />
      </div>
      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder="Describe your campaign"
          rows={4}
          style={{ width: '100%', padding: '0.5rem' }}
        />
      </div>
      <div>
        <label htmlFor="goal">Goal (wei)</label>
        <input
          id="goal"
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          required
          placeholder="Funding goal in wei"
          style={{ width: '100%', padding: '0.5rem' }}
        />
      </div>
      <div>
        <label htmlFor="deadline">Deadline</label>
        <input
          id="deadline"
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          required
          style={{ width: '100%', padding: '0.5rem' }}
        />
      </div>
      <button type="submit" disabled={isSubmitting} style={{ padding: '0.75rem', cursor: isSubmitting ? 'wait' : 'pointer' }}>
        {isSubmitting ? 'Creating...' : 'Create Campaign'}
      </button>
    </form>
  )
}
