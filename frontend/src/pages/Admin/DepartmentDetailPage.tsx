import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Users, AlertCircle, Loader2, MoreVertical, Crown,
    UserPlus, Edit3, X, ChevronUp, CheckCircle2, Clock,
    AlertTriangle, UserMinus, TrendingUp, TrendingDown, Minus, Search,
    ArrowRightLeft, ShieldAlert, Check
} from 'lucide-react';
import { Button, Card, InputField, StatusBadge, UserAvatar } from '@components/Common';
import {
    useGetDepartmentByIdQuery,
    useGetDepartmentStaffQuery,
    useAssignHeadMutation,
    useUpdateDepartmentMutation,
    usePromoteStaffMutation,
    useDemoteStaffMutation,
    useRemoveStaffFromDepartmentMutation,
    useGetStaffMembersQuery,
    useAssignStaffToDepartmentMutation,
    useUpdateStaffRoleOrPositionMutation,
    useGetDepartmentsQuery,
} from '@/features/admin/admin.api';
import { showSuccess, showError } from '@/utils/toast';

// ─── Types ────────────────────────────────────────────────────────────────────
type ModalType = 'assignHead' | 'assignStaff' | 'editDept' | 'staffProfile' | 'remove' | 'editRankPosition' | 'transferStaff' | 'confirmPromote' | 'confirmDemoteRank' | 'confirmDemoteHead' | null;
type StaffTab = 'unassigned' | 'other';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getRankColor = (rank: string) => {
    if (rank === 'head') return 'bg-purple-100 text-purple-800 border border-purple-300 font-semibold';
    if (rank === 'supervisor') return 'bg-purple-50 text-purple-700 border border-purple-200';
    if (rank === 'team_lead' || rank === 'lead') return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    if (rank === 'senior') return 'bg-amber-50 text-amber-700 border border-amber-200';
    return 'bg-blue-50 text-blue-700 border border-blue-200';
};

const getStatusInfo = (stats: any) => {
    if ((stats?.assignedCount ?? 0) >= 5) return { label: 'Overloaded', cls: 'bg-red-50 text-red-700 border border-red-200' };
    if ((stats?.assignedCount ?? 0) > 0) return { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
    return { label: 'Idle', cls: 'bg-gray-50 text-gray-500 border border-gray-200' };
};

const getRankDisplay = (rank?: string) => {
    if (rank === 'head') return 'Head';
    if (rank === 'supervisor') return 'Supervisor';
    if (rank === 'team_lead' || rank === 'lead') return 'Team Lead';
    if (rank === 'senior') return 'Senior';
    return 'Junior';
};

const getNextRank = (rank: string) => {
    if (rank === 'junior' || rank === 'standard') return 'Senior';
    if (rank === 'senior') return 'Team Lead';
    if (rank === 'team_lead' || rank === 'lead') return 'Supervisor';
    return null;
};

const getPreviousRank = (rank: string) => {
    if (rank === 'supervisor') return 'Team Lead';
    if (rank === 'team_lead' || rank === 'lead') return 'Senior';
    if (rank === 'senior') return 'Junior';
    return null;
};

const getSLAColor = (rate: number) => {
    if (rate >= 90) return { text: 'text-emerald-600', bg: 'bg-emerald-500', label: 'Excellent' };
    if (rate >= 70) return { text: 'text-amber-600', bg: 'bg-amber-500', label: 'Fair' };
    return { text: 'text-red-600', bg: 'bg-red-500', label: 'Poor' };
};

// ─── Staff ⋮ Menu ─────────────────────────────────────────────────────────────
const ActionsMenu: React.FC<{
    staff: any;
    isHead: boolean;
    onViewProfile: () => void;
    onEditRankPosition: () => void;
    onPromote?: () => void;
    onDemoteRank?: () => void;
    onDemoteHead?: () => void;
    onSetAsHead: () => void;
    onTransferDept: () => void;
    onRemove: () => void;
}> = ({ staff, isHead, onViewProfile, onEditRankPosition, onPromote, onDemoteRank, onDemoteHead, onSetAsHead, onTransferDept, onRemove }) => {
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const nextRank = getNextRank(staff?.rank || 'junior');
    const prevRank = getPreviousRank(staff?.rank || 'junior');

    const updateMenuPosition = (targetEl?: HTMLElement) => {
        const btn = targetEl || buttonRef.current;
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const menuWidth = 192; // 12rem / w-48
        const menuHeight = 240;
        const padding = 8;

        let left = rect.right - menuWidth;
        if (left < padding) left = padding;

        const spaceBelow = window.innerHeight - rect.bottom;
        let top = rect.bottom + 6;

        // If not enough space below, flip upward
        if (spaceBelow < menuHeight && rect.top > menuHeight) {
            top = rect.top - menuHeight - 6;
        }

        setMenuStyle({
            position: 'fixed',
            top: `${Math.round(top)}px`,
            left: `${Math.round(left)}px`,
            width: `${menuWidth}px`,
            zIndex: 9999,
        });
    };

    const toggleOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!open) {
            updateMenuPosition(e.currentTarget);
            setOpen(true);
        } else {
            setOpen(false);
        }
    };

    useEffect(() => {
        if (!open) return;

        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                menuRef.current && !menuRef.current.contains(target) &&
                buttonRef.current && !buttonRef.current.contains(target)
            ) {
                setOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false);
            }
        };

        const handleScrollOrResize = () => {
            setOpen(false);
        };

        document.addEventListener('click', handleOutsideClick, true);
        document.addEventListener('mousedown', handleOutsideClick, true);
        document.addEventListener('keydown', handleKeyDown);
        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);

        return () => {
            document.removeEventListener('click', handleOutsideClick, true);
            document.removeEventListener('mousedown', handleOutsideClick, true);
            document.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [open]);

    return (
        <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
            <button
                ref={buttonRef}
                type="button"
                onClick={toggleOpen}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 transition-colors cursor-pointer"
                aria-label="Staff member actions"
            >
                <MoreVertical className="w-4 h-4" />
            </button>

            {open && createPortal(
                <div
                    ref={menuRef}
                    style={menuStyle}
                    onClick={(e) => e.stopPropagation()}
                    className="w-48 bg-white rounded-xl border border-slate-200/90 shadow-lg shadow-slate-900/5 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                    {/* View Profile */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                            onViewProfile();
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                        <Users className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>View Profile</span>
                    </button>

                    {/* Edit Position / Rank */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                            onEditRankPosition();
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                        <Edit3 className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Edit Position / Rank</span>
                    </button>

                    {/* Promote to [Next Rank] (if eligible) */}
                    {nextRank && onPromote && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                                onPromote();
                            }}
                            className="w-full px-3 py-2 text-left text-[13px] font-medium text-blue-600 hover:bg-blue-50/70 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                            <ChevronUp className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>Promote to {nextRank}</span>
                        </button>
                    )}

                    {/* Demote to [Previous Rank] (if eligible) */}
                    {prevRank && onDemoteRank && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                                onDemoteRank();
                            }}
                            className="w-full px-3 py-2 text-left text-[13px] font-medium text-amber-600 hover:bg-amber-50/70 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                            <TrendingDown className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Demote to {prevRank}</span>
                        </button>
                    )}

                    {/* Demote from Head (if head) */}
                    {isHead && onDemoteHead && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                                onDemoteHead();
                            }}
                            className="w-full px-3 py-2 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50/70 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>Demote from Head</span>
                        </button>
                    )}

                    {/* Set as Department Head (if not head) */}
                    {!isHead && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpen(false);
                                onSetAsHead();
                            }}
                            className="w-full px-3 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                            <Crown className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>Set as Department Head</span>
                        </button>
                    )}

                    {/* Transfer Department */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                            onTransferDept();
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                        <ArrowRightLeft className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Transfer Department</span>
                    </button>

                    {/* Divider & Remove from Department */}
                    <div className="my-1 border-t border-slate-100" />
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setOpen(false);
                            onRemove();
                        }}
                        className="w-full px-3 py-2 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                        <UserMinus className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>Remove from Department</span>
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
};

