import type { UserRole } from '@/types/common';

// User Roles
export const USER_ROLES: Record<UserRole, string> = {
  resident: 'Resident',
  staff: 'Staff',
  supervisor: 'Supervisor',
  department_head: 'Department Head',
  admin: 'Admin',
  superadmin: 'Super Admin',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  resident: 'File and track complaints',
  staff: 'Handle assigned complaints & time tracking',
  supervisor: 'Oversee department staff, assignments, and approvals',
  department_head: 'Manage department resources and complaints',
  admin: 'Manage society operations, HR, and approvals',
  superadmin: 'System-wide administration and audit logs',
};

// Complaint Status
export const COMPLAINT_STATUS = {
  PENDING: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  ASSIGNED: { label: 'Assigned', color: 'bg-blue-100 text-blue-800' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-indigo-100 text-indigo-800' },
  RESOLVED: { label: 'Resolved', color: 'bg-emerald-100 text-emerald-800' },
  CLOSED: { label: 'Closed', color: 'bg-gray-100 text-gray-800' },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
  REOPENED: { label: 'Reopened', color: 'bg-amber-100 text-amber-800' },
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800' },
  'in-progress': { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-800' },
} as const;

// Complaint Priority
export const COMPLAINT_PRIORITY = {
  LOW: { label: 'Low', color: 'bg-slate-100 text-slate-800' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-800' },
  HIGH: { label: 'High', color: 'bg-amber-100 text-amber-800' },
  CRITICAL: { label: 'Critical', color: 'bg-red-100 text-red-800' },
  low: { label: 'Low', color: 'bg-green-100 text-green-800' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'High', color: 'bg-red-100 text-red-800' },
} as const;

// Staff Status
export const STAFF_STATUS = {
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  ON_LEAVE: { label: 'On Leave', color: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  SUSPENDED: { label: 'Suspended', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  available: { label: 'Available', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  busy: { label: 'Busy', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  offline: { label: 'Offline', color: 'bg-gray-100 text-gray-800', dot: 'bg-gray-500' },
} as const;

// Route Configurations
export const ROUTES = {
  // Auth
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  VERIFY_OTP: '/verify-otp',
  RESET_PASSWORD: '/reset-password',

  // Resident
  RESIDENT_DASHBOARD: '/resident/dashboard',
  RESIDENT_SUBMIT_COMPLAINT: '/resident/submit-complaint',
  RESIDENT_MY_COMPLAINTS: '/resident/my-complaints',
  RESIDENT_COMPLAINT_DETAIL: '/resident/complaint/:id',
  RESIDENT_FEEDBACK: '/resident/feedback/:id',
  RESIDENT_PROFILE: '/resident/profile',

  // Staff
  STAFF_DASHBOARD: '/staff/dashboard',
  STAFF_ASSIGNED_COMPLAINTS: '/staff/assigned-complaints',
  STAFF_COMPLAINT_DETAIL: '/staff/complaints/:id',
  STAFF_COMPLETED_WORK: '/staff/completed-work',
  STAFF_NOTIFICATIONS: '/staff/notifications',
  STAFF_HR_HUB: '/staff/hr-hub',
  STAFF_REQUESTS: '/staff/requests',
  STAFF_WARNINGS: '/staff/warnings',

  // Supervisor
  SUPERVISOR_DASHBOARD: '/supervisor/dashboard',
  SUPERVISOR_COMPLAINTS: '/supervisor/complaints',
  SUPERVISOR_APPROVALS: '/supervisor/approvals',
  SUPERVISOR_PERFORMANCE: '/supervisor/performance',

  // Department Head
  DEPARTMENT_DASHBOARD: '/department/dashboard',
  DEPARTMENT_STAFF: '/department/staff',
  DEPARTMENT_ADD_STAFF: '/department/staff/add',
  DEPARTMENT_STAFF_PERFORMANCE: '/department/staff/performance',
  DEPARTMENT_STAFF_DETAIL: '/department/staff/:id',
  DEPARTMENT_COMPLAINTS: '/department/complaints',
  DEPARTMENT_COMPLAINT_DETAIL: '/department/complaint/:id',
  DEPARTMENT_ATTENDANCE: '/department/attendance',
  DEPARTMENT_SHIFTS: '/department/shifts',
  DEPARTMENT_REQUESTS: '/department/requests',
  DEPARTMENT_SERVICE_RECORD: '/department/service-record',
  DEPARTMENT_PROFILE: '/department/profile',
  DEPARTMENT_HELP: '/department/help',

  // Admin
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_DEPARTMENTS: '/admin/departments',
  ADMIN_DEPARTMENT_DETAIL: '/admin/departments/:id',
  ADMIN_CREATE_STAFF: '/admin/staff/create',
  ADMIN_APPROVE_RESIDENTS: '/admin/approve-residents',
  ADMIN_TRANSFER_REQUESTS: '/admin/transfer-requests',
  ADMIN_HR_MANAGEMENT: '/admin/hr-management',
  ADMIN_SLA_MANAGEMENT: '/admin/sla-management',

  // SuperAdmin
  SUPERADMIN_DASHBOARD: '/superadmin/dashboard',
  SUPERADMIN_ANALYTICS: '/superadmin/analytics',
  SUPERADMIN_REPORTS: '/superadmin/reports',
  SUPERADMIN_REQUESTS: '/superadmin/requests',
  SUPERADMIN_AUDIT_LOGS: '/superadmin/audit-logs',
  SUPERADMIN_ADMIN_PERFORMANCE: '/superadmin/admin-performance',
  SUPERADMIN_FEEDBACK: '/superadmin/feedback',

  // Common Routes (Available to all roles)
  PROFILE: '/profile',
  HELP_SUPPORT: '/help-support',
  SETTINGS: '/settings',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  LOGIN: '/api/auth/login',
  SIGNUP: '/api/auth/register',
  LOGOUT: '/api/auth/logout',
  REFRESH_TOKEN: '/api/auth/refresh',
  COMPLAINTS: '/api/complaints',
  COMPLAINT_DETAIL: '/api/complaints/:id',
  FEEDBACK: '/api/feedback',
  STAFF: '/api/staff',
  DEPARTMENTS: '/api/departments',
  EMPLOYEES: '/api/employees',
  SHIFTS: '/api/shifts',
  ATTENDANCE: '/api/attendance',
  LEAVES: '/api/leaves',
  PERFORMANCE: '/api/performance',
  PROMOTIONS: '/api/promotions',
  TRANSFERS: '/api/employee-transfers',
  DISCIPLINARY: '/api/disciplinary',
  SLA: '/api/sla',
  AUDIT_LOGS: '/api/dashboard/audit-logs',
} as const;

export const LOCAL_STORAGE_KEYS = {
  AUTH_TOKEN: 'cms_auth_token',
  REFRESH_TOKEN: 'cms_refresh_token',
  USER: 'cms_user',
  REMEMBER_ME: 'cms_remember_me',
  SELECTED_ROLE: 'cms_selected_role',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_ALREADY_EXISTS: 'Email already registered',
  WEAK_PASSWORD: 'Password must be at least 8 characters',
  PASSWORDS_NOT_MATCH: 'Passwords do not match',
  NETWORK_ERROR: 'Network error. Please try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNAUTHORIZED: 'You are not authorized to access this resource',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  INTERNAL_ERROR: 'An unexpected error occurred',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful',
  SIGNUP_SUCCESS: 'Account created successfully',
  LOGOUT_SUCCESS: 'Logged out successfully',
  COMPLAINT_CREATED: 'Complaint submitted successfully',
  COMPLAINT_UPDATED: 'Complaint updated successfully',
  FEEDBACK_SUBMITTED: 'Feedback submitted successfully',
} as const;
