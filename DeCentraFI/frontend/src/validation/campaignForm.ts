/**
 * Client-side validation for campaign form. Aligns with backend and contract rules.
 */

export interface FieldErrors {
  title?: string;
  description?: string;
  goalEth?: string;
  deadline?: string;
}

export function validateCampaignForm(data: {
  title: string;
  description: string;
  goalEth: string;
  deadline: string;
}): { valid: true; goalWei: string } | { valid: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const title = data.title.trim();
  if (!title) {
    errors.title = "Title is required";
  } else if (title.length > 255) {
    errors.title = "Title must be at most 255 characters";
  }

  const description = data.description.trim();
  if (!description) {
    errors.description = "Description is required";
  } else if (description.length > 5000) {
    errors.description = "Description must be at most 5000 characters";
  }

  const goalEth = data.goalEth.trim();
  if (!goalEth) {
    errors.goalEth = "Goal is required";
  } else {
    const num = parseFloat(goalEth);
    if (Number.isNaN(num)) {
      errors.goalEth = "Goal must be a number";
    } else if (num <= 0) {
      errors.goalEth = "Goal must be greater than zero";
    } else if (!Number.isFinite(num) || num > 1e30) {
      errors.goalEth = "Goal is invalid";
    }
  }

  const deadline = data.deadline.trim();
  if (!deadline) {
    errors.deadline = "Deadline is required";
  } else {
    const date = new Date(deadline);
    if (Number.isNaN(date.getTime())) {
      errors.deadline = "Invalid date";
    } else if (date.getTime() <= Date.now()) {
      errors.deadline = "Deadline must be in the future";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  const num = parseFloat(goalEth);
  const goalWei = String(BigInt(Math.floor(num * 1e18)));
  if (BigInt(goalWei) === 0n) {
    errors.goalEth = "Goal must be greater than zero";
    return { valid: false, errors };
  }

  return { valid: true, goalWei };
}
