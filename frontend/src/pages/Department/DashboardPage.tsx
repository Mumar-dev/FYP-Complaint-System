import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Loader,
  Users,
  BarChart3,
  Download,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import { ROUTES } from '@constants/index';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface StaffMember {
  _id: string;
  profile: {
    fullName: string;
  };
  email: string;
  role?: string;
  status?: string;
}

interface DepartmentData {
  _id: string;
  name: string;
  slaTargetHours: number;
  staffCount?: number;
}

interface ComplaintStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

const DepartmentDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [departmentData, setDepartmentData] = useState<DepartmentData | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [complaintStats, setComplaintStats] = useState<ComplaintStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch department data
  useEffect(() => {
    const fetchDepartmentData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!user?.departmentId) {
          setError('No department assigned to user');
          setLoading(false);
          return;
        }

        // Fetch department details
        const deptRes = await axios.get(
          `http://localhost:5000/api/departments/${user.departmentId}`,
          { withCredentials: true }
        );
        setDepartmentData(deptRes.data.data);

        // Fetch department staff
        const staffRes = await axios.get(
          `http://localhost:5000/api/departments/${user.departmentId}/staff`,
          { withCredentials: true }
        );
        setStaffMembers(staffRes.data.data || []);

        // Fetch complaints for this department
        const complaintsRes = await axios.get(
          `http://localhost:5000/api/complaints`,
          { withCredentials: true }
        );

        const allComplaints = complaintsRes.data.data || [];
        const deptComplaints = allComplaints.filter(
          (c: any) => c.departmentId === user.departmentId
        );

        setComplaintStats({
          total: deptComplaints.length,
          pending: deptComplaints.filter((c: any) => c.status === 'pending').length,
          inProgress: deptComplaints.filter((c: any) => c.status === 'in_progress').length,
          completed: deptComplaints.filter((c: any) => c.status === 'completed').length,
        });

        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching department data:', err);
        setError(err.response?.data?.message || 'Failed to load department data');
        setLoading(false);
      }
    };

    fetchDepartmentData();
  }, [user?.departmentId]);

  // Helper for staff initials
  const getInitials = (name: string) => {
    if (!name) return 'S';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Avatar pastel colors cycling
  const avatarColors = [
    'bg-blue-100 text-blue-700 border-blue-200',
    'bg-emerald-100 text-emerald-700 border-emerald-200',
    'bg-indigo-100 text-indigo-700 border-indigo-200',
    'bg-purple-100 text-purple-700 border-purple-200',
    'bg-teal-100 text-teal-700 border-teal-200',
    'bg-sky-100 text-sky-700 border-sky-200',
  ];

  // Calculate stats from real data
  const stats = useMemo(() => {
    return [
      {
        label: 'Total Complaints',
        value: complaintStats.total.toString(),
        icon: ClipboardList,
        bgColor: 'bg-blue-50',
        textColor: 'text-blue-600',
        borderColor: 'border-blue-100',
      },
      {
        label: 'Pending',
        value: complaintStats.pending.toString(),
        icon: AlertCircle,
        bgColor: 'bg-rose-50',
        textColor: 'text-rose-600',
        borderColor: 'border-rose-100',
      },
      {
        label: 'In Progress',
        value: complaintStats.inProgress.toString(),
        icon: TrendingUp,
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-600',
        borderColor: 'border-amber-100',
      },
      {
        label: 'Completed',
        value: complaintStats.completed.toString(),
        icon: CheckCircle2,
        bgColor: 'bg-emerald-50',
        textColor: 'text-emerald-600',
        borderColor: 'border-emerald-100',
      },
    ];
  }, [complaintStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader className="animate-spin h-10 w-10 mx-auto text-blue-600 mb-3" />
          <p className="text-sm font-medium text-slate-500">Loading department overview...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl p-6 text-center shadow-sm">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">Unable to Load Dashboard</h3>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          {departmentData?.name || 'Department'} Department
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Department overview, key performance metrics, and staff operations
        </p>
      </div>

      {/* 1. 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1 tracking-tight">
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center ${stat.bgColor} ${stat.textColor} border ${stat.borderColor}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Sleek Quick Actions (Positioned above staff list) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-900">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Action 1: Manage Staff */}
          <button
            onClick={() => navigate(ROUTES.DEPARTMENT_STAFF)}
            className="group flex items-center justify-between p-4 bg-white border border-slate-200/80 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left shadow-sm hover:shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                Manage Staff
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </button>

          {/* Action 2: View Complaints */}
          <button
            onClick={() => navigate(ROUTES.DEPARTMENT_COMPLAINTS)}
            className="group flex items-center justify-between p-4 bg-white border border-slate-200/80 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left shadow-sm hover:shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                <ClipboardList className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                View Complaints
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </button>

          {/* Action 3: Performance Reports */}
          <button
            onClick={() => navigate(ROUTES.DEPARTMENT_STAFF_PERFORMANCE)}
            className="group flex items-center justify-between p-4 bg-white border border-slate-200/80 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left shadow-sm hover:shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                <BarChart3 className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                Performance Reports
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </button>

          {/* Action 4: Export Report */}
          <button
            onClick={() => navigate(ROUTES.DEPARTMENT_STAFF_PERFORMANCE)}
            className="group flex items-center justify-between p-4 bg-white border border-slate-200/80 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all text-left shadow-sm hover:shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <Download className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                Export Report
              </span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>
      </div>

      {/* 3. Staff Members Section (Compact Grid preview, max 6 items) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Staff Members{' '}
              <span className="text-slate-400 font-normal text-sm ml-1">
                ({staffMembers.length})
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Active personnel assigned to {departmentData?.name || 'this department'}
            </p>
          </div>
          <button
            onClick={() => navigate(ROUTES.DEPARTMENT_STAFF)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50/80 px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>View All Staff</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {staffMembers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {staffMembers.slice(0, 6).map((staff, idx) => {
              const fullName = staff.profile?.fullName || 'Staff Member';
              const initials = getInitials(fullName);
              const colorClass = avatarColors[idx % avatarColors.length];

              return (
                <div
                  key={staff._id}
                  onClick={() => navigate(ROUTES.DEPARTMENT_STAFF)}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/70 bg-slate-50/40 hover:bg-white hover:border-blue-200 hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full font-semibold text-xs flex items-center justify-center border shrink-0 ${colorClass}`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                        {fullName}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        {staff.role === 'department_head'
                          ? 'Department Head'
                          : staff.role === 'supervisor'
                          ? 'Supervisor'
                          : 'Staff Member'}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60 shrink-0 ml-2">
                    Active
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-700">No staff members assigned yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Add personnel from the Manage Staff section to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DepartmentDashboardPage;
