import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Building2, 
  Users, 
  Loader2, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  ShieldCheck, 
  MoreVertical,
  ExternalLink,
  Pencil,
  Archive,
  RotateCcw,
  Trash2,
  AlertTriangle,
  Tag,
  Briefcase
} from 'lucide-react';
import UserAvatar from '@/components/Common/UserAvatar';
import { 
  useGetDepartmentsQuery, 
  useCreateDepartmentMutation,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetStaffMembersQuery
} from '@/features/admin/admin.api';
import { showSuccess, showError } from '@/utils/toast';
import { ROUTES } from '@constants/index';

interface DepartmentItem {
  _id: string;
  name: string;
  code?: string;
  description?: string;
  slaTargetHours?: number;
  positions?: string[];
  keywords?: string[];
  isActive: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  staffCount?: number;
  headOfDepartment?: {
    _id: string;
    profile?: {
      fullName?: string;
      profileImage?: string;
      avatar?: string;
    };
  };
}

export const AdminDepartmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'rejected' | 'archived'>('active');

  // Modals & Menu State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentItem | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<DepartmentItem | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Form State for Create
  const [createForm, setCreateForm] = useState({
    name: '',
    code: '',
    slaTargetHours: 24,
    description: '',
    headId: '',
    positions: [] as string[],
    categories: [] as string[],
  });
  const [createErrors, setCreateErrors] = useState<{ name?: string; slaTargetHours?: string }>({});
  const [createPositionInput, setCreatePositionInput] = useState('');
  const [createCategoryInput, setCreateCategoryInput] = useState('');

  // Form State for Edit
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    slaTargetHours: 24,
    description: '',
    headId: '',
    positions: [] as string[],
    categories: [] as string[],
  });
  const [editErrors, setEditErrors] = useState<{ name?: string; slaTargetHours?: string }>({});
  const [editPositionInput, setEditPositionInput] = useState('');
  const [editCategoryInput, setEditCategoryInput] = useState('');

  // Refs for Focus & Modal Esc
  const createNameInputRef = useRef<HTMLInputElement>(null);
  const editNameInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // RTK Query Hooks
  const { data: departmentsData, isLoading, isError, refetch } = useGetDepartmentsQuery();
  const { data: staffData } = useGetStaffMembersQuery();
  const [createDepartment, { isLoading: isCreating }] = useCreateDepartmentMutation();
  const [updateDepartment, { isLoading: isUpdating }] = useUpdateDepartmentMutation();
  const [deleteDepartment, { isLoading: isDeleting }] = useDeleteDepartmentMutation();

  const departments: DepartmentItem[] = departmentsData?.data || [];
  const staffMembers = staffData?.data || [];

  // Tab Counts
  // Active: approved & isActive
  const activeCount = departments.filter((d) => (d.approvalStatus === 'approved' || !d.approvalStatus) && d.isActive).length;
  // Pending: awaiting superadmin approval
  const pendingCount = departments.filter((d) => d.approvalStatus === 'pending').length;
  // Rejected: rejected by superadmin
  const rejectedCount = departments.filter((d) => d.approvalStatus === 'rejected').length;
  // Archived: approved but deactivated/archived
  const archivedCount = departments.filter((d) => (d.approvalStatus === 'approved' || !d.approvalStatus) && !d.isActive).length;

  // Filtering Logic
  const filteredDepartments = departments.filter((dept) => {
    const matchesSearch =
      dept.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dept.headOfDepartment?.profile?.fullName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesTab = false;
    if (activeTab === 'active') {
      matchesTab = (dept.approvalStatus === 'approved' || !dept.approvalStatus) && dept.isActive;
    } else if (activeTab === 'pending') {
      matchesTab = dept.approvalStatus === 'pending';
    } else if (activeTab === 'rejected') {
      matchesTab = dept.approvalStatus === 'rejected';
    } else if (activeTab === 'archived') {
      matchesTab = (dept.approvalStatus === 'approved' || !dept.approvalStatus) && !dept.isActive;
    }

    return matchesSearch && matchesTab;
  });

  // Pagination (8 items per page)
  const ITEMS_PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredDepartments.length / ITEMS_PER_PAGE);
  const paginatedDepartments = filteredDepartments.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Close three-dot menu on outside click or scroll
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null);
      }
    };
    if (activeMenuId) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [activeMenuId]);

  // Focus on modal open
  useEffect(() => {
    if (showCreateModal) {
      setTimeout(() => createNameInputRef.current?.focus(), 100);
    }
  }, [showCreateModal]);

  useEffect(() => {
    if (editingDepartment) {
      setTimeout(() => editNameInputRef.current?.focus(), 100);
    }
  }, [editingDepartment]);

  // Navigation Helper
  const handleNavigateToDepartment = (id: string) => {
    navigate(ROUTES.ADMIN_DEPARTMENT_DETAIL.replace(':id', id));
  };

  // Tag Add Helpers
  const addCreatePosition = () => {
    const trimmed = createPositionInput.trim();
    if (trimmed && !createForm.positions.includes(trimmed)) {
      setCreateForm((prev) => ({ ...prev, positions: [...prev.positions, trimmed] }));
      setCreatePositionInput('');
    }
  };

  const removeCreatePosition = (tag: string) => {
    setCreateForm((prev) => ({ ...prev, positions: prev.positions.filter((p) => p !== tag) }));
  };

  const addCreateCategory = () => {
    const trimmed = createCategoryInput.trim();
    if (trimmed && !createForm.categories.includes(trimmed)) {
      setCreateForm((prev) => ({ ...prev, categories: [...prev.categories, trimmed] }));
      setCreateCategoryInput('');
    }
  };

  const removeCreateCategory = (tag: string) => {
    setCreateForm((prev) => ({ ...prev, categories: prev.categories.filter((c) => c !== tag) }));
  };

  const addEditPosition = () => {
    const trimmed = editPositionInput.trim();
    if (trimmed && !editForm.positions.includes(trimmed)) {
      setEditForm((prev) => ({ ...prev, positions: [...prev.positions, trimmed] }));
      setEditPositionInput('');
    }
  };

  const removeEditPosition = (tag: string) => {
    setEditForm((prev) => ({ ...prev, positions: prev.positions.filter((p) => p !== tag) }));
  };

  const addEditCategory = () => {
    const trimmed = editCategoryInput.trim();
    if (trimmed && !editForm.categories.includes(trimmed)) {
      setEditForm((prev) => ({ ...prev, categories: [...prev.categories, trimmed] }));
      setEditCategoryInput('');
    }
  };

  const removeEditCategory = (tag: string) => {
    setEditForm((prev) => ({ ...prev, categories: prev.categories.filter((c) => c !== tag) }));
  };

  // Create Modal Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof createErrors = {};
    if (!createForm.name.trim()) errs.name = 'Department name is required';
    const sla = Number(createForm.slaTargetHours);
    if (!Number.isFinite(sla) || sla <= 0) errs.slaTargetHours = 'SLA must be greater than 0';
    if (Object.keys(errs).length > 0) {
      setCreateErrors(errs);
      return;
    }

    try {
      await createDepartment({
        name: createForm.name.trim(),
        code: createForm.code.trim().toUpperCase() || undefined,
        slaTargetHours: sla,
        description: createForm.description.trim() || undefined,
        headId: createForm.headId || undefined,
        positions: createForm.positions,
        categories: createForm.categories,
      }).unwrap();
      showSuccess('Department request sent to Super Admin for approval.');
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        code: '',
        slaTargetHours: 24,
        description: '',
        headId: '',
        positions: [],
        categories: [],
      });
      setCreatePositionInput('');
      setCreateCategoryInput('');
      setCreateErrors({});
      refetch();
    } catch (err: any) {
      showError(err?.data?.message || 'Failed to create department');
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (dept: DepartmentItem) => {
    setActiveMenuId(null);
    setEditingDepartment(dept);
    setEditForm({
      name: dept.name,
      code: dept.code || '',
      slaTargetHours: dept.slaTargetHours || 24,
      description: dept.description || '',
      headId: dept.headOfDepartment?._id || '',
      positions: dept.positions ? [...dept.positions] : [],
      categories: dept.keywords ? [...dept.keywords] : [],
    });
    setEditPositionInput('');
    setEditCategoryInput('');
    setEditErrors({});
  };

  // Edit Modal Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDepartment) return;

    const errs: typeof editErrors = {};
    if (!editForm.name.trim()) errs.name = 'Department name is required';
    const sla = Number(editForm.slaTargetHours);
    if (!Number.isFinite(sla) || sla <= 0) errs.slaTargetHours = 'SLA must be greater than 0';
    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    try {
      await updateDepartment({
        id: editingDepartment._id,
        data: {
          name: editForm.name.trim(),
          code: editForm.code.trim().toUpperCase() || undefined,
          slaTargetHours: sla,
          description: editForm.description.trim() || undefined,
          headId: editForm.headId || null,
          positions: editForm.positions,
          categories: editForm.categories,
        },
      }).unwrap();
      showSuccess('Department updated successfully');
      setEditingDepartment(null);
      refetch();
    } catch (err: any) {
      showError(err?.data?.message || 'Failed to update department');
    }
  };

  // Toggle Archive / Restore
  const handleToggleArchive = async (dept: DepartmentItem) => {
    setActiveMenuId(null);
    const newStatus = !dept.isActive;
    try {
      await updateDepartment({
        id: dept._id,
        data: { isActive: newStatus },
      }).unwrap();
      showSuccess(newStatus ? `Department "${dept.name}" restored` : `Department "${dept.name}" archived`);
      refetch();
    } catch (err: any) {
      showError(err?.data?.message || 'Failed to change department status');
    }
  };

  // Confirm and Execute Delete
  const handleDeleteDepartment = async () => {
    if (!deletingDepartment) return;
    try {
      await deleteDepartment(deletingDepartment._id).unwrap();
      showSuccess(`Department "${deletingDepartment.name}" deleted successfully`);
      setDeletingDepartment(null);
      refetch();
    } catch (err: any) {
      showError(err?.data?.message || 'Failed to delete department');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="w-full px-5 py-6 space-y-6">
      {/* 1. Header & Primary Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Departments</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage service departments, department heads, and staff capacity.
          </p>
        </div>
        <div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Department</span>
          </button>
        </div>
      </div>

      {/* 2. Main Card Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm">
        {/* Toolbar Header: Segmented Pill Filter (Left) + Search Input (Right) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-slate-100 rounded-t-2xl bg-white">
          {/* Segmented Pill Tabs with Counts */}
          <div className="inline-flex items-center gap-1 bg-slate-100/80 border border-slate-200/60 p-1 rounded-xl">
            {[
              { id: 'active', label: 'Active', count: activeCount },
              { id: 'pending', label: 'Pending', count: pendingCount },
              { id: 'rejected', label: 'Rejected', count: rejectedCount },
              { id: 'archived', label: 'Archived', count: archivedCount },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                    active
                      ? tab.id === 'pending'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : tab.id === 'rejected'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search departments..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium"
            />
          </div>
        </div>

        {/* 3. Table */}
        <div className="overflow-x-auto lg:overflow-x-hidden min-h-[360px]">
          <table className="w-full text-left text-sm border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="w-[34%] px-4 py-3.5">Department</th>
                <th className="w-[22%] px-4 py-3.5">Department Head</th>
                <th className="w-[14%] px-4 py-3.5 text-center">Staff</th>
                <th className="w-[10%] px-4 py-3.5 text-center">SLA</th>
                <th className="w-[11%] px-4 py-3.5">Status</th>
                <th className="w-[9%] px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedDepartments.map((dept, index) => {
                const headName = dept.headOfDepartment?.profile?.fullName;
                const headInitial = headName ? headName.charAt(0).toUpperCase() : '';
                const memberCount = dept.staffCount || 0;
                const isMenuOpen = activeMenuId === dept._id;
                const isNearBottom = index >= paginatedDepartments.length - 2 && paginatedDepartments.length > 2;

                return (
                  <tr
                    key={dept._id}
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    {/* Department Name + Code + Description */}
                    <td className="px-4 py-3.5 min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div 
                          onClick={() => {
                            if (dept.approvalStatus === 'approved' && dept.isActive) {
                              handleNavigateToDepartment(dept._id);
                            }
                          }}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            dept.approvalStatus === 'approved' && dept.isActive
                              ? 'bg-blue-50 border border-blue-100/70 text-blue-600 group-hover:bg-blue-100/70 transition-colors cursor-pointer'
                              : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-default'
                          }`}
                        >
                          <Building2 className="w-4 h-4 stroke-[2]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            {dept.approvalStatus === 'approved' && dept.isActive ? (
                              <button
                                onClick={() => handleNavigateToDepartment(dept._id)}
                                className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors text-left truncate cursor-pointer block min-w-0"
                              >
                                {dept.name}
                              </button>
                            ) : (
                              <span className="text-sm font-semibold text-slate-700 truncate block min-w-0">
                                {dept.name}
                              </span>
                            )}
                            {dept.code && (
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10px] font-bold border border-slate-200 shrink-0">
                                {dept.code}
                              </span>
                            )}
                          </div>
                          {dept.description && (
                            <p className="text-xs text-slate-400 truncate mt-0.5 min-w-0 block" title={dept.description}>
                              {dept.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Department Head */}
                    <td className="px-4 py-3.5 min-w-0">
                      {headName ? (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <UserAvatar
                            name={headName}
                            src={dept.headOfDepartment?.profile?.profileImage || dept.headOfDepartment?.profile?.avatar}
                            size="xs"
                            className="w-7 h-7 text-[11px]"
                          />
                          <span className="text-sm font-medium text-slate-700 truncate min-w-0 block">{headName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Staff Members Count */}
                    <td className="px-4 py-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5 text-slate-600 text-sm tabular-nums whitespace-nowrap">
                        <Users className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
                      </div>
                    </td>

                    {/* SLA Target */}
                    <td className="px-4 py-3.5 text-center">
                      <span className="text-sm text-slate-600 font-medium tabular-nums inline-flex items-center gap-1 whitespace-nowrap">
                        <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{dept.slaTargetHours || 24}h</span>
                      </span>
                    </td>

                    {/* Status Pill */}
                    <td className="px-4 py-3.5">
                      {dept.approvalStatus === 'pending' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 whitespace-nowrap">
                          Pending Approval
                        </span>
                      ) : dept.approvalStatus === 'rejected' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 whitespace-nowrap">
                          Rejected
                        </span>
                      ) : dept.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/60 whitespace-nowrap">
                          Archived
                        </span>
                      )}
                    </td>

                    {/* Actions: Three-Dot Menu */}
                    <td className="px-4 py-3.5 text-right relative">
                      <div className="inline-block text-left">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuId(isMenuOpen ? null : dept._id);
                          }}
                          className={`p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer ${
                            isMenuOpen ? 'bg-slate-100 text-slate-700' : ''
                          }`}
                          aria-label="Department actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div
                            ref={menuRef}
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute right-4 w-48 bg-white rounded-xl shadow-xl border border-slate-200/80 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${
                              isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'
                            }`}
                          >
                            {/* Operational actions: ONLY show for Approved & Active departments */}
                            {dept.approvalStatus === 'approved' && dept.isActive && (
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  handleNavigateToDepartment(dept._id);
                                }}
                                className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                <span>Manage Department</span>
                              </button>
                            )}

                            {/* Edit Action: Allowed for All statuses (Active, Pending, Rejected, Archived) */}
                            <button
                              onClick={() => handleOpenEdit(dept)}
                              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-400" />
                              <span>{dept.approvalStatus === 'rejected' ? 'Edit & Resubmit' : 'Edit Details'}</span>
                            </button>

                            {/* Archive/Restore Action: Only for Approved departments */}
                            {dept.approvalStatus === 'approved' && (
                              <button
                                onClick={() => handleToggleArchive(dept)}
                                className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                              >
                                {dept.isActive ? (
                                  <>
                                    <Archive className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Archive Department</span>
                                  </>
                                ) : (
                                  <>
                                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Restore Department</span>
                                  </>
                                )}
                              </button>
                            )}

                            <div className="my-1 border-t border-slate-100" />

                            {/* Delete Action: Allowed for All statuses */}
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                setDeletingDepartment(dept);
                              }}
                              className="w-full px-3.5 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Delete Department</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {paginatedDepartments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400 font-medium text-xs">
                    {isError
                      ? 'Failed to load departments from server.'
                      : searchTerm
                      ? `No departments found matching "${searchTerm}".`
                      : 'No departments found in this view.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="px-6 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium bg-slate-50/40 rounded-b-2xl">
            <span>
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
              {Math.min(currentPage * ITEMS_PER_PAGE, filteredDepartments.length)} of{' '}
              {filteredDepartments.length} departments
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-all shadow-2xs cursor-pointer text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 text-xs font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-30 disabled:pointer-events-none transition-all shadow-2xs cursor-pointer text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. Create Department Modal (Compact & Fast) */}
      {showCreateModal && (
        <div
          onClick={() => !isCreating && setShowCreateModal(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200/80 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl relative animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Fixed Header */}
            <div className="flex justify-between items-center px-6 sm:px-7 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Create Department</h2>
                <p className="text-xs text-slate-500 mt-0.5">Add a new operational department to your society.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 sm:p-7 space-y-4 overflow-y-auto flex-1">
                {/* Row 1: Name (wider), Code (compact), and SLA Target Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Department Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      ref={createNameInputRef}
                      type="text"
                      placeholder="e.g. Maintenance, Security"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      className={`w-full px-3.5 py-2 border rounded-xl text-sm outline-none transition-all font-medium ${
                        createErrors.name
                          ? 'border-rose-300 ring-2 ring-rose-50 bg-rose-50/20'
                          : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                      }`}
                    />
                    {createErrors.name && <p className="text-rose-500 text-xs mt-1 font-medium">{createErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. MNT"
                      maxLength={6}
                      value={createForm.code}
                      onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      SLA Target (Hours) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={createForm.slaTargetHours}
                      onChange={(e) => setCreateForm({ ...createForm, slaTargetHours: Number(e.target.value) })}
                      className={`w-full px-3.5 py-2 border rounded-xl text-sm outline-none transition-all font-medium ${
                        createErrors.slaTargetHours
                          ? 'border-rose-300 ring-2 ring-rose-50 bg-rose-50/20'
                          : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                      }`}
                    />
                    {createErrors.slaTargetHours && (
                      <p className="text-rose-500 text-xs mt-1 font-medium">{createErrors.slaTargetHours}</p>
                    )}
                  </div>
                </div>

                {/* Positions Tag Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Job Positions
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Electrician, Plumber (press Enter)"
                      value={createPositionInput}
                      onChange={(e) => setCreatePositionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCreatePosition();
                        }
                      }}
                      className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium"
                    />
                    <button
                      type="button"
                      onClick={addCreatePosition}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  {createForm.positions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {createForm.positions.map((pos) => (
                        <span
                          key={pos}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 text-xs font-medium"
                        >
                          {pos}
                          <button
                            type="button"
                            onClick={() => removeCreatePosition(pos)}
                            className="hover:text-blue-900 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Complaint Categories Tag Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Complaint Categories
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Water Leakage, Wiring (press Enter)"
                      value={createCategoryInput}
                      onChange={(e) => setCreateCategoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCreateCategory();
                        }
                      }}
                      className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium"
                    />
                    <button
                      type="button"
                      onClick={addCreateCategory}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  {createForm.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {createForm.categories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-xs font-medium"
                        >
                          {cat}
                          <button
                            type="button"
                            onClick={() => removeCreateCategory(cat)}
                            className="hover:text-indigo-900 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief summary of department responsibilities..."
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium resize-none"
                  />
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 sm:px-7 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isCreating}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isCreating ? 'Creating...' : 'Create Department'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Edit Department Modal (Compact & Fast) */}
      {editingDepartment && (
        <div
          onClick={() => !isUpdating && setEditingDepartment(null)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200/80 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl relative animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Fixed Header */}
            <div className="flex justify-between items-center px-6 sm:px-7 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Edit Department</h2>
                <p className="text-xs text-slate-500 mt-0.5">Update configuration for {editingDepartment.name}</p>
              </div>
              <button
                onClick={() => setEditingDepartment(null)}
                disabled={isUpdating}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleEditSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="p-6 sm:p-7 space-y-4 overflow-y-auto flex-1">
                {/* When Approved: 2-column with SLA and Head. When Pending/Rejected: SLA is merged neatly with Name & Code */}
                {editingDepartment?.approvalStatus === 'approved' ? (
                  <>
                    {/* Row 1: Name + Code */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Department Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          ref={editNameInputRef}
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className={`w-full px-3.5 py-2 border rounded-xl text-sm outline-none transition-all font-medium ${
                            editErrors.name
                              ? 'border-rose-300 ring-2 ring-rose-50 bg-rose-50/20'
                              : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                          }`}
                        />
                        {editErrors.name && <p className="text-rose-500 text-xs mt-1 font-medium">{editErrors.name}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Code
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. MNT"
                          maxLength={6}
                          value={editForm.code}
                          onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono uppercase"
                        />
                      </div>
                    </div>

                    {/* Row 2: SLA Target Hours + Department Head */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          SLA Target (Hours) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="720"
                          value={editForm.slaTargetHours}
                          onChange={(e) => setEditForm({ ...editForm, slaTargetHours: Number(e.target.value) })}
                          className={`w-full px-3.5 py-2 border rounded-xl text-sm outline-none transition-all font-medium ${
                            editErrors.slaTargetHours
                              ? 'border-rose-300 ring-2 ring-rose-50 bg-rose-50/20'
                              : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                          }`}
                        />
                        {editErrors.slaTargetHours && (
                          <p className="text-rose-500 text-xs mt-1 font-medium">{editErrors.slaTargetHours}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Department Head
                        </label>
                        <select
                          value={editForm.headId}
                          onChange={(e) => setEditForm({ ...editForm, headId: e.target.value })}
                          className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-white font-medium"
                        >
                          <option value="">Unassigned</option>
                          {staffMembers.map((staff: any) => (
                            <option key={staff._id} value={staff._id}>
                              {staff.profile?.fullName || staff.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Row 1 for Pending/Rejected: Name (2 col) + Code (1 col) + SLA Target (1 col) cleanly spanning 4 cols */
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Department Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        ref={editNameInputRef}
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className={`w-full px-3.5 py-2 border rounded-xl text-sm outline-none transition-all font-medium ${
                          editErrors.name
                            ? 'border-rose-300 ring-2 ring-rose-50 bg-rose-50/20'
                            : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                        }`}
                      />
                      {editErrors.name && <p className="text-rose-500 text-xs mt-1 font-medium">{editErrors.name}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MNT"
                        maxLength={6}
                        value={editForm.code}
                        onChange={(e) => setEditForm({ ...editForm, code: e.target.value.toUpperCase() })}
                        className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        SLA Target (Hours) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="720"
                        value={editForm.slaTargetHours}
                        onChange={(e) => setEditForm({ ...editForm, slaTargetHours: Number(e.target.value) })}
                        className={`w-full px-3.5 py-2 border rounded-xl text-sm outline-none transition-all font-medium ${
                          editErrors.slaTargetHours
                            ? 'border-rose-300 ring-2 ring-rose-50 bg-rose-50/20'
                            : 'border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                        }`}
                      />
                      {editErrors.slaTargetHours && (
                        <p className="text-rose-500 text-xs mt-1 font-medium">{editErrors.slaTargetHours}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Positions Tag Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Job Positions
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Electrician, Plumber (press Enter)"
                      value={editPositionInput}
                      onChange={(e) => setEditPositionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addEditPosition();
                        }
                      }}
                      className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium"
                    />
                    <button
                      type="button"
                      onClick={addEditPosition}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  {editForm.positions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {editForm.positions.map((pos) => (
                        <span
                          key={pos}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 text-xs font-medium"
                        >
                          {pos}
                          <button
                            type="button"
                            onClick={() => removeEditPosition(pos)}
                            className="hover:text-blue-900 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Complaint Categories Tag Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Complaint Categories
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Water Leakage, Wiring (press Enter)"
                      value={editCategoryInput}
                      onChange={(e) => setEditCategoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addEditCategory();
                        }
                      }}
                      className="flex-1 px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-medium"
                    />
                    <button
                      type="button"
                      onClick={addEditCategory}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                  {editForm.categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {editForm.categories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200/60 text-xs font-medium"
                        >
                          {cat}
                          <button
                            type="button"
                            onClick={() => removeEditCategory(cat)}
                            className="hover:text-indigo-900 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-medium resize-none"
                  />
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 sm:px-7 py-3.5 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => setEditingDepartment(null)}
                  disabled={isUpdating}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isUpdating ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Delete Confirmation Modal */}
      {deletingDepartment && (
        <div
          onClick={() => !isDeleting && setDeletingDepartment(null)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border border-slate-200/80 rounded-2xl w-full max-w-sm p-6 shadow-xl relative animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6 stroke-[2]" />
            </div>

            <h2 className="text-lg font-bold text-slate-900">Delete Department?</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Are you sure you want to permanently delete <strong className="text-slate-800">{deletingDepartment.name}</strong>?
              This action cannot be undone. Departments with active staff or open complaints cannot be deleted.
            </p>

            <div className="pt-5 mt-5 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingDepartment(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDepartment}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? 'Deleting...' : 'Delete Department'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDepartmentsPage;
