import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { ROUTES } from '@constants/index';
import LoginPage from '@pages/Auth/LoginPage';
import RegisterPage from '@pages/Auth/RegisterPage';
import DashboardLayout from '@layouts/DashboardLayout';

import ForgotPasswordPage from '@pages/Auth/ForgotPasswordPage';
import VerifyOTPPage from '@pages/Auth/VerifyOTPPage';
import ResetPasswordPage from '@pages/Auth/ResetPasswordPage';

// Resident Pages
import ResidentDashboard from '@pages/Resident/DashboardPage';
import SubmitComplaintPage from '@pages/Resident/SubmitComplaintPage';
import ResidentComplaintListPage from '@pages/Resident/ResidentComplaintListPage';
import ComplaintDetailPage from '@pages/Resident/ComplaintDetailPage';
import FeedbackFormPage from '@pages/Resident/FeedbackFormPage';
import ProfilePage from '@pages/Resident/ProfilePage';

// Staff Pages
import StaffDashboard from '@pages/Staff/DashboardPage';
import AssignedComplaintsPage from '@pages/Staff/AssignedComplaintsPage';
import CompletedWorkPage from '@pages/Staff/CompletedWorkPage';
import StaffHRHubPage from '@pages/Staff/StaffHRHubPage';
import StaffRequestsPage from '@pages/Staff/StaffRequestsPage';
import StaffWarningsPage from '@pages/Staff/StaffWarningsPage';
import StaffComplaintDetailPage from '@pages/Staff/StaffComplaintDetailPage';
import StaffNotificationsPage from '@pages/Staff/StaffNotificationsPage';

// Supervisor Pages
import SupervisorApprovalsPage from '@pages/Supervisor/SupervisorApprovalsPage';

// Department Pages
import DepartmentDashboard from '@pages/Department/DashboardPage';
import DepartmentStaffPage from '@pages/Department/StaffPage';
import DepartmentComplaintsPage from '@pages/Department/ComplaintsPage';
import DepartmentComplaintDetailPage from '@pages/Department/ComplaintDetailPage';
import DepartmentPerformancePage from '@pages/Department/PerformancePage';
import DepartmentStaffAttendancePage from '@pages/Department/StaffAttendancePage';
import DepartmentStaffRequestsPage from '@pages/Department/StaffRequestsPage';
import DepartmentStaffShiftsPage from '@pages/Department/StaffShiftsPage';

// Admin Pages
import AdminDashboard from '@pages/Admin/AdminDashboard';
import AdminDepartmentsPage from '@pages/Admin/DepartmentsPage';
import AdminApproveResidentsPage from '@pages/Admin/ApproveResidentsPage';
import AdminTransferRequestsPage from '@pages/Admin/AdminTransferRequestsPage';
import DepartmentDetailPage from '@pages/Admin/DepartmentDetailPage';
import CreateStaffPage from '@pages/Admin/CreateStaffPage';
import AdminHRManagementPage from '@pages/Admin/AdminHRManagementPage';
import AdminSlaManagementPage from '@pages/Admin/AdminSlaManagementPage';

// SuperAdmin Pages
import SuperAdminDashboard from '@pages/SuperAdmin/DashboardPage';
import SuperAdminAnalyticsPage from '@pages/SuperAdmin/AnalyticsPage';
import SuperAdminReportsPage from '@pages/SuperAdmin/ReportsPage';
import SuperAdminRequestsPage from '@pages/SuperAdmin/RequestsPage';
import SuperAdminAuditLogsPage from '@pages/SuperAdmin/AuditLogsPage';
import AdminPerformancePage from '@pages/SuperAdmin/AdminPerformancePage';
import ResidentFeedbackPage from '@pages/SuperAdmin/ResidentFeedbackPage';

// Common pages
import CommonProfilePage from '@pages/Common/ProfilePage';
import HelpSupportPage from '@pages/Common/HelpSupportPage';
import SettingsPage from '@pages/Common/SettingsPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 mx-auto text-primary-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-secondary-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  if (requiredRole && user?.role !== requiredRole && user?.role !== 'superadmin') {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
};