// ─── Staff Profile Modal (Clean & Modern) ─────────────────────────────────────
const StaffProfileModal: React.FC<{
    staff: any;
    isHead: boolean;
    onClose: () => void;
}> = ({ staff, isHead, onClose }) => {
    const stats = staff?.stats || {};
    const slaColor = getSLAColor(stats.complianceRate ?? 0);
    const statusInfo = getStatusInfo(stats);
    const slaOnTime = Math.max(0, (stats.resolvedCount ?? 0) - (stats.slaBreaches ?? 0));
    const displayName = staff.profile?.fullName || staff.name || 'Unknown Staff';
    const initial = displayName.charAt(0).toUpperCase();

    const statRows = [
        { label: 'Active Tasks', value: stats.assignedCount ?? 0, accent: 'text-slate-900' },
        { label: 'Total Resolved', value: stats.resolvedCount ?? 0, accent: 'text-emerald-600' },
        { label: 'SLA On Time', value: slaOnTime, accent: 'text-emerald-600' },
        { label: 'SLA Breaches', value: stats.slaBreaches ?? 0, accent: stats.slaBreaches > 0 ? 'text-rose-600' : 'text-slate-900' },
        { label: 'Compliance Rate', value: `${stats.complianceRate ?? 0}%`, accent: slaColor.text },
        { label: 'Avg Resolution', value: `${stats.avgResolutionHours ?? 0}h`, accent: 'text-slate-900' },
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden my-6 flex flex-col animate-in zoom-in-95 duration-150">
                {/* 1. Clean Light Header (No Loud Purple Gradient) */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <UserAvatar
                            name={displayName}
                            src={staff.profile?.profileImage || staff.profile?.avatar}
                            size="lg"
                            className="w-12 h-12 text-base"
                        />
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-semibold text-slate-900 truncate">{displayName}</h2>
                                {isHead && <Crown className="w-4 h-4 text-amber-500 shrink-0" />}
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5">{staff.email}</p>
                            <div className="flex items-center gap-1.5 mt-2">
                                <span className="capitalize bg-slate-100 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded-md">
                                    {getRankDisplay(staff.rank || 'junior')}
                                </span>
                                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${
                                    statusInfo.label === 'Active'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : statusInfo.label === 'Overloaded'
                                        ? 'bg-rose-50 text-rose-700'
                                        : 'bg-slate-100 text-slate-600'
                                }`}>
                                    {statusInfo.label}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 2. Compact Performance Metrics */}
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Performance Metrics</p>
                        <div className="grid grid-cols-3 gap-3">
                            {statRows.map(row => (
                                <div key={row.label} className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5">
                                    <p className="text-[11px] font-medium text-slate-500 truncate">{row.label}</p>
                                    <p className={`mt-1 text-lg font-semibold tabular-nums ${row.accent}`}>{row.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SLA Progress Bar */}
                    <div className="pt-1">
                        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                            <span className="font-medium">SLA Compliance</span>
                            <span className={`font-semibold ${slaColor.text}`}>{stats.complianceRate ?? 0}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-2 rounded-full transition-all duration-500 ${slaColor.bg}`}
                                style={{ width: `${Math.min(stats.complianceRate ?? 0, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Clean Single Close Footer */}
                <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Confirm Modal (Crisp & Modern) ───────────────────────────────────────────
const ConfirmModal: React.FC<{
    title: string;
    body: React.ReactNode;
    confirmLabel?: string;
    isLoading: boolean;
    onConfirm: () => void;
    onClose: () => void;
}> = ({ title, body, confirmLabel = 'Remove', isLoading, onConfirm, onClose }) => (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Body (p-6) */}
            <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                    <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="mt-2 text-sm text-slate-500 leading-relaxed">
                    {body}
                </div>
            </div>

            {/* Clean Right-Aligned Footer */}
            <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={isLoading}
                    className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2 focus:outline-none"
                >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const DepartmentDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const { data: deptData, isLoading: deptLoading, isError: deptError, refetch: refetchDept } = useGetDepartmentByIdQuery(id!);
    const { data: allDeptsData } = useGetDepartmentsQuery();
    const { data: staffData, isLoading: staffLoading, refetch: refetchStaff } = useGetDepartmentStaffQuery(id!);
    const { data: unassignedData } = useGetStaffMembersQuery({ unassigned: true });
    const { data: otherStaffData } = useGetStaffMembersQuery({});

    const department = deptData?.data;
    const allDepartments: any[] = allDeptsData?.data || [];
    const staffList: any[] = staffData?.data || [];
    const unassignedStaff: any[] = unassignedData?.data || [];
    const otherStaff: any[] = (otherStaffData?.data || []).filter(
        (s: any) => s.departmentId && (s.departmentId?._id || s.departmentId) !== id
    );

    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [selectedStaff, setSelectedStaff] = useState<any>(null);
    const [staffTab, setStaffTab] = useState<StaffTab>('unassigned');
    const [assignSearch, setAssignSearch] = useState('');
    const [staffSearchTerm, setStaffSearchTerm] = useState('');
    const [selectedAssignee, setSelectedAssignee] = useState('');
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
    const [showAssignConfirmView, setShowAssignConfirmView] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', slaTargetHours: 24, description: '', headId: '' });

    // State for Edit Position/Rank modal
    const [editStaffPosition, setEditStaffPosition] = useState('');
    const [editStaffRank, setEditStaffRank] = useState('junior');

    // State for Transfer Staff modal
    const [targetTransferDeptId, setTargetTransferDeptId] = useState('');

    const [assignHead, { isLoading: assigningHead }] = useAssignHeadMutation();
    const [updateDept, { isLoading: updatingDept }] = useUpdateDepartmentMutation();
    const [removeStaff, { isLoading: removing }] = useRemoveStaffFromDepartmentMutation();
    const [assignStaff, { isLoading: assigningStaff }] = useAssignStaffToDepartmentMutation();
    const [updateStaffRoleOrPosition, { isLoading: updatingStaffRole }] = useUpdateStaffRoleOrPositionMutation();
    const [promoteStaff, { isLoading: promotingStaff }] = usePromoteStaffMutation();
    const [demoteStaff, { isLoading: demotingStaff }] = useDemoteStaffMutation();

    const openEditModal = () => {
        setEditForm({
            name: department?.name || '',
            slaTargetHours: department?.slaTargetHours || 24,
            description: department?.description || '',
            headId: department?.headOfDepartment?._id || '',
        });
        setActiveModal('editDept');
    };

    const closeModal = () => { 
        setActiveModal(null); 
        setSelectedStaff(null); 
        setSelectedAssignee(''); 
        setSelectedStaffIds([]);
        setShowAssignConfirmView(false);
        setAssignSearch('');
        setTargetTransferDeptId('');
    };

    const handleQuickSetHead = async (staff: any) => {
        try {
            await assignHead({ deptId: id!, staffId: staff._id }).unwrap();
            showSuccess(`${staff.profile?.fullName || staff.email} assigned as Department Head.`);
            refetchStaff();
            refetchDept();
        } catch (err: any) {
            showError(err?.data?.message || 'Failed to assign department head.');
        }
    };

    const handleSaveRankPosition = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStaff) return;
        try {
            await updateStaffRoleOrPosition({
                userId: selectedStaff._id,
                deptId: id!,
                data: {
                    rank: editStaffRank,
                    'profile.position': editStaffPosition.trim() || undefined
                }
            }).unwrap();
            showSuccess('Staff position and rank updated successfully.');
            closeModal();
            refetchStaff();
        } catch (err: any) {
            showError(err?.data?.message || 'Failed to update position / rank.');
        }
    };

    const handleExecuteTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStaff || !targetTransferDeptId) return;
        try {
            await assignStaff({
                userId: selectedStaff._id,
                departmentId: targetTransferDeptId,
                currentDeptId: id!
            }).unwrap();
            showSuccess(`${selectedStaff.profile?.fullName || selectedStaff.email} transferred successfully.`);
            closeModal();
            refetchStaff();
        } catch (err: any) {
            showError(err?.data?.message || 'Failed to transfer staff member.');
        }
    };

    const handleAssignHead = async () => {
        if (!selectedAssignee) return;
        try {
            await assignHead({ deptId: id!, staffId: selectedAssignee }).unwrap();
            showSuccess('Department head assigned successfully.');
            closeModal();
            refetchStaff();
            refetchDept();
        } catch (err: any) { showError(err?.data?.message || 'Failed to assign head.'); }
    };

    const handleAssignStaff = async () => {
        if (selectedStaffIds.length === 0) return;
        try {
            await assignStaff({ 
                userIds: selectedStaffIds, 
                departmentId: id!, 
                currentDeptId: id!,
                reason: staffTab === 'other' ? `Transferred to ${department?.name}` : undefined
            }).unwrap();
            showSuccess(
                staffTab === 'other'
                    ? `Successfully transferred ${selectedStaffIds.length} staff member(s).`
                    : `Added ${selectedStaffIds.length} staff member(s) to ${department?.name || 'department'}.`
            );
            closeModal();
            refetchStaff();
        } catch (err: any) { 
            showError(err?.data?.message || 'Failed to assign staff.'); 
        }
    };

    const handleEditDept = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateDept({ id: id!, data: editForm }).unwrap();
            showSuccess('Department updated successfully.');
            closeModal();
            refetchStaff();
            refetchDept();
        } catch (err: any) { showError(err?.data?.message || 'Failed to update department.'); }
    };

    const handleRemove = async () => {
        try {
            await removeStaff({ userId: selectedStaff._id, deptId: id! }).unwrap();
            showSuccess(`${selectedStaff.profile?.fullName || selectedStaff.email} unassigned from department.`);
            closeModal();
            refetchStaff();
            refetchDept();
        } catch (err: any) { showError(err?.data?.message || 'Failed to remove staff.'); }
    };

    const handleConfirmPromote = async () => {
        if (!selectedStaff) return;
        const nextRank = getNextRank(selectedStaff.rank || 'junior');
        try {
            await promoteStaff({ userId: selectedStaff._id, deptId: id! }).unwrap();
            showSuccess(`${selectedStaff.profile?.fullName || selectedStaff.email} promoted to ${nextRank}!`);
            closeModal();
            refetchStaff();
        } catch (err: any) {
            showError(err?.data?.message || 'Promotion failed.');
        }
    };

    const handleConfirmDemoteRank = async () => {
        if (!selectedStaff) return;
        const prevRank = getPreviousRank(selectedStaff.rank || 'junior');
        try {
            await demoteStaff({ userId: selectedStaff._id, deptId: id! }).unwrap();
            showSuccess(`${selectedStaff.profile?.fullName || selectedStaff.email} demoted to ${prevRank}!`);
            closeModal();
            refetchStaff();
        } catch (err: any) {
            showError(err?.data?.message || 'Failed to demote staff.');
        }
    };

    const handleConfirmDemoteHead = async () => {
        try {
            await assignHead({ deptId: id!, staffId: 'demote' }).unwrap();
            showSuccess('Department Head successfully demoted to regular staff.');
            closeModal();
            refetchStaff();
            refetchDept();
        } catch (err: any) {
            showError(err?.data?.message || 'Failed to demote Department Head.');
        }
    };

    const sla = department?.slaMetrics || {};
    const headId = department?.headOfDepartment?._id?.toString();

    const modalStaffPool = (staffTab === 'unassigned' ? unassignedStaff : otherStaff).filter(
        (s: any) => s.employmentStatus !== 'TERMINATED' && s.employmentStatus !== 'SUSPENDED' && s.accountStatus !== 'suspended'
    );
    const filteredModalStaff = modalStaffPool.filter((s: any) =>
        (s.name || s.email || '').toLowerCase().includes(assignSearch.toLowerCase())
    );

    if (deptLoading) return (
        <div className="flex h-96 items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
        </div>
    );

    if (deptError || !department) return (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
            <AlertCircle className="w-16 h-16 text-red-400" />
            <h2 className="text-2xl font-bold text-gray-900">Department Not Found</h2>
            <Button variant="primary" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
    );

    // ─── Stat cards data ──────────────────────────────────────────────────────
    const statCards = [
        {
            label: 'Total Staff',
            value: department.staffCount ?? 0,
            icon: <Users className="w-5 h-5" />,
            iconBg: 'bg-blue-50 text-blue-600',
            valueCls: 'text-gray-900',
        },
        {
            label: 'Total Resolved',
            value: sla.totalResolved ?? 0,
            icon: <CheckCircle2 className="w-5 h-5" />,
            iconBg: 'bg-emerald-50 text-emerald-600',
            valueCls: 'text-emerald-600',
        },
        {
            label: 'SLA Breached',
            value: sla.totalBreached ?? 0,
            icon: <AlertTriangle className="w-5 h-5" />,
            iconBg: 'bg-red-50 text-red-500',
            valueCls: 'text-red-500',
        },
        {
            label: 'SLA Target',
            value: `${department.slaTargetHours}h`,
            icon: <Clock className="w-5 h-5" />,
            iconBg: 'bg-purple-50 text-purple-600',
            valueCls: 'text-gray-900',
        },
        {
            label: 'Avg Resolution',
            value: `${sla.avgResolutionHours ?? 0}h`,
            icon: <TrendingUp className="w-5 h-5" />,
            iconBg: 'bg-indigo-50 text-indigo-600',
            valueCls: 'text-gray-900',
        },
    ];

    return (
        <div className="-m-4 sm:-m-6 lg:-m-8 min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row items-stretch bg-gray-50/60">

            {/* ── Left Main Content & Operations ───────────────────────────────── */}
            <div className="flex-1 min-w-0 p-6 lg:p-8 space-y-6">
                {/* 1. Department Header */}
                <div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-2xl font-bold text-slate-900">{department.name}</h1>
                        {department.code && (
                            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/60 uppercase">
                                {department.code}
                            </span>
                        )}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                            department.isActive 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200/60' 
                                : 'bg-slate-100 text-slate-600 border-slate-200/60'
                        }`}>
                            {department.isActive ? 'Active' : 'Archived'}
                        </span>
                    </div>
                    {department.description ? (
                        <p className="text-sm text-slate-500 max-w-3xl mt-1.5 leading-relaxed">{department.description}</p>
                    ) : (
                        <p className="text-sm text-slate-400 italic max-w-3xl mt-1.5">No description provided.</p>
                    )}
                </div>

                {/* 2. 4-Column Stat Strip */}
                <div className="bg-white border border-slate-200/80 rounded-2xl grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4">
                        <p className="text-xs font-medium text-slate-500 whitespace-nowrap">Total Staff</p>
                        <p className="text-xl font-semibold text-slate-900 tabular-nums mt-1">{department.staffCount ?? staffList.length ?? 0}</p>
                    </div>
                    <div className="px-5 py-4">
                        <p className="text-xs font-medium text-slate-500 whitespace-nowrap">Resolved</p>
                        <p className="text-xl font-semibold text-slate-900 tabular-nums mt-1">{sla.totalResolved ?? 0}</p>
                    </div>
                    <div className="px-5 py-4">
                        <p className="text-xs font-medium text-slate-500 whitespace-nowrap">SLA Breached</p>
                        <p className="text-xl font-semibold text-slate-900 tabular-nums mt-1">{sla.totalBreached ?? 0}</p>
                    </div>
                    <div className="px-5 py-4">
                        <p className="text-xs font-medium text-slate-500 whitespace-nowrap">Avg. Resolution</p>
                        <p className="text-xl font-semibold text-slate-900 tabular-nums mt-1">{sla.avgResolutionHours ?? 0}h</p>
                    </div>
                </div>

                {/* 3. Staff Members Card */}
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <h2 className="text-base font-bold text-slate-900">Staff Members</h2>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                                {staffList.length}
                            </span>
                        </div>

                        {staffList.length > 0 && (
                            <div className="relative min-w-[220px] sm:min-w-[260px]">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Search staff members..."
                                    value={staffSearchTerm}
                                    onChange={(e) => setStaffSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3.5 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
                                />
                            </div>
                        )}
                    </div>

                    {staffLoading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    ) : staffList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                                <Users className="w-6 h-6" />
                            </div>
                            <p className="text-sm font-semibold text-slate-800">No staff members assigned to this department yet.</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm">Use "Assign Staff" to allocate members from the unassigned pool or transfer them from other departments.</p>
                            <button
                                onClick={() => setActiveModal('assignStaff')}
                                className="mt-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span>Assign Staff</span>
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/70">
                                        <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Member</th>
                                        <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Position</th>
                                        <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Rank</th>
                                        <th className="px-5 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {staffList
                                        .filter((staff: any) => {
                                            if (!staffSearchTerm.trim()) return true;
                                            const term = staffSearchTerm.toLowerCase();
                                            const name = (staff.profile?.fullName || '').toLowerCase();
                                            const email = (staff.email || '').toLowerCase();
                                            const post = (staff.profile?.position || '').toLowerCase();
                                            return name.includes(term) || email.includes(term) || post.includes(term);
                                        })
                                        .map((staff: any) => {
                                            const isHead = staff._id?.toString() === headId || staff.role === 'department_head';
                                            return (
                                                <tr key={staff._id} className="hover:bg-slate-50/70 transition-colors">
                                                    {/* Member: Avatar + Name & Email Combined */}
                                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <UserAvatar
                                                                name={staff.profile?.fullName || staff.email}
                                                                src={staff.profile?.profileImage || staff.profile?.avatar}
                                                                size="sm"
                                                                className="w-8 h-8 text-xs"
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-semibold text-slate-900 text-sm whitespace-nowrap truncate">
                                                                        {staff.profile?.fullName || staff.email}
                                                                    </span>
                                                                    {isHead && (
                                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md shrink-0 shadow-2xs">
                                                                            <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                                                            <span>Head</span>
                                                                        </span>
                                                                    )}
                                                                    {staff.employmentStatus === 'SUSPENDED' && (
                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                                                                            Suspended
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-500 truncate mt-0.5">{staff.email}</p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Position */}
                                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                                        {staff.profile?.position ? (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50/80 text-blue-700 border border-blue-200/60 whitespace-nowrap">
                                                                {staff.profile.position}
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs text-slate-400 italic">None</span>
                                                        )}
                                                    </td>

                                                    {/* Rank */}
                                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize whitespace-nowrap ${getRankColor(staff.rank || 'junior')}`}>
                                                            {getRankDisplay(staff.rank)}
                                                        </span>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="px-5 py-3.5 whitespace-nowrap text-right">
                                                        <ActionsMenu
                                                            staff={staff}
                                                            isHead={isHead}
                                                            onViewProfile={() => {
                                                                setSelectedStaff(staff);
                                                                setActiveModal('staffProfile');
                                                            }}
                                                            onEditRankPosition={() => {
                                                                setSelectedStaff(staff);
                                                                setEditStaffPosition(staff.profile?.position || '');
                                                                setEditStaffRank(staff.rank || 'junior');
                                                                setActiveModal('editRankPosition');
                                                            }}
                                                            onPromote={() => {
                                                                setSelectedStaff(staff);
                                                                setActiveModal('confirmPromote');
                                                            }}
                                                            onDemoteRank={() => {
                                                                setSelectedStaff(staff);
                                                                setActiveModal('confirmDemoteRank');
                                                            }}
                                                            onDemoteHead={() => {
                                                                setSelectedStaff(staff);
                                                                setActiveModal('confirmDemoteHead');
                                                            }}
                                                            onSetAsHead={() => handleQuickSetHead(staff)}
                                                            onTransferDept={() => {
                                                                setSelectedStaff(staff);
                                                                setTargetTransferDeptId('');
                                                                setActiveModal('transferStaff');
                                                            }}
                                                            onRemove={() => {
                                                                setSelectedStaff(staff);
                                                                setActiveModal('remove');
                                                            }}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Right Docked Sidebar (Flush to right edge, starts level with title) ─ */}
            <div className="w-full lg:w-[320px] xl:w-[340px] shrink-0 bg-white border-t lg:border-t-0 lg:border-l border-slate-200/90 flex flex-col divide-y divide-slate-100 shadow-xs">
                {/* 1. Action Buttons at the Top of the Sidebar */}
                <div className="p-5 grid grid-cols-2 gap-2.5">
                    <button
                        onClick={openEditModal}
                        className="w-full bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 px-3 py-2 rounded-xl text-sm font-medium text-center transition-colors shadow-2xs cursor-pointer"
                    >
                        Edit Details
                    </button>
                    <button
                        onClick={() => setActiveModal('assignStaff')}
                        className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-3 py-2 rounded-xl text-sm font-medium shadow-sm text-center transition-colors cursor-pointer"
                    >
                        Assign Staff
                    </button>
                </div>

                {/* 2. Department Head */}
                <div className="p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">Department Head</p>
                        <div className="flex items-center gap-2">
                            {department.headOfDepartment && (
                                <button
                                    onClick={() => setActiveModal('confirmDemoteHead')}
                                    className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                                >
                                    Demote
                                </button>
                            )}
                            <button
                                onClick={() => setActiveModal('assignHead')}
                                className="text-xs font-medium text-blue-600 hover:underline cursor-pointer"
                            >
                                {department.headOfDepartment ? 'Change' : 'Assign'}
                            </button>
                        </div>
                    </div>
                    {department.headOfDepartment ? (
                        <div className="flex items-center gap-3">
                            <UserAvatar
                                name={department.headOfDepartment.profile?.fullName || department.headOfDepartment.email}
                                src={department.headOfDepartment.profile?.profileImage || department.headOfDepartment.profile?.avatar}
                                size="md"
                            />
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">
                                    {department.headOfDepartment.profile?.fullName || 'Assigned Head'}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{department.headOfDepartment.email}</p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400">Unassigned</p>
                    )}
                </div>

                {/* 3. SLA Target (Red Accent) */}
                <div className="p-5">
                    <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-2">SLA Target</p>
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-bold tabular-nums bg-rose-50 text-rose-600 border border-rose-200/70">
                            {department.slaTargetHours || 24} Hours
                        </span>
                        <span className="text-xs text-slate-400">resolution target</span>
                    </div>
                </div>

                {/* 4. Job Positions (Soft Blue Tint) */}
                <div className="p-5">
                    <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-3">Job Positions</p>
                    {department.positions && department.positions.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {department.positions.map((pos: string) => (
                                <span
                                    key={pos}
                                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50/80 text-blue-700 border border-blue-200/60"
                                >
                                    {pos}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">None configured</p>
                    )}
                </div>

                {/* 5. Complaint Categories (Distinct Soft Amber Tint) */}
                <div className="p-5">
                    <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase mb-3">Complaint Categories</p>
                    {department.keywords && department.keywords.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {department.keywords.map((cat: string) => (
                                <span
                                    key={cat}
                                    className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50/80 text-amber-800 border border-amber-200/60"
                                >
                                    {cat}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">None configured</p>
                    )}
                </div>
            </div>

            {/* ══════════ MODALS ══════════ */}

            {/* Edit Department */}
            {activeModal === 'editDept' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <Card variant="lg" className="w-full max-w-md p-8 relative">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Edit Department</h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleEditDept} className="space-y-4">
                            <InputField label="Department Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                            <InputField label="SLA Target Hours" type="number" value={editForm.slaTargetHours} onChange={(e) => setEditForm({ ...editForm, slaTargetHours: Number(e.target.value) })} required helperText="Maximum resolution time in hours" />
                            <div>
                                <label className="label-field">Department Head</label>
                                <select
                                    value={editForm.headId}
                                    onChange={(e) => setEditForm({ ...editForm, headId: e.target.value })}
                                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all bg-white font-medium"
                                >
                                    <option value="">Unassigned</option>
                                    {staffList.map((s: any) => (
                                        <option key={s._id} value={s._id}>
                                            {s.profile?.fullName || s.email}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label-field">Description (Optional)</label>
                                <textarea className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none min-h-[90px] text-sm" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Describe the department's purpose..." />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <Button variant="outline" fullWidth onClick={closeModal} disabled={updatingDept}>Cancel</Button>
                                <Button type="submit" variant="primary" fullWidth isLoading={updatingDept}>Save Changes</Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}

            {/* Assign Head */}
            {activeModal === 'assignHead' && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <Card variant="lg" className="w-full max-w-md p-8 relative">
                        <div className="flex justify-between items-center mb-2">
                            <h2 className="text-xl font-bold text-gray-900">Assign Department Head</h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm text-gray-500 mb-5">Select a staff member already in this department.</p>
                        {staffList.length === 0 ? (
                            <div className="py-8 text-center text-gray-400">
                                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                                <p className="text-sm">No staff in this department yet.</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                {staffList.map((s: any) => (
                                    <label key={s._id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedAssignee === s._id ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}>
                                        <input type="radio" name="head" value={s._id} checked={selectedAssignee === s._id} onChange={() => setSelectedAssignee(s._id)} className="accent-blue-600" />
                                        <UserAvatar 
                                            name={s.profile?.fullName || s.email} 
                                            src={s.profile?.profileImage || s.profile?.avatar}
                                            size="sm"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-gray-900 truncate">
                                                {s.profile?.fullName || s.email}
                                                {s._id?.toString() === headId && <span className="ml-1.5 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">Current</span>}
                                            </p>
                                            <p className="text-xs text-gray-400 truncate">{s.email}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getRankColor(s.rank || 'junior')}`}>{s.rank || 'Junior'}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                        <div className="flex gap-3 mt-5">
                            <Button variant="outline" fullWidth onClick={closeModal} disabled={assigningHead}>Cancel</Button>
                            <Button variant="primary" fullWidth onClick={handleAssignHead} disabled={!selectedAssignee || assigningHead} isLoading={assigningHead}>Confirm Assignment</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Assign Staff Modal (Redesigned with Multi-Select & Segmented Control) */}
            {activeModal === 'assignStaff' && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                    <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
                        {showAssignConfirmView ? (
                            /* Confirmation View for BOTH Tabs */
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* 1. Replace Header Directly (No Blue Box) */}
                                <div className="px-6 pt-5 pb-4 border-b border-slate-100 shrink-0">
                                    <div className="flex items-start justify-between gap-4">
                                        <h2 className="text-base font-semibold text-slate-900">
                                            {staffTab === 'unassigned' ? 'Confirm Staff Assignment' : 'Confirm Department Transfer'}
                                        </h2>
                                        <button
                                            onClick={closeModal}
                                            disabled={assigningStaff}
                                            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                                        {staffTab === 'unassigned' ? (
                                            <>
                                                Are you sure you want to assign{' '}
                                                <span className="font-semibold text-slate-900">
                                                    {selectedStaffIds.length === 1
                                                        ? (unassignedStaff.find(s => s._id === selectedStaffIds[0])?.profile?.fullName ||
                                                           unassignedStaff.find(s => s._id === selectedStaffIds[0])?.name ||
                                                           unassignedStaff.find(s => s._id === selectedStaffIds[0])?.email ||
                                                           'this staff member')
                                                        : `${selectedStaffIds.length} staff members`}
                                                </span>{' '}
                                                to <span className="font-semibold text-slate-900">{department.name}</span>?
                                            </>
                                        ) : (
                                            <>
                                                Are you sure you want to move{' '}
                                                <span className="font-semibold text-slate-900">
                                                    {selectedStaffIds.length === 1
                                                        ? (otherStaff.find(s => s._id === selectedStaffIds[0])?.profile?.fullName ||
                                                           otherStaff.find(s => s._id === selectedStaffIds[0])?.name ||
                                                           otherStaff.find(s => s._id === selectedStaffIds[0])?.email ||
                                                           'this staff member')
                                                        : `${selectedStaffIds.length} staff members`}
                                                </span>{' '}
                                                from{' '}
                                                <span className="font-semibold text-slate-900">
                                                    {selectedStaffIds.length === 1
                                                        ? (otherStaff.find(s => s._id === selectedStaffIds[0])?.departmentId?.name || 'their current department')
                                                        : 'their current departments'}
                                                </span>{' '}
                                                to <span className="font-semibold text-slate-900">{department.name}</span>?
                                            </>
                                        )}
                                    </p>
                                </div>

                                {/* 2. Clean, Compact Staff Summary List */}
                                <div className="px-6 py-4 overflow-y-auto flex-1">
                                    <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 divide-y divide-slate-200/60 max-h-52 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
                                        {(staffTab === 'unassigned' ? unassignedStaff : otherStaff)
                                            .filter(s => selectedStaffIds.includes(s._id))
                                            .map(s => {
                                                const displayName = s.profile?.fullName || s.name || s.email;
                                                const initial = displayName.charAt(0).toUpperCase();
                                                return (
                                                    <div
                                                        key={s._id}
                                                        className="px-3.5 py-2.5 flex items-center justify-between gap-3"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <UserAvatar
                                                                name={displayName}
                                                                src={s.profile?.profileImage || s.profile?.avatar}
                                                                size="xs"
                                                                className="w-7 h-7 text-xs"
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium text-slate-900 truncate leading-tight">
                                                                    {displayName}
                                                                </p>
                                                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                                                    {s.email}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {staffTab === 'unassigned' ? (
                                                            <span className="capitalize bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0">
                                                                {getRankDisplay(s.rank || 'junior')}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200/80 px-2 py-0.5 rounded-md shrink-0">
                                                                <span>{s.departmentId?.name || 'Current Dept'}</span>
                                                                <span className="text-slate-400">→</span>
                                                                <span className="text-blue-600 font-semibold">{department.name}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>

                                {/* 3. Proper Separated Footer */}
                                <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setShowAssignConfirmView(false)}
                                        disabled={assigningStaff}
                                        className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAssignStaff}
                                        disabled={assigningStaff}
                                        className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-xs disabled:opacity-50 whitespace-nowrap flex items-center gap-2 focus:outline-none transition-colors"
                                    >
                                        {assigningStaff && <Loader2 className="w-4 h-4 animate-spin" />}
                                        <span>
                                            {staffTab === 'unassigned' ? 'Confirm Assignment' : 'Confirm Transfer'}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Normal Selection View */
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* Header for Normal Selection */}
                                <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4 border-b border-slate-100 shrink-0">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">Assign Staff</h2>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            Add unassigned staff or transfer members to <span className="font-semibold text-slate-700">{department.name}</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={closeModal}
                                        disabled={assigningStaff}
                                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                {/* Modern Segmented Tabs */}
                                <div className="px-6 pt-3 pb-3 shrink-0">
                                    <div className="bg-slate-100 p-1 rounded-xl grid grid-cols-2 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStaffTab('unassigned');
                                                setSelectedStaffIds([]);
                                            }}
                                            className={`py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 focus:outline-none ${
                                                staffTab === 'unassigned'
                                                    ? 'bg-white text-slate-900 shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <span>Unassigned Staff</span>
                                            <span className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${
                                                staffTab === 'unassigned' ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/70 text-slate-600'
                                            }`}>
                                                {unassignedStaff.length}
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setStaffTab('other');
                                                setSelectedStaffIds([]);
                                            }}
                                            className={`py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 focus:outline-none ${
                                                staffTab === 'other'
                                                    ? 'bg-white text-slate-900 shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            <span>Transfer from Dept.</span>
                                            <span className={`text-xs px-1.5 py-0.2 rounded-full font-semibold ${
                                                staffTab === 'other' ? 'bg-slate-100 text-slate-700' : 'bg-slate-200/70 text-slate-600'
                                            }`}>
                                                {otherStaff.length}
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Search & Multi-Select Bar */}
                                <div className="px-6 pb-3 space-y-2.5 shrink-0">
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        <input
                                            type="text"
                                            placeholder="Search by name or email..."
                                            value={assignSearch}
                                            onChange={(e) => setAssignSearch(e.target.value)}
                                            className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200/80 text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all placeholder:text-slate-400"
                                        />
                                    </div>

                                    {/* Select All Row */}
                                    <div className="flex items-center justify-between text-xs px-0.5">
                                        <div
                                            onClick={() => {
                                                const allSelected = filteredModalStaff.length > 0 && filteredModalStaff.every(s => selectedStaffIds.includes(s._id));
                                                if (allSelected) {
                                                    const filteredIds = new Set(filteredModalStaff.map(s => s._id));
                                                    setSelectedStaffIds(selectedStaffIds.filter(id => !filteredIds.has(id)));
                                                } else {
                                                    const allIds = Array.from(new Set([...selectedStaffIds, ...filteredModalStaff.map(s => s._id)]));
                                                    setSelectedStaffIds(allIds);
                                                }
                                            }}
                                            className="flex items-center gap-2 cursor-pointer select-none text-slate-600 hover:text-slate-900 font-medium"
                                        >
                                            {(() => {
                                                const allSelected = filteredModalStaff.length > 0 && filteredModalStaff.every(s => selectedStaffIds.includes(s._id));
                                                return (
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                                        allSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                                                    }`}>
                                                        {allSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                                    </div>
                                                );
                                            })()}
                                            <span>Select all</span>
                                        </div>

                                        {selectedStaffIds.length > 0 && (
                                            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-md">
                                                {selectedStaffIds.length} selected
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Multi-Select Staff List in Unified Container */}
                                <div className="px-6 pb-4 overflow-y-auto flex-1">
                                    {filteredModalStaff.length === 0 ? (
                                        <div className="py-12 text-center text-slate-400 text-sm rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
                                            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                            <p>No staff found matching criteria.</p>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-slate-200/80 divide-y divide-slate-100 bg-white max-h-72 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
                                            {filteredModalStaff.map((s: any) => {
                                                const isSelected = selectedStaffIds.includes(s._id);
                                                const displayName = s.profile?.fullName || s.name || s.email;
                                                const initial = displayName.charAt(0).toUpperCase();

                                                const toggleSelection = () => {
                                                    if (isSelected) {
                                                        setSelectedStaffIds(selectedStaffIds.filter(uid => uid !== s._id));
                                                    } else {
                                                        setSelectedStaffIds([...selectedStaffIds, s._id]);
                                                    }
                                                };

                                                return (
                                                    <div
                                                        key={s._id}
                                                        onClick={toggleSelection}
                                                        className={`px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                                            isSelected ? 'bg-blue-50/50 hover:bg-blue-50/80' : 'hover:bg-slate-50/80'
                                                        }`}
                                                    >
                                                        {/* Left: Custom Checkbox + Avatar + Name & Email */}
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                                                isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                                                            }`}>
                                                                {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                                            </div>

                                                            {s.profile?.avatar || s.profile?.profileImage ? (
                                                                <UserAvatar
                                                                    name={displayName}
                                                                    src={s.profile?.profileImage || s.profile?.avatar}
                                                                    size="sm"
                                                                    className="w-8 h-8 text-xs"
                                                                />
                                                            ) : (
                                                                <UserAvatar
                                                                    name={displayName}
                                                                    size="sm"
                                                                    className="w-8 h-8 text-xs"
                                                                />
                                                            )}

                                                            <div className="min-w-0">
                                                                <p className="text-sm font-medium text-slate-900 truncate leading-tight">
                                                                    {displayName}
                                                                </p>
                                                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                                                    {s.email}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {/* Right: Badges cleanly aligned */}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {staffTab === 'other' && s.departmentId?.name && (
                                                                <span className="bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15 text-[11px] font-medium px-2 py-0.5 rounded-md truncate max-w-[140px]">
                                                                    From {s.departmentId.name}
                                                                </span>
                                                            )}
                                                            <span className="capitalize bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-md">
                                                                {getRankDisplay(s.rank || 'junior')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Sleek Single-Line Footer */}
                                <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between shrink-0">
                                    <span className="text-xs font-medium text-slate-500">
                                        {selectedStaffIds.length} selected
                                    </span>
                                    <div className="flex items-center gap-2.5">
                                        <button
                                            type="button"
                                            onClick={closeModal}
                                            disabled={assigningStaff}
                                            className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedStaffIds.length === 0) return;
                                                setShowAssignConfirmView(true);
                                            }}
                                            disabled={selectedStaffIds.length === 0 || assigningStaff}
                                            className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-xs disabled:opacity-40 whitespace-nowrap flex items-center gap-2 focus:outline-none transition-colors"
                                        >
                                            {assigningStaff && <Loader2 className="w-4 h-4 animate-spin" />}
                                            <span>
                                                {staffTab === 'unassigned'
                                                    ? `Add to Department${selectedStaffIds.length > 0 ? ` (${selectedStaffIds.length})` : ''}`
                                                    : `Transfer Staff${selectedStaffIds.length > 0 ? ` (${selectedStaffIds.length})` : ''}`}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Staff Profile */}
            {activeModal === 'staffProfile' && selectedStaff && (
                <StaffProfileModal
                    staff={selectedStaff}
                    isHead={selectedStaff._id?.toString() === headId}
                    onClose={closeModal}
                />
            )}

            {/* Remove / Unassign Staff Confirm Modal */}
            {activeModal === 'remove' && selectedStaff && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
                        {/* Body (p-6) */}
                        <div className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <h3 className="text-base font-semibold text-slate-900">Remove from Department</h3>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={removing}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                                Are you sure you want to remove{' '}
                                <span className="font-medium text-slate-900">
                                    {selectedStaff.profile?.fullName || selectedStaff.name || selectedStaff.email}
                                </span>{' '}
                                from this department? They will be moved back to the unassigned pool.
                            </p>
                        </div>

                        {/* Clean Right-Aligned Footer */}
                        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={removing}
                                className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleRemove}
                                disabled={removing}
                                className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2 focus:outline-none"
                            >
                                {removing && <Loader2 className="w-4 h-4 animate-spin" />}
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Position / Rank Modal */}
            {activeModal === 'editRankPosition' && selectedStaff && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="px-6 pt-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">Edit Position & Rank</h2>
                                <p className="text-xs text-slate-500 mt-0.5">{selectedStaff.profile?.fullName || selectedStaff.email}</p>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={updatingStaffRole}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSaveRankPosition}>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-slate-700 mb-1.5 block">Position / Title</label>
                                    <input
                                        type="text"
                                        value={editStaffPosition}
                                        onChange={(e) => setEditStaffPosition(e.target.value)}
                                        placeholder="e.g. Senior Electrician, Technician"
                                        className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all"
                                    />
                                    {department.positions && department.positions.length > 0 && (
                                        <div className="mt-2.5">
                                            <p className="text-[11px] font-medium text-slate-400 mb-1.5">Preset Department Positions:</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {department.positions.map((p: string) => (
                                                    <button
                                                        key={p}
                                                        type="button"
                                                        onClick={() => setEditStaffPosition(p)}
                                                        className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                                                            editStaffPosition === p
                                                                ? 'bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                    >
                                                        {p}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-slate-700 mb-1.5 block">Rank</label>
                                    <select
                                        value={editStaffRank}
                                        onChange={(e) => setEditStaffRank(e.target.value)}
                                        className="w-full h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 capitalize focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all cursor-pointer"
                                    >
                                        <option value="junior">Junior</option>
                                        <option value="senior">Senior</option>
                                        <option value="lead">Team Lead</option>
                                        <option value="supervisor">Supervisor</option>
                                    </select>
                                </div>
                            </div>

                            {/* Clean Right-Aligned Footer */}
                            <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={updatingStaffRole}
                                    className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={updatingStaffRole}
                                    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-xs disabled:opacity-40 flex items-center gap-2 focus:outline-none transition-colors"
                                >
                                    {updatingStaffRole && <Loader2 className="w-4 h-4 animate-spin" />}
                                    <span>Save Changes</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Transfer Staff Modal */}
            {activeModal === 'transferStaff' && selectedStaff && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="px-6 pt-5 pb-4 flex items-start justify-between gap-4 shrink-0">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">Transfer Department</h2>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Move <span className="font-semibold text-slate-700">{selectedStaff.profile?.fullName || selectedStaff.email}</span> to another department
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={assigningStaff}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Current Info Strip */}
                        <div className="mx-6 mb-4 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-xs shrink-0">
                            <div>
                                <span className="text-slate-500">Current: </span>
                                <span className="font-semibold text-slate-800">{department.name}</span>
                            </div>
                            <div>
                                <span className="text-slate-500">Position: </span>
                                <span className="font-medium text-slate-700">{selectedStaff.profile?.position || 'None'}</span>
                            </div>
                        </div>

                        {/* Destination List */}
                        <form onSubmit={handleExecuteTransfer} className="flex-1 flex flex-col overflow-hidden">
                            <div className="mx-6 mb-5 rounded-xl border border-slate-200/80 divide-y divide-slate-100 overflow-y-auto max-h-60 bg-white [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
                                {allDepartments
                                    .filter((d: any) => d._id !== id)
                                    .map((d: any) => {
                                        const isSelected = targetTransferDeptId === d._id;
                                        return (
                                            <div
                                                key={d._id}
                                                onClick={() => setTargetTransferDeptId(d._id)}
                                                className={`px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                                    isSelected ? 'bg-blue-50/60' : 'hover:bg-slate-50/80'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                                        isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                                                    }`}>
                                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-slate-900 truncate leading-tight">{d.name}</p>
                                                        <p className="text-xs text-slate-500 truncate mt-0.5">
                                                            {d.staffCount ?? 0} staff members · {d.slaTargetHours || 24}h SLA
                                                        </p>
                                                    </div>
                                                </div>
                                                {d.code && (
                                                    <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                                                        {d.code}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                            </div>

                            {/* Sleek Footer */}
                            <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 mt-auto">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={assigningStaff}
                                    className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!targetTransferDeptId || assigningStaff}
                                    className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-xs disabled:opacity-40 flex items-center gap-2 focus:outline-none transition-colors"
                                >
                                    {assigningStaff && <Loader2 className="w-4 h-4 animate-spin" />}
                                    <span>Confirm Transfer</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Promotion Modal */}
            {activeModal === 'confirmPromote' && selectedStaff && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
                        {/* Header (p-6) */}
                        <div className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <h3 className="text-base font-semibold text-slate-900">Confirm Promotion</h3>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={promotingStaff}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                                Are you sure you want to promote{' '}
                                <span className="font-semibold text-slate-900">
                                    {selectedStaff.profile?.fullName || selectedStaff.name || selectedStaff.email}
                                </span>{' '}
                                from{' '}
                                <span className="font-semibold text-slate-900">
                                    {getRankDisplay(selectedStaff.rank || 'junior')}
                                </span>{' '}
                                to{' '}
                                <span className="font-semibold text-slate-900">
                                    {getNextRank(selectedStaff.rank || 'junior') || 'next rank'}
                                </span>?
                            </p>
                        </div>

                        {/* Clean Right-Aligned Footer */}
                        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={promotingStaff}
                                className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmPromote}
                                disabled={promotingStaff}
                                className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-xs disabled:opacity-50 flex items-center gap-2 focus:outline-none transition-colors"
                            >
                                {promotingStaff && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>Confirm Promotion</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Demote Rank Modal */}
            {activeModal === 'confirmDemoteRank' && selectedStaff && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
                        {/* Header (p-6) */}
                        <div className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <h3 className="text-base font-semibold text-slate-900">Confirm Demotion</h3>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={demotingStaff}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                                Are you sure you want to demote{' '}
                                <span className="font-semibold text-slate-900">
                                    {selectedStaff.profile?.fullName || selectedStaff.name || selectedStaff.email}
                                </span>{' '}
                                from{' '}
                                <span className="font-semibold text-slate-900">
                                    {getRankDisplay(selectedStaff.rank || 'junior')}
                                </span>{' '}
                                to{' '}
                                <span className="font-semibold text-slate-900">
                                    {getPreviousRank(selectedStaff.rank || 'junior') || 'previous rank'}
                                </span>?
                            </p>
                        </div>

                        {/* Clean Right-Aligned Footer */}
                        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={demotingStaff}
                                className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDemoteRank}
                                disabled={demotingStaff}
                                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow-xs disabled:opacity-50 flex items-center gap-2 focus:outline-none transition-colors"
                            >
                                {demotingStaff && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>Confirm Demotion</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Demote Department Head Modal */}
            {activeModal === 'confirmDemoteHead' && department.headOfDepartment && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
                        {/* Header (p-6) */}
                        <div className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <h3 className="text-base font-semibold text-slate-900">Confirm Head Demotion</h3>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={assigningHead}
                                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                                Are you sure you want to demote{' '}
                                <span className="font-semibold text-slate-900">
                                    {department.headOfDepartment?.profile?.fullName || department.headOfDepartment?.name || department.headOfDepartment?.email}
                                </span>{' '}
                                from{' '}
                                <span className="font-semibold text-slate-900">Department Head</span>{' '}
                                of{' '}
                                <span className="font-semibold text-slate-900">{department.name}</span>{' '}
                                back to regular staff?
                            </p>
                        </div>

                        {/* Clean Right-Aligned Footer */}
                        <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={assigningHead}
                                className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDemoteHead}
                                disabled={assigningHead}
                                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow-xs disabled:opacity-50 flex items-center gap-2 focus:outline-none transition-colors"
                            >
                                {assigningHead && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>Confirm Demotion</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepartmentDetailPage;
