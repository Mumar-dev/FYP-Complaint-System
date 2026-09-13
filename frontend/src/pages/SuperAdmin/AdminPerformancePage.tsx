import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, 
  Users, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Eye, 
  Download, 
  X, 
  Shield, 
  FileText,
  Activity,
  Layers,
  AlertTriangle,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
  ShieldCheck,
  EyeOff
} from 'lucide-react';
import { axiosInstance } from '../../services/customBaseQuery';
import { format } from 'date-fns';

interface AdminPerformanceItem {
  _id: string;
  email: string;
  fullName: string;
  accountStatus: string;
  joinedAt: string;
  totalActionsLogged: number;
  userApprovals: number;
  transferReviews: number;
  promotionReviews: number;
  disciplinaryActions: number;
  slaConfigurations: number;
  lastActiveAt: string;
  totalComplaintsSupervised: number;
  resolvedComplaints: number;
  pendingComplaints: number;
  activeWorkload: number;
  overdueComplaints: number;
  averageResolutionHours: number;
  slaComplianceRate: number;
}

interface SummaryData {
  totalAdmins: number;
  totalComplaints: number;
  resolvedComplaints: number;
  pendingComplaints: number;
  activeWorkload: number;
  overdueComplaints: number;
  avgResolutionHours: number;
  slaComplianceRate: number;
}

interface AdminActionLog {
  _id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
  createdAt: string;
}

interface SupervisedComplaint {
  _id: string;
  complaintId: string;
  title: string;
  department: string;
  status: string;
  priority: string;
  createdAt: string;
  resolvedAt: string | null;
  slaBreached: boolean;
}