const RootRedirect: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  switch (user.role) {
    case 'resident':
      return <Navigate to={ROUTES.RESIDENT_DASHBOARD} replace />;
    case 'staff':
      return <Navigate to={ROUTES.STAFF_DASHBOARD} replace />;
    case 'supervisor':
      return <Navigate to={ROUTES.SUPERVISOR_DASHBOARD} replace />;
    case 'department_head':
      return <Navigate to={ROUTES.DEPARTMENT_DASHBOARD} replace />;
    case 'admin':
      return <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />;
    case 'superadmin':
      return <Navigate to={ROUTES.SUPERADMIN_DASHBOARD} replace />;
    default:
      return <Navigate to={ROUTES.LOGIN} replace />;
  }
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
      <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
      <Route path={ROUTES.VERIFY_OTP} element={<VerifyOTPPage />} />
      <Route path={ROUTES.RESET_PASSWORD} element={<ResetPasswordPage />} />
      <Route path={ROUTES.HELP_SUPPORT} element={<HelpSupportPage />} />

      {/* Resident Routes */}
      <Route path={ROUTES.RESIDENT_DASHBOARD} element={<ProtectedRoute requiredRole="resident"><ResidentDashboard /></ProtectedRoute>} />
      <Route path={ROUTES.RESIDENT_SUBMIT_COMPLAINT} element={<ProtectedRoute requiredRole="resident"><SubmitComplaintPage /></ProtectedRoute>} />
      <Route path={ROUTES.RESIDENT_MY_COMPLAINTS} element={<ProtectedRoute requiredRole="resident"><ResidentComplaintListPage /></ProtectedRoute>} />
      <Route path={ROUTES.RESIDENT_COMPLAINT_DETAIL} element={<ProtectedRoute requiredRole="resident"><ComplaintDetailPage /></ProtectedRoute>} />
      <Route path={ROUTES.RESIDENT_FEEDBACK} element={<ProtectedRoute requiredRole="resident"><FeedbackFormPage /></ProtectedRoute>} />
      <Route path={ROUTES.RESIDENT_PROFILE} element={<ProtectedRoute requiredRole="resident"><ProfilePage /></ProtectedRoute>} />

      {/* Staff Routes */}
      <Route path={ROUTES.STAFF_DASHBOARD} element={<ProtectedRoute requiredRole="staff"><StaffDashboard /></ProtectedRoute>} />
      <Route path={ROUTES.STAFF_ASSIGNED_COMPLAINTS} element={<ProtectedRoute requiredRole="staff"><AssignedComplaintsPage /></ProtectedRoute>} />
      <Route path={ROUTES.STAFF_COMPLAINT_DETAIL} element={<ProtectedRoute requiredRole="staff"><StaffComplaintDetailPage /></ProtectedRoute>} />
      <Route path={ROUTES.STAFF_NOTIFICATIONS} element={<ProtectedRoute requiredRole="staff"><StaffNotificationsPage /></ProtectedRoute>} />
      <Route path={ROUTES.STAFF_COMPLETED_WORK} element={<ProtectedRoute requiredRole="staff"><CompletedWorkPage /></ProtectedRoute>} />
      <Route path={ROUTES.STAFF_HR_HUB} element={<ProtectedRoute requiredRole="staff"><StaffHRHubPage /></ProtectedRoute>} />
      <Route path={ROUTES.STAFF_REQUESTS} element={<ProtectedRoute requiredRole="staff"><StaffRequestsPage /></ProtectedRoute>} />
      <Route path={ROUTES.STAFF_WARNINGS} element={<ProtectedRoute requiredRole="staff"><StaffWarningsPage /></ProtectedRoute>} />

      {/* Supervisor Routes */}
      <Route path={ROUTES.SUPERVISOR_DASHBOARD} element={<ProtectedRoute requiredRole="supervisor"><SupervisorApprovalsPage /></ProtectedRoute>} />
      <Route path={ROUTES.SUPERVISOR_COMPLAINTS} element={<ProtectedRoute requiredRole="supervisor"><DepartmentComplaintsPage /></ProtectedRoute>} />
      <Route path={ROUTES.SUPERVISOR_APPROVALS} element={<ProtectedRoute requiredRole="supervisor"><SupervisorApprovalsPage /></ProtectedRoute>} />
      <Route path={ROUTES.SUPERVISOR_PERFORMANCE} element={<ProtectedRoute requiredRole="supervisor"><DepartmentPerformancePage /></ProtectedRoute>} />

      {/* Department Routes */}
      <Route path={ROUTES.DEPARTMENT_DASHBOARD} element={<ProtectedRoute requiredRole="department_head"><DepartmentDashboard /></ProtectedRoute>} />
      <Route path={ROUTES.DEPARTMENT_STAFF} element={<ProtectedRoute requiredRole="department_head"><DepartmentStaffPage /></ProtectedRoute>} />
      <Route path={ROUTES.DEPARTMENT_ATTENDANCE} element={<ProtectedRoute requiredRole="department_head"><DepartmentStaffAttendancePage /></ProtectedRoute>} />
      <Route path={ROUTES.DEPARTMENT_SHIFTS} element={<ProtectedRoute requiredRole="department_head"><DepartmentStaffShiftsPage /></ProtectedRoute>} />
      <Route path={ROUTES.DEPARTMENT_REQUESTS} element={<ProtectedRoute requiredRole="department_head"><DepartmentStaffRequestsPage /></ProtectedRoute>} />
      <Route path={ROUTES.DEPARTMENT_COMPLAINTS} element={<ProtectedRoute requiredRole="department_head"><DepartmentComplaintsPage /></ProtectedRoute>} />
      <Route path={ROUTES.DEPARTMENT_COMPLAINT_DETAIL} element={<ProtectedRoute requiredRole="department_head"><DepartmentComplaintDetailPage /></ProtectedRoute>} />
      <Route path={ROUTES.DEPARTMENT_STAFF_PERFORMANCE} element={<ProtectedRoute requiredRole="department_head"><DepartmentPerformancePage /></ProtectedRoute>} />
      <Route path={ROUTES.DEPARTMENT_SERVICE_RECORD} element={<ProtectedRoute requiredRole="department_head"><StaffWarningsPage /></ProtectedRoute>} />

      {/* Admin Routes */}
      <Route path={ROUTES.ADMIN_DASHBOARD} element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path={ROUTES.ADMIN_DEPARTMENTS} element={<ProtectedRoute requiredRole="admin"><AdminDepartmentsPage /></ProtectedRoute>} />
      <Route path={ROUTES.ADMIN_DEPARTMENT_DETAIL} element={<ProtectedRoute requiredRole="admin"><DepartmentDetailPage /></ProtectedRoute>} />
      <Route path={ROUTES.ADMIN_CREATE_STAFF} element={<ProtectedRoute requiredRole="admin"><CreateStaffPage /></ProtectedRoute>} />
      <Route path={ROUTES.ADMIN_APPROVE_RESIDENTS} element={<ProtectedRoute requiredRole="admin"><AdminApproveResidentsPage /></ProtectedRoute>} />
      <Route path={ROUTES.ADMIN_TRANSFER_REQUESTS} element={<ProtectedRoute requiredRole="admin"><AdminTransferRequestsPage /></ProtectedRoute>} />
      <Route path={ROUTES.ADMIN_HR_MANAGEMENT} element={<ProtectedRoute requiredRole="admin"><AdminHRManagementPage /></ProtectedRoute>} />
      <Route path={ROUTES.ADMIN_SLA_MANAGEMENT} element={<ProtectedRoute requiredRole="admin"><AdminSlaManagementPage /></ProtectedRoute>} />

      {/* SuperAdmin Routes */}
      <Route path={ROUTES.SUPERADMIN_DASHBOARD} element={<ProtectedRoute requiredRole="superadmin"><SuperAdminDashboard /></ProtectedRoute>} />
      <Route path={ROUTES.SUPERADMIN_ANALYTICS} element={<ProtectedRoute requiredRole="superadmin"><SuperAdminAnalyticsPage /></ProtectedRoute>} />
      <Route path={ROUTES.SUPERADMIN_REPORTS} element={<ProtectedRoute requiredRole="superadmin"><SuperAdminReportsPage /></ProtectedRoute>} />
      <Route path={ROUTES.SUPERADMIN_AUDIT_LOGS} element={<ProtectedRoute requiredRole="superadmin"><SuperAdminAuditLogsPage /></ProtectedRoute>} />
      <Route path={ROUTES.SUPERADMIN_REQUESTS} element={<ProtectedRoute requiredRole="superadmin"><SuperAdminRequestsPage /></ProtectedRoute>} />
      <Route path={ROUTES.SUPERADMIN_ADMIN_PERFORMANCE} element={<ProtectedRoute requiredRole="superadmin"><AdminPerformancePage /></ProtectedRoute>} />
      <Route path={ROUTES.SUPERADMIN_FEEDBACK} element={<ProtectedRoute requiredRole="superadmin"><ResidentFeedbackPage /></ProtectedRoute>} />

      {/* Common Routes */}
      <Route path={ROUTES.PROFILE} element={<ProtectedRoute><CommonProfilePage /></ProtectedRoute>} />
      <Route path={ROUTES.SETTINGS} element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

      {/* Default Catch-all */}
      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
    </Routes>
  );
};

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;
