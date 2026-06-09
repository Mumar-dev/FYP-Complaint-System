/**
 * Notification type constants used across the notification system.
 */

export const NOTIFICATION_TYPES = {
  COMPLAINT_CREATED: 'complaint_created',
  COMPLAINT_ASSIGNED: 'complaint_assigned',
  COMPLAINT_UPDATED: 'complaint_updated',
  COMPLAINT_RESOLVED: 'complaint_resolved',
  STAFF_ADDED: 'staff_added',
  DEPARTMENT_UPDATE: 'department_update',
} as const;

export const NOTIFICATION_LABELS: Record<string, string> = {
  complaint_created: 'New Complaint',
  complaint_assigned: 'Complaint Assigned',
  complaint_updated: 'Complaint Updated',
  complaint_resolved: 'Complaint Resolved',
  staff_added: 'New Staff Member',
  department_update: 'Department Update',
};

export const NOTIFICATION_ICONS: Record<string, string> = {
  complaint_created: '📋',
  complaint_assigned: '👤',
  complaint_updated: '🔄',
  complaint_resolved: '✅',
  staff_added: '🆕',
  department_update: '🏢',
};
