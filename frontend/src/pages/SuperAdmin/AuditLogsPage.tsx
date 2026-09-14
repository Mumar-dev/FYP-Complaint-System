import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  History, 
  Search, 
  Download, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Calendar, 
  Shield, 
  ChevronDown, 
  Info, 
  Copy, 
  Check, 
  ChevronUp, 
  FileCode
} from 'lucide-react';
import { axiosInstance } from '../../services/customBaseQuery';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface AuditLogActor {
  _id?: string;
  email?: string;
  role?: string;
  profile?: {
    fullName?: string;
  };
}

interface AuditLogEntry {
  _id: string;
  userId?: AuditLogActor;
  userRole?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

interface PaginationData {
  current: number;
  limit: number;
  total: number;
  pages: number;
}

// Convert camelCase or snake_case key to human-readable Title Case
const formatKeyName = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

// Check if string is an ISO date string
const isIsoDate = (val: any): boolean => {
  if (typeof val !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val);
};

// Format values for human display
const formatValueDisplay = (val: any): string => {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (isIsoDate(val)) {
    try {
      return format(new Date(val), 'MMM dd, yyyy · hh:mm a');
    } catch {
      return String(val);
    }
  }
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      if (val.length === 0) return 'None';
      return val.map((v) => formatValueDisplay(v)).join(', ');
    }
    return Object.entries(val)
      .map(([k, v]) => `${formatKeyName(k)}: ${formatValueDisplay(v)}`)
      .join(' · ');
  }
  return String(val);
};

// Clean 1-line summary helper for the table DETAILS column (no raw JSON)
const getDetailsSummary = (log: AuditLogEntry): string => {
  const d = log.details;
  if (!d || Object.keys(d).length === 0) return '—';

  if (d.reason) return String(d.reason);
  if (d.title) return `"${d.title}"`;
  if (d.feedbackComment) return `"${d.feedbackComment}"`;
  if (d.rating) return `Rating: ${d.rating} / 5`;

  if (log.action.includes('SLA_BREACH') && d.slaDeadline) {
    return `Breached (Deadline was ${format(new Date(d.slaDeadline), 'MMM dd, HH:mm')})`;
  }

  if (log.action.includes('SLA_WARNING') && d.thresholdPercent) {
    return `Threshold reached (${d.thresholdPercent}% SLA elapsed)`;
  }

  if (d.previousStatus && d.newStatus) {
    return `Status: ${d.previousStatus.replace(/_/g, ' ')} → ${d.newStatus.replace(/_/g, ' ')}`;
  }

  if (d.newValue && typeof d.newValue === 'object') {
    const summaryParts = Object.entries(d.newValue)
      .filter(([k]) => k !== 'previousValue')
      .slice(0, 2)
      .map(([k, v]) => `${formatKeyName(k)}: ${formatValueDisplay(v)}`);
    if (summaryParts.length > 0) return summaryParts.join(' · ');
  }

  if (log.action.includes('ASSIGN') && (d.primaryStaffId || d.complaintId)) {
    const target = d.complaintId ? `#${String(d.complaintId).slice(-6)}` : '';
    return `Staff assigned to complaint ${target}`.trim();
  }

  if (d.category) return `Category: ${d.category}`;

  // Fallback: take first non-object key or key-value
  const firstEntry = Object.entries(d).find(([, v]) => typeof v !== 'object' && v !== null);
  if (firstEntry) {
    return `${formatKeyName(firstEntry[0])}: ${formatValueDisplay(firstEntry[1])}`;
  }

  return 'Event recorded successfully';
};

const SuperAdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  
  // Date range states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateRangePreset, setDateRangePreset] = useState<'all' | 'today' | '7d' | '30d' | 'custom'>('all');
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState('');
  const [tempEndDate, setTempEndDate] = useState('');
  const datePopoverRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableEntities, setAvailableEntities] = useState<string[]>([]);
  
  // Modal states
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const [pagination, setPagination] = useState<PaginationData>({
    current: 1,
    limit: 20,
    total: 0,
    pages: 1
  });

  // Close date popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePopoverRef.current && !datePopoverRef.current.contains(e.target as Node)) {
        setIsDatePopoverOpen(false);
      }
    };
    if (isDatePopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDatePopoverOpen]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchAuditLogs = useCallback(async (page: number = 1) => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        page,
        limit: pageSize,
      };

      if (actionFilter && actionFilter !== 'all') params.action = actionFilter;
      if (entityFilter && entityFilter !== 'all') params.entityType = entityFilter;
      if (roleFilter && roleFilter !== 'all') params.userRole = roleFilter;
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await axiosInstance.get('/dashboard/audit-logs', { params });
      const rawData = response.data;
      const resData = rawData?.data || rawData;

      if (resData && Array.isArray(resData.logs)) {
        setLogs(resData.logs);
        if (resData.pagination) setPagination(resData.pagination);
        if (resData.availableFilters) {
          if (Array.isArray(resData.availableFilters.actions)) setAvailableActions(resData.availableFilters.actions);
          if (Array.isArray(resData.availableFilters.entityTypes)) setAvailableEntities(resData.availableFilters.entityTypes);
        }
      } else if (resData && Array.isArray(resData.auditLogs)) {
        setLogs(resData.auditLogs);
        if (resData.pagination) setPagination(resData.pagination);
      } else if (Array.isArray(resData)) {
        setLogs(resData);
        setPagination({
          current: page,
          limit: pageSize,
          total: resData.length,
          pages: Math.ceil(resData.length / pageSize) || 1
        });
      } else if (Array.isArray(rawData?.logs)) {
        setLogs(rawData.logs);
        if (rawData.pagination) setPagination(rawData.pagination);
      } else {
        setLogs([]);
      }
      setCurrentPage(page);
    } catch (error) {
      console.error('[Audit Logs] Error fetching data:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, entityFilter, roleFilter, debouncedSearch, startDate, endDate, pageSize]);

  useEffect(() => {
    fetchAuditLogs(currentPage);
  }, [fetchAuditLogs, currentPage]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setActionFilter('all');
    setEntityFilter('all');
    setRoleFilter('all');
    setStartDate('');
    setEndDate('');
    setTempStartDate('');
    setTempEndDate('');
    setDateRangePreset('all');
    setCurrentPage(1);
  };

  // Date Preset Handlers
  const handleSelectPreset = (preset: 'all' | 'today' | '7d' | '30d') => {
    setDateRangePreset(preset);
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      setTempStartDate('');
      setTempEndDate('');
    } else if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
      setTempStartDate(todayStr);
      setTempEndDate(todayStr);
    } else if (preset === '7d') {
      const past7 = format(subDays(today, 7), 'yyyy-MM-dd');
      setStartDate(past7);
      setEndDate(todayStr);
      setTempStartDate(past7);
      setTempEndDate(todayStr);
    } else if (preset === '30d') {
      const past30 = format(subDays(today, 30), 'yyyy-MM-dd');
      setStartDate(past30);
      setEndDate(todayStr);
      setTempStartDate(past30);
      setTempEndDate(todayStr);
    }

    setCurrentPage(1);
    setIsDatePopoverOpen(false);
  };

  const handleApplyCustomDates = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setDateRangePreset('custom');
    setCurrentPage(1);
    setIsDatePopoverOpen(false);
  };

  const handleClearDates = () => {
    setStartDate('');
    setEndDate('');
    setTempStartDate('');
    setTempEndDate('');
    setDateRangePreset('all');
    setCurrentPage(1);
    setIsDatePopoverOpen(false);
  };

  // Formatted date button label
  const dateButtonLabel = useMemo(() => {
    if (!startDate && !endDate) return 'Date Range';
    if (startDate && endDate) {
      if (startDate === endDate) return format(new Date(startDate), 'MMM dd, yyyy');
      return `${format(new Date(startDate), 'MMM dd')} – ${format(new Date(endDate), 'MMM dd')}`;
    }
    if (startDate) return `From ${format(new Date(startDate), 'MMM dd')}`;
    return `Until ${format(new Date(endDate), 'MMM dd')}`;
  }, [startDate, endDate]);

  const isDateActive = Boolean(startDate || endDate);

  // Action formatter: "SLA_BREACH_DETECTED" -> "SLA Breach Detected"
  const formatActionName = (action: string) => {
    if (!action) return 'Unknown Action';
    let text = action
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return text.replace(/\bSla\b/g, 'SLA');
  };

  // Action badge: subtle red for SLA breaches, subtle blue for everything else
  const getActionBadgeClass = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('BREACH')) {
      return 'bg-red-50 text-red-600 border border-red-200/80';
    }
    return 'bg-blue-50 text-blue-700 border border-blue-200/60';
  };

  // Role badge: unified clean neutral slate
  const roleBadgeClass = 'bg-slate-100 text-slate-600 text-[11px] font-medium px-2 py-0.5 rounded-md';

  // Copy Entity ID to clipboard
  const handleCopyId = (idText: string) => {
    navigator.clipboard.writeText(idText);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Active filter chips calculation
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; value: string; onRemove: () => void }[] = [];

    if (debouncedSearch.trim()) {
      chips.push({
        key: 'search',
        label: 'Search',
        value: debouncedSearch.trim(),
        onRemove: () => {
          setSearchTerm('');
          setDebouncedSearch('');
          setCurrentPage(1);
        }
      });
    }

    if (actionFilter !== 'all') {
      chips.push({
        key: 'action',
        label: 'Action',
        value: formatActionName(actionFilter),
        onRemove: () => {
          setActionFilter('all');
          setCurrentPage(1);
        }
      });
    }

    if (entityFilter !== 'all') {
      chips.push({
        key: 'entity',
        label: 'Entity',
        value: entityFilter,
        onRemove: () => {
          setEntityFilter('all');
          setCurrentPage(1);
        }
      });
    }

    if (roleFilter !== 'all') {
      const roleMap: Record<string, string> = {
        superadmin: 'Super Admin',
        admin: 'Admin',
        department_head: 'Dept Head',
        staff: 'Staff',
        resident: 'Resident',
        system: 'System'
      };
      chips.push({
        key: 'role',
        label: 'Role',
        value: roleMap[roleFilter] || roleFilter,
        onRemove: () => {
          setRoleFilter('all');
          setCurrentPage(1);
        }
      });
    }

    if (startDate || endDate) {
      chips.push({
        key: 'date',
        label: 'Date',
        value: dateButtonLabel,
        onRemove: () => {
          handleClearDates();
        }
      });
    }

    return chips;
  }, [debouncedSearch, actionFilter, entityFilter, roleFilter, startDate, endDate, dateButtonLabel]);

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = [
      'Timestamp',
      'Actor Name',
      'Actor Email',
      'Actor Role',
      'Action',
      'Entity Type',
      'Entity ID',
      'Details Summary',
      'IP Address'
    ];

    const rows = logs.map((log) => {
      const actorName = log.userId?.profile?.fullName || (log.userRole === 'system' ? 'System Automated' : 'Unknown');
      const actorEmail = log.userId?.email || 'N/A';
      const actorRole = log.userRole || log.userId?.role || 'N/A';
      const actionName = formatActionName(log.action);
      const entity = log.entityType || 'General';
      const entityId = log.entityId || 'N/A';
      const detailsStr = getDetailsSummary(log).replace(/"/g, '""');
      const ip = log.ipAddress || 'N/A';

      return [
        `"${format(new Date(log.createdAt), 'yyyy-MM-dd HH:mm:ss')}"`,
        `"${actorName}"`,
        `"${actorEmail}"`,
        `"${actorRole}"`,
        `"${actionName}"`,
        `"${entity}"`,
        `"${entityId}"`,
        `"${detailsStr}"`,
        `"${ip}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `system-audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* ── Page Header (Date Range Popover Button + Export CSV) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">System Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Immutable audit trail of complaint workflows, SLA breaches, staff actions, and security events
          </p>
        </div>

        {/* Top-Right Header Actions: Date Range Popover + Export CSV */}
        <div className="flex items-center gap-2.5 shrink-0 relative">
          
          {/* Modern Date Range Popover Button */}
          <div className="relative" ref={datePopoverRef}>
            <button
              type="button"
              onClick={() => {
                setTempStartDate(startDate);
                setTempEndDate(endDate);
                setIsDatePopoverOpen(!isDatePopoverOpen);
              }}
              className={`inline-flex items-center gap-2 bg-white hover:bg-slate-50 border rounded-lg px-3 py-1.5 text-sm font-medium transition-colors shadow-2xs cursor-pointer ${
                isDateActive
                  ? 'border-blue-300 text-blue-700 bg-blue-50/40'
                  : 'border-slate-200 text-slate-700'
              }`}
            >
              <Calendar className={`w-4 h-4 ${isDateActive ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>{dateButtonLabel}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
            </button>

            {/* Date Range Popover */}
            {isDatePopoverOpen && (
              <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-white border border-slate-200/90 rounded-xl shadow-xl shadow-slate-900/5 p-4 animate-in fade-in duration-150">
                <div className="space-y-3.5">
                  {/* Quick Presets */}
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Quick Presets</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'all', label: 'All Time' },
                        { id: 'today', label: 'Today' },
                        { id: '7d', label: 'Last 7 Days' },
                        { id: '30d', label: 'Last 30 Days' },
                      ].map((preset) => {
                        const isPresetSelected =
                          preset.id === 'all'
                            ? !isDateActive
                            : dateRangePreset === preset.id && isDateActive;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleSelectPreset(preset.id as any)}
                            className={`px-3 py-2 text-xs font-medium rounded-lg text-center transition-colors cursor-pointer border ${
                              isPresetSelected
                                ? 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-500/20 font-semibold'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Range Inputs */}
                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Custom Range</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 block mb-1">Start Date</label>
                        <input
                          type="date"
                          value={tempStartDate}
                          onChange={(e) => setTempStartDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none transition-all cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 block mb-1">End Date</label>
                        <input
                          type="date"
                          value={tempEndDate}
                          onChange={(e) => setTempEndDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 outline-none transition-all cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Popover Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleClearDates}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyCustomDates}
                      disabled={!tempStartDate && !tempEndDate}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-xs font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={logs.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-sm font-medium shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* ── Compact Filter Toolbar Card (Clean 4-column layout without raw date inputs) ── */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
          {/* 1. Global Search */}
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search audit logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Action Filter */}
          <div className="lg:col-span-3 relative">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 pl-3 pr-8 py-1.5 focus:bg-white focus:outline-none focus:border-blue-500 cursor-pointer transition-all"
            >
              <option value="all">All Actions</option>
              {availableActions.map((act) => (
                <option key={act} value={act}>
                  {formatActionName(act)}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* 3. Entity Type Filter */}
          <div className="lg:col-span-2 relative">
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 pl-3 pr-8 py-1.5 focus:bg-white focus:outline-none focus:border-blue-500 cursor-pointer transition-all"
            >
              <option value="all">All Entities</option>
              {availableEntities.map((ent) => (
                <option key={ent} value={ent}>
                  {ent}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* 4. Role Filter */}
          <div className="lg:col-span-2 relative">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 pl-3 pr-8 py-1.5 focus:bg-white focus:outline-none focus:border-blue-500 cursor-pointer transition-all"
            >
              <option value="all">All Roles</option>
              <option value="superadmin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="department_head">Dept Head</option>
              <option value="staff">Staff</option>
              <option value="resident">Resident</option>
              <option value="system">System</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Active Filter Chips Row (Label = Value ×) ── */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs font-semibold text-slate-400 mr-1">Active Filters:</span>
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 py-1 text-xs shadow-xs"
            >
              <span className="text-slate-600 font-normal">{chip.label}</span>
              <span className="text-blue-600 font-medium">=</span>
              <span className="font-semibold text-slate-900">{chip.value}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                title={`Remove ${chip.label} filter`}
                className="text-slate-400 hover:text-slate-700 ml-0.5 p-0.5 rounded transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Clear all link */}
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 underline ml-2 cursor-pointer transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Polished Audit Log Table Card (No Horizontal Scrollbar) ── */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Table summary bar */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 text-xs">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Entries</h2>
            <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full tabular-nums border border-slate-200/60">
              {pagination.total.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 text-xs text-slate-700 focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Scrollable Container with Sticky Table Header */}
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse table-auto">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5 font-semibold w-32">Timestamp</th>
                <th className="py-3 px-3.5 font-semibold w-40">Actor / Role</th>
                <th className="py-3 px-3.5 font-semibold w-48">Action</th>
                <th className="py-3 px-3.5 font-semibold w-28">Target</th>
                <th className="py-3 px-3.5 font-semibold min-w-[220px]">Details</th>
                <th className="py-3 px-3.5 text-right font-semibold w-16">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <p className="font-medium text-slate-500">Loading audit records...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No audit logs found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {activeChips.length > 0 ? 'Try adjusting your active filters.' : 'No audit entries recorded in the database.'}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actorName = log.userId?.profile?.fullName || (log.userRole === 'system' ? 'System Automated' : 'User');
                  const role = log.userRole || log.userId?.role || 'system';
                  const summaryText = getDetailsSummary(log);

                  return (
                    <tr 
                      key={log._id} 
                      onClick={() => {
                        setSelectedLog(log);
                        setShowRawJson(false);
                      }}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* 1. Timestamp */}
                      <td className="py-3 px-3.5 tabular-nums text-slate-600 font-medium">
                        <div className="flex flex-col">
                          <span className="whitespace-nowrap">{format(new Date(log.createdAt), 'MMM dd, yyyy')}</span>
                          <span className="text-[11px] text-slate-400 font-normal whitespace-nowrap">
                            {format(new Date(log.createdAt), 'hh:mm:ss a')}
                          </span>
                        </div>
                      </td>

                      {/* 2. Actor & Role (Unified clean slate badge) */}
                      <td className="py-3 px-3.5">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="font-semibold text-slate-900 truncate max-w-[150px]" title={actorName}>
                            {actorName}
                          </span>
                          <span className={`${roleBadgeClass} uppercase w-fit`}>
                            {role}
                          </span>
                        </div>
                      </td>

                      {/* 3. Action */}
                      <td className="py-3 px-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${getActionBadgeClass(log.action)}`}>
                          {formatActionName(log.action)}
                        </span>
                      </td>

                      {/* 4. Target / Entity (Clean entity name ONLY) */}
                      <td className="py-3 px-3.5">
                        <span className="font-semibold text-slate-800">
                          {log.entityType || 'General'}
                        </span>
                      </td>

                      {/* 5. Details (Human readable 1-line summary) */}
                      <td className="py-3 px-3.5">
                        <p className="text-xs text-slate-600 truncate max-w-[280px]" title={summaryText}>
                          {summaryText}
                        </p>
                      </td>

                      {/* 6. View Button */}
                      <td className="py-3 px-3.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(log);
                            setShowRawJson(false);
                          }}
                          className="px-2.5 py-1 rounded-md text-blue-600 hover:bg-blue-50 font-medium text-xs transition-colors cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Footer ── */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50 text-xs">
          <p className="text-slate-500">
            Showing Page <span className="font-semibold text-slate-800">{pagination.current}</span> of{' '}
            <span className="font-semibold text-slate-800">{pagination.pages || 1}</span> ({pagination.total} records)
          </p>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              disabled={currentPage <= 1 || loading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-2.5 text-slate-600 font-semibold">
              {currentPage}
            </span>

            <button
              type="button"
              disabled={currentPage >= (pagination.pages || 1) || loading}
              onClick={() => setCurrentPage((p) => Math.min(pagination.pages || 1, p + 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Redesigned Audit Log Detail Modal (Light Mode & Structured) ── */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {formatActionName(selectedLog.action)}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Audit Log Entry #{String(selectedLog._id).slice(-8)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto text-xs">
              
              {/* 1. Overview Grid */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 grid grid-cols-2 gap-y-3.5 gap-x-4">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Timestamp</p>
                  <p className="text-slate-900 font-medium mt-0.5 tabular-nums">
                    {format(new Date(selectedLog.createdAt), 'MMM dd, yyyy · hh:mm:ss a')}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Actor Role</p>
                  <span className={`${roleBadgeClass} uppercase inline-block mt-0.5`}>
                    {selectedLog.userRole || selectedLog.userId?.role || 'system'}
                  </span>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Actor Name</p>
                  <p className="text-slate-900 font-medium mt-0.5">
                    {selectedLog.userId?.profile?.fullName || (selectedLog.userRole === 'system' ? 'System Automated' : 'Unknown')}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Actor Email</p>
                  <p className="text-slate-900 font-medium mt-0.5 truncate" title={selectedLog.userId?.email || 'N/A'}>
                    {selectedLog.userId?.email || 'N/A'}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Entity Target</p>
                  <p className="text-slate-900 font-medium mt-0.5">
                    {selectedLog.entityType || 'General'}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Entity ID</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-mono text-slate-800 truncate max-w-[130px]">
                      {selectedLog.entityId || 'N/A'}
                    </span>
                    {selectedLog.entityId && (
                      <button
                        type="button"
                        onClick={() => handleCopyId(selectedLog.entityId!)}
                        title="Copy Entity ID"
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                      >
                        {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {selectedLog.ipAddress && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">IP Address</p>
                    <p className="font-mono text-slate-800 mt-0.5">{selectedLog.ipAddress}</p>
                  </div>
                )}
              </div>

              {/* 2. Structured Event Details / Changes */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800">Event Details & Changes</h4>
                
                {selectedLog.details && Object.keys(selectedLog.details).length > 0 ? (
                  <div className="bg-white border border-slate-200/80 rounded-xl divide-y divide-slate-100 overflow-hidden shadow-2xs">
                    {Object.entries(selectedLog.details)
                      .filter(([key, val]) => {
                        // Omit empty or null previousValue fields
                        if (key === 'previousValue' && (val === null || val === undefined)) return false;
                        return true;
                      })
                      .map(([key, val]) => (
                        <div key={key} className="px-4 py-2.5 flex items-start justify-between gap-4">
                          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                            {formatKeyName(key)}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 text-right break-all">
                            {formatValueDisplay(val)}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No additional event metadata recorded.</p>
                )}
              </div>

              {/* 3. Collapsible Raw JSON for debugging */}
              {selectedLog.details && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRawJson(!showRawJson)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>{showRawJson ? 'Hide Raw JSON' : 'View Raw JSON'}</span>
                    {showRawJson ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {showRawJson && (
                    <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-mono text-[11px] overflow-x-auto leading-relaxed max-h-48">
                      <pre>{JSON.stringify(selectedLog.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
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

export default SuperAdminAuditLogsPage;
