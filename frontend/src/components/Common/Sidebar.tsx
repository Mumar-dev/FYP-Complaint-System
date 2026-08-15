import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  History,
  CheckCircle,
  Users,
  Settings,
  BarChart3,
  Building2,
  Shield,
  LogOut,
  ChevronRight,
  Home,
  Clock,
  Calendar,
  CalendarDays,
  Award,
  AlertTriangle,
  ArrowRightLeft,
  FileCheck,
  HelpCircle,
  Sliders,
  Bell,
  UserPlus,
  ShieldAlert,
  FileWarning,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import { ROUTES } from '@constants/index';
import { useGetNotificationsQuery } from '@/features/notification/notification.api';
import { AddStaffModal } from '@/components/Staff/AddStaffModal';
import UserAvatar from './UserAvatar';

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  badge?: string;
  onClick?: () => void;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onClose }) => {
  const { user } = useAuth();
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const location = useLocation();
  const { data: notificationData } = useGetNotificationsQuery(undefined, {
    skip: !user,
    pollingInterval: 30000,
  });

  const unreadCount = (notificationData?.data || []).filter((n: any) => !n.read).length;

  const getMenuByRole = (): MenuSection[] => {
    switch (user?.role) {
      case 'resident':
        return [
          {
            title: 'Resident Portal',
            items: [
              { label: 'Dashboard', icon: <Home className="w-5 h-5" />, path: ROUTES.RESIDENT_DASHBOARD },
              { label: 'Submit a Complaint', icon: <FileText className="w-5 h-5" />, path: ROUTES.RESIDENT_SUBMIT_COMPLAINT },
              { label: 'Complaint History', icon: <History className="w-5 h-5" />, path: ROUTES.RESIDENT_MY_COMPLAINTS },
            ],
          },
        ];

      case 'staff':
        return [
          {
            title: 'Staff Workspace',
            items: [
              { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: ROUTES.STAFF_DASHBOARD },
              { label: 'Assigned Complaints', icon: <FileText className="w-5 h-5" />, path: ROUTES.STAFF_ASSIGNED_COMPLAINTS },
              {
                label: 'Notifications',
                icon: <Bell className="w-5 h-5" />,
                path: ROUTES.STAFF_NOTIFICATIONS,
                badge: unreadCount > 0 ? String(unreadCount) : undefined,
              },
              { label: 'Completed Work', icon: <CheckCircle className="w-5 h-5" />, path: ROUTES.STAFF_COMPLETED_WORK },
              { label: 'My Attendance', icon: <Clock className="w-5 h-5" />, path: ROUTES.STAFF_HR_HUB },
              { label: 'My Requests', icon: <FileText className="w-5 h-5" />, path: ROUTES.STAFF_REQUESTS },
              { label: 'Warnings', icon: <ShieldAlert className="w-5 h-5" />, path: ROUTES.STAFF_WARNINGS },
            ],
          },
        ];

      case 'supervisor':
        return [
          {
            title: 'Supervisor Workspace',
            items: [
              { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: ROUTES.SUPERVISOR_DASHBOARD },
              { label: 'Department Complaints', icon: <FileText className="w-5 h-5" />, path: ROUTES.SUPERVISOR_COMPLAINTS },
              { label: 'Review & Approvals', icon: <FileCheck className="w-5 h-5" />, path: ROUTES.SUPERVISOR_APPROVALS },
              { label: 'Staff Performance', icon: <Award className="w-5 h-5" />, path: ROUTES.SUPERVISOR_PERFORMANCE },
            ],
          },
        ];

      case 'department_head':
        return [
          {
            title: 'Department Operations',
            items: [
              { label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: ROUTES.DEPARTMENT_DASHBOARD },
              { label: 'Complaints', icon: <FileText className="w-5 h-5" />, path: ROUTES.DEPARTMENT_COMPLAINTS },
              { label: 'Staff Members', icon: <Users className="w-5 h-5" />, path: ROUTES.DEPARTMENT_STAFF },
              { label: 'Staff Attendance', icon: <Clock className="w-5 h-5" />, path: ROUTES.DEPARTMENT_ATTENDANCE },
              { label: 'Staff Shifts', icon: <CalendarDays className="w-5 h-5" />, path: ROUTES.DEPARTMENT_SHIFTS },
              { label: 'Staff Requests', icon: <FileCheck className="w-5 h-5" />, path: ROUTES.DEPARTMENT_REQUESTS },
              { label: 'Staff Performance', icon: <BarChart3 className="w-5 h-5" />, path: ROUTES.DEPARTMENT_STAFF_PERFORMANCE },
              { label: 'Service Record', icon: <ShieldAlert className="w-5 h-5" />, path: ROUTES.DEPARTMENT_SERVICE_RECORD },
            ],
          },
        ];

      case 'admin':
        return [
          {
            title: 'Administration',
            items: [
              { label: 'Admin Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: ROUTES.ADMIN_DASHBOARD },
              { label: 'Departments', icon: <Building2 className="w-5 h-5" />, path: ROUTES.ADMIN_DEPARTMENTS },
              { label: 'Resident Approvals', icon: <Users className="w-5 h-5" />, path: ROUTES.ADMIN_APPROVE_RESIDENTS },
              { label: 'Transfer Requests', icon: <ArrowRightLeft className="w-5 h-5" />, path: ROUTES.ADMIN_TRANSFER_REQUESTS },
              { label: 'Workforce Management', icon: <Award className="w-5 h-5" />, path: ROUTES.ADMIN_HR_MANAGEMENT },
              { label: 'SLA Policies', icon: <Sliders className="w-5 h-5" />, path: ROUTES.ADMIN_SLA_MANAGEMENT },
              {
                label: 'Add Staff Member',
                icon: <UserPlus className="w-5 h-5" />,
                onClick: () => setIsAddStaffOpen(true),
              },
            ],
          },
        ];

      case 'superadmin':
        return [
          {
            title: 'Executive Control',
            items: [
              { label: 'Dashboard', icon: <Shield className="w-5 h-5" />, path: ROUTES.SUPERADMIN_DASHBOARD },
              { label: 'Department Approvals', icon: <Building2 className="w-5 h-5" />, path: ROUTES.SUPERADMIN_REQUESTS },
              { label: 'Department Analytics', icon: <BarChart3 className="w-5 h-5" />, path: ROUTES.SUPERADMIN_ANALYTICS },
              { label: 'System Audit Logs', icon: <History className="w-5 h-5" />, path: ROUTES.SUPERADMIN_AUDIT_LOGS },
              { label: 'Admin Performance', icon: <Award className="w-5 h-5" />, path: ROUTES.SUPERADMIN_ADMIN_PERFORMANCE },
              { label: 'Resident Feedback', icon: <MessageSquare className="w-5 h-5" />, path: ROUTES.SUPERADMIN_FEEDBACK },
            ],
          },
        ];

      default:
        return [];
    }
  };

  const menuSections = getMenuByRole();

  return (
    <aside
      className={`
        fixed lg:static top-16 lg:top-0 left-0 bottom-0 w-64 bg-white border-r border-gray-200 z-40
        transition-transform duration-300 ease-in-out flex flex-col h-[calc(100vh-4rem)] lg:h-full flex-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
    >
      {/* Brand Header for Mobile Drawer (Hidden on Desktop since Navbar has Logo) */}
      <div className="p-4 border-b border-gray-100 flex lg:hidden items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">Society CMS</h1>
            <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">
              {user?.role ? user.role.replace('_', ' ') : 'Platform'}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            aria-label="Close menu"
          >
            ✕
          </button>
        )}
      </div>

      {/* Nav List (Independent Vertical Scroll) */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {menuSections.map((section, idx) => (
          <div key={idx}>
            <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              {section.title}
            </p>
            <nav className="space-y-1">
              {section.items.map((item, itemIdx) => {
                if (item.onClick) {
                  return (
                    <button
                      key={itemIdx}
                      type="button"
                      onClick={() => {
                        if (onClose) onClose();
                        item.onClick!();
                      }}
                      className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl font-medium text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-150 cursor-pointer"
                    >
                      <span className="text-gray-400">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                }

                const isActive = item.path ? location.pathname === item.path : false;
                return (
                  <Link
                    key={itemIdx}
                    to={item.path || '#'}
                    onClick={() => {
                      if (onClose) onClose();
                    }}
                    className={`
                      flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150
                      ${isActive
                        ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100 font-semibold'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className={isActive ? 'text-blue-600' : 'text-gray-400'}>{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          {item.badge}
                        </span>
                      )}
                      {isActive && <ChevronRight className="w-4 h-4 text-blue-500" />}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Compact User Profile Section at Bottom of Sidebar */}
      <div className="p-3 border-t border-gray-200 bg-gray-50/70">
        <Link
          to={user?.role === 'resident' ? ROUTES.RESIDENT_PROFILE : ROUTES.PROFILE}
          onClick={() => {
            if (onClose) onClose();
          }}
          className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-white hover:shadow-xs border border-transparent hover:border-gray-200/80 transition-all group"
        >
          {/* Circular Avatar */}
          <UserAvatar
            name={user?.profile?.fullName || user?.email}
            src={user?.profile?.profileImage || user?.profile?.avatar}
            size="sm"
          />

          {/* User Details: Name and Muted Email */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
              {user?.profile?.fullName || user?.email?.split('@')[0]}
            </p>
            {user?.email && (
              <p className="text-[11px] text-gray-400 truncate mt-0.5 leading-none">
                {user.email}
              </p>
            )}
          </div>
        </Link>
      </div>

      {/* Reusable Add Staff Modal for Admin */}
      <AddStaffModal
        isOpen={isAddStaffOpen}
        onClose={() => setIsAddStaffOpen(false)}
      />
    </aside>
  );
};

export default Sidebar;
