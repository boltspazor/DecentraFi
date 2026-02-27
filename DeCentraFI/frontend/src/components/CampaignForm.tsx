import { useState } from "react";

export interface CampaignFormData {
  title: string;
  description: string;
  goalEth: string;
  goalWei: string;
  deadline: string;
}

interface CampaignFormProps {
  onSubmit: (data: CampaignFormData) => void | Promise<void>;
  isSubmitting?: boolean;
}

export function CampaignForm({ onSubmit, isSubmitting = false }: CampaignFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goalEth, setGoalEth] = useState("");
  const [deadline, setDeadline] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const goalWei = goalEth ? String(BigInt(Math.floor(parseFloat(goalEth) * 1e18))) : "0";
    onSubmit({ title, description, goalEth, goalWei, deadline });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 max-w-md"
    >
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Campaign title"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder="Describe your campaign"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div>
        <label htmlFor="goal" className="block text-sm font-medium text-gray-700 mb-1">
          Goal (ETH)
        </label>
        <input
          id="goal"
          type="text"
          inputMode="decimal"
          value={goalEth}
          onChange={(e) => setGoalEth(e.target.value)}
          required
          placeholder="e.g. 1.5"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <div>
        <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">
          Deadline
        </label>
        <input
          id="deadline"
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? "Creating…" : "Create Campaign"}
      </button>
    </form>
  );
}