const AdminPerformancePage: React.FC = () => {
  const [admins, setAdmins] = useState<AdminPerformanceItem[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalAdmins: 0,
    totalComplaints: 0,
    resolvedComplaints: 0,
    pendingComplaints: 0,
    activeWorkload: 0,
    overdueComplaints: 0,
    avgResolutionHours: 0,
    slaComplianceRate: 100,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Delete modal state
  const [adminToDelete, setAdminToDelete] = useState<AdminPerformanceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Drill-down Details modal state
  const [selectedAdminDetails, setSelectedAdminDetails] = useState<AdminPerformanceItem | null>(null);
  const [drillDownLoading, setDrillDownLoading] = useState(false);
  const [drillDownTab, setDrillDownTab] = useState<'actions' | 'complaints'>('actions');
  const [adminActions, setAdminActions] = useState<AdminActionLog[]>([]);
  const [supervisedComplaints, setSupervisedComplaints] = useState<SupervisedComplaint[]>([]);

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/dashboard/admin-performance');
      if (res.data?.success && res.data.data) {
        setAdmins(res.data.data.admins || []);
        if (res.data.data.summary) {
          setSummary(res.data.data.summary);
        }
      }
    } catch (err) {
      console.error('[AdminPerformancePage] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  const filteredAdmins = useMemo(() => {
    if (!searchTerm.trim()) return admins;
    const term = searchTerm.toLowerCase();
    return admins.filter(
      (a) =>
        a.fullName.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term)
    );
  }, [admins, searchTerm]);

  // Handle Create Admin
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminForm.fullName.trim() || !newAdminForm.email.trim() || !newAdminForm.password.trim()) {
      setCreateError('Full Name, Email, and Password are required.');
      return;
    }
    try {
      setIsCreating(true);
      setCreateError('');
      await axiosInstance.post('/dashboard/admin-performance', newAdminForm);
      setIsAddModalOpen(false);
      setNewAdminForm({ fullName: '', email: '', phone: '', password: '' });
      await fetchPerformance();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || err.message || 'Failed to create administrator.');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Delete Admin
  const handleDeleteAdmin = async () => {
    if (!adminToDelete) return;
    try {
      setIsDeleting(true);
      setDeleteError('');
      await axiosInstance.delete(`/dashboard/admin-performance/${adminToDelete._id}`);
      setAdminToDelete(null);
      await fetchPerformance();
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete administrator.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle Open Drilldown
  const handleOpenDrilldown = async (admin: AdminPerformanceItem) => {
    setSelectedAdminDetails(admin);
    setDrillDownTab('actions');
    setDrillDownLoading(true);
    try {
      const res = await axiosInstance.get(`/dashboard/admin-performance/${admin._id}/details`);
      if (res.data?.success && res.data.data) {
        setAdminActions(res.data.data.actions || []);
        setSupervisedComplaints(res.data.data.supervisedComplaints || []);
      }
    } catch (err) {
      console.error('[AdminPerformance] Failed to load drilldown:', err);
    } finally {
      setDrillDownLoading(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Admin Name',
      'Email Address',
      'Status',
      'Total Actions Logged',
      'Transfer Reviews',
      'Promotion Reviews',
      'Disciplinary Actions',
      'SLA Policies Configured',
      'Last Active'
    ];

    const rows = filteredAdmins.map((a) => [
      `"${a.fullName}"`,
      `"${a.email}"`,
      `"${a.accountStatus}"`,
      String(a.totalActionsLogged),
      String(a.transferReviews),
      String(a.promotionReviews),
      String(a.disciplinaryActions),
      String(a.slaConfigurations),
      `"${format(new Date(a.lastActiveAt), 'yyyy-MM-dd HH:mm:ss')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admin-performance-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Human-readable resolution time formatter
  const formattedResolutionTime = useMemo(() => {
    const hours = summary.avgResolutionHours;
    if (!hours || isNaN(hours) || hours <= 0) return '—';
    if (hours > 48) {
      const days = Math.round((hours / 24) * 10) / 10;
      return `${days} days`;
    }
    return `${hours}h`;
  }, [summary.avgResolutionHours]);

  const kpis = [
    {
      label: 'ACTIVE ADMINS',
      value: summary.totalAdmins,
      icon: Users,
    },
    {
      label: 'ACTIONS LOGGED',
      value: admins.reduce((sum, a) => sum + a.totalActionsLogged, 0),
      icon: Activity,
    },
    {
      label: 'SUPERVISED COMPLAINTS',
      value: summary.totalComplaints,
      icon: CheckCircle2,
    },
    {
      label: 'AVG RESOLUTION',
      value: formattedResolutionTime,
      icon: Clock,
    },
  ];

  // Helper for human-readable audit action name
  const formatActionName = (action: string) => {
    if (!action) return 'Action Logged';
    return action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .replace(/\bSla\b/g, 'SLA');
  };

  const getActionSummary = (log: AdminActionLog): string => {
    const d = log.details;
    if (!d || Object.keys(d).length === 0) return 'Administrative operation executed';
    if (d.reason) return String(d.reason);
    if (d.adminEmail) return `Account configured for ${d.adminEmail}`;
    if (d.title) return `"${d.title}"`;
    return 'Action recorded in audit log';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Page Header (Add Admin + Export CSV, No Refresh button) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Performance</h1>
          <p className="text-sm text-slate-500 mt-1">
            Executive oversight of administrator activity, review throughput, and operational governance
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={loading || admins.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setCreateError('');
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Admin</span>
          </button>
        </div>
      </div>

      {/* ── Top 4 KPI Cards (Clean flex layout with no label-icon overlap) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
                    {kpi.label}
                  </p>
                  <p className="text-3xl font-black text-slate-900 tracking-tight mt-2 tabular-nums truncate">
                    {loading ? '...' : typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Admin Performance Table Card ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Table summary bar with search */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Administrators</h2>
            <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full tabular-nums border border-slate-200/60">
              {filteredAdmins.length}
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search administrators..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        {/* Scrollable Container with Sticky Table Header */}
        <div className="max-h-[380px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse table-auto">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-semibold w-52">Administrator</th>
                <th className="py-3 px-4 font-semibold text-center w-28">Status</th>
                <th className="py-3 px-4 font-semibold text-center w-36">Total Actions</th>
                <th className="py-3 px-4 font-semibold text-center w-36">Transfers Reviewed</th>
                <th className="py-3 px-4 font-semibold text-center w-36">Promotions Reviewed</th>
                <th className="py-3 px-4 font-semibold text-center w-36">Warnings Issued</th>
                <th className="py-3 px-4 font-semibold text-center w-32">Last Active</th>
                <th className="py-3 px-4 font-semibold text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <p className="font-medium text-slate-500">Loading administrator performance...</p>
                  </td>
                </tr>
              ) : filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No administrators found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm ? 'Try adjusting your search criteria.' : 'No active administrators in the system.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => (
                  <tr key={admin._id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Admin Name & Email */}
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{admin.fullName}</span>
                        <span className="text-[11px] text-slate-400">{admin.email}</span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-4 text-center">
                      <span className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200/60 uppercase">
                        {admin.accountStatus}
                      </span>
                    </td>

                    {/* Total Actions Logged */}
                    <td className="py-3 px-4 text-center tabular-nums font-bold text-slate-900">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-semibold">
                        {admin.totalActionsLogged}
                      </span>
                    </td>

                    {/* Transfer Reviews */}
                    <td className="py-3 px-4 text-center tabular-nums text-slate-700 font-medium">
                      {admin.transferReviews}
                    </td>

                    {/* Promotion Reviews */}
                    <td className="py-3 px-4 text-center tabular-nums text-slate-700 font-medium">
                      {admin.promotionReviews}
                    </td>

                    {/* Warnings Issued */}
                    <td className="py-3 px-4 text-center tabular-nums text-slate-700 font-medium">
                      {admin.disciplinaryActions}
                    </td>

                    {/* Last Active Timestamp */}
                    <td className="py-3 px-4 text-center tabular-nums text-slate-600">
                      <div className="flex flex-col items-center">
                        <span className="font-medium whitespace-nowrap">
                          {format(new Date(admin.lastActiveAt), 'MMM dd, yyyy')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {format(new Date(admin.lastActiveAt), 'hh:mm a')}
                        </span>
                      </div>
                    </td>

                    {/* Action Buttons: View Details + Delete */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenDrilldown(admin)}
                          className="px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          title="Delete Administrator"
                          onClick={() => {
                            setDeleteError('');
                            setAdminToDelete(admin);
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal 1: Create Admin Modal ── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Administrator</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Create an executive admin account</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setShowPassword(false);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdmin}>
              <div className="p-6 space-y-4">
                {createError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1.5">
                    Full Name <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={newAdminForm.fullName}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, fullName: e.target.value })}
                      placeholder="e.g., Sarah Jenkins"
                      className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1.5">
                    Email Address <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={newAdminForm.email}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
                      placeholder="admin@company.com"
                      className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={newAdminForm.phone}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, phone: e.target.value })}
                      placeholder="+92 300 1234567"
                      className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1.5">
                    Password <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={newAdminForm.password}
                      onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                      placeholder="••••••••••••"
                      className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Structured Footer */}
              <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setShowPassword(false);
                  }}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-medium shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 2: Delete Admin Confirmation Modal ── */}
      {adminToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-5 h-5" />
            </div>

            <h3 className="text-base font-bold text-slate-900 text-center">Delete Administrator?</h3>
            <p className="text-xs text-slate-500 text-center mt-1.5">
              Are you sure you want to permanently delete the administrator account for{' '}
              <span className="font-semibold text-slate-800">{adminToDelete.fullName}</span> ({adminToDelete.email})?
              This action cannot be undone.
            </p>

            {deleteError && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
                {deleteError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setAdminToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAdmin}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 3: Admin Activity & Supervised Complaints Drill-down Modal ── */}
      {selectedAdminDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200/90 rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedAdminDetails.fullName}</h3>
                  <p className="text-xs text-slate-500">{selectedAdminDetails.email} · Executive Governance Drill-down</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAdminDetails(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="px-6 border-b border-slate-200 flex items-center gap-4 bg-white text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDrillDownTab('actions')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${
                  drillDownTab === 'actions'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Actions Taken ({adminActions.length})
              </button>
              <button
                type="button"
                onClick={() => setDrillDownTab('complaints')}
                className={`py-3 border-b-2 transition-colors cursor-pointer ${
                  drillDownTab === 'complaints'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Supervised Complaints ({supervisedComplaints.length})
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 max-h-[500px]">
              {drillDownLoading ? (
                <div className="py-16 text-center text-slate-400 font-medium text-xs">
                  Loading oversight records...
                </div>
              ) : drillDownTab === 'actions' ? (
                /* Tab 1: Actions Taken */
                adminActions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No actions logged yet</p>
                    <p className="text-slate-400 mt-1">This administrator has not performed any audit-logged tasks.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                    {adminActions.map((act) => (
                      <div key={act._id} className="p-3.5 hover:bg-slate-50/70 transition-colors flex items-start justify-between gap-4 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-900">{formatActionName(act.action)}</span>
                            {act.entityType && (
                              <span className="bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                                {act.entityType}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-600 text-xs truncate max-w-lg">
                            {getActionSummary(act)}
                          </p>
                        </div>
                        <span className="text-[11px] text-slate-400 tabular-nums shrink-0 whitespace-nowrap mt-0.5">
                          {format(new Date(act.createdAt), 'MMM dd, hh:mm a')}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                /* Tab 2: Supervised Complaints */
                supervisedComplaints.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No complaints supervised</p>
                  </div>
                ) : (
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Complaint</th>
                          <th className="py-2.5 px-3 font-semibold">Department</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                          <th className="py-2.5 px-3 font-semibold text-center">Priority</th>
                          <th className="py-2.5 px-3 font-semibold text-right">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {supervisedComplaints.map((c) => (
                          <tr key={c._id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900 truncate max-w-[200px]">{c.title}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{c.complaintId}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-medium">{c.department}</td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase">
                                {c.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase ${
                                  c.priority === 'critical'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                    : c.priority === 'high'
                                    ? 'bg-orange-50 text-orange-700 border border-orange-200/60'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                }`}
                              >
                                {c.priority}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right tabular-nums text-slate-500">
                              {format(new Date(c.createdAt), 'MMM dd, yyyy')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-end bg-slate-50/50">
              <button
                type="button"
                onClick={() => setSelectedAdminDetails(null)}
                className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs shadow-2xs transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPerformancePage;
