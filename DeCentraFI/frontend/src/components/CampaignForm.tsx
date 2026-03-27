import { useState } from "react";
import { validateCampaignForm, type FieldErrors } from "../validation/campaignForm";

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

const initialErrors: FieldErrors = {};

export function CampaignForm({ onSubmit, isSubmitting = false }: CampaignFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goalEth, setGoalEth] = useState("");
  const [deadline, setDeadline] = useState("");
  const [errors, setErrors] = useState<FieldErrors>(initialErrors);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(initialErrors);

    const result = validateCampaignForm({ title, description, goalEth, deadline });
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }

    onSubmit({
      title: title.trim(),
      description: description.trim(),
      goalEth,
      goalWei: result.goalWei,
      deadline,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
          Title
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
          }}
          required
          placeholder="Campaign title"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? "title-error" : undefined}
          className={`w-full px-3 py-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:ring-indigo-400 ${errors.title ? "border-red-500" : "border-gray-300 dark:border-slate-600"}`}
        />
        {errors.title && (
          <p id="title-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.title}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
          }}
          required
          placeholder="Describe your campaign"
          rows={4}
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? "description-error" : undefined}
          className={`w-full px-3 py-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:ring-indigo-400 ${errors.description ? "border-red-500" : "border-gray-300 dark:border-slate-600"}`}
        />
        {errors.description && (
          <p id="description-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.description}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="goal" className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
          Goal (ETH)
        </label>
        <input
          id="goal"
          type="text"
          inputMode="decimal"
          value={goalEth}
          onChange={(e) => {
            setGoalEth(e.target.value);
            if (errors.goalEth) setErrors((prev) => ({ ...prev, goalEth: undefined }));
          }}
          required
          placeholder="e.g. 1.5"
          aria-invalid={!!errors.goalEth}
          aria-describedby={errors.goalEth ? "goal-error" : undefined}
          className={`w-full px-3 py-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:ring-indigo-400 ${errors.goalEth ? "border-red-500" : "border-gray-300 dark:border-slate-600"}`}
        />
        {errors.goalEth && (
          <p id="goal-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.goalEth}
          </p>
        )}
      </div>
      <div>
        <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">
          Deadline
        </label>
        <input
          id="deadline"
          type="datetime-local"
          value={deadline}
          onChange={(e) => {
            setDeadline(e.target.value);
            if (errors.deadline) setErrors((prev) => ({ ...prev, deadline: undefined }));
          }}
          required
          aria-invalid={!!errors.deadline}
          aria-describedby={errors.deadline ? "deadline-error" : undefined}
          className={`w-full px-3 py-2 border rounded-md bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:ring-indigo-400 ${errors.deadline ? "border-red-500" : "border-gray-300 dark:border-slate-600"}`}
        />
        {errors.deadline && (
          <p id="deadline-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.deadline}
          </p>
        )}
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
