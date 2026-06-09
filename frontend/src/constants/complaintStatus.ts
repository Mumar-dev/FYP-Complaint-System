/**
 * Centralized complaint status constants.
 * Used across dashboard, complaint list, and detail pages.
 */

export const COMPLAINT_STATUS = {
  PENDING: 'pending',
  PENDING_ASSIGNMENT: 'pending_assignment',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  REJECTED: 'rejected',
} as const;

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  pending_assignment: 'Awaiting Assignment',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
};

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  pending_assignment: 'bg-orange-100 text-orange-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
};
