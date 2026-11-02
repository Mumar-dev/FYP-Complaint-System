import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Filter,
  Inbox,
  CheckCheck,
  Loader2,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import {
  useGetNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} from '@/features/notification/notification.api';
import { ROUTES } from '@/constants';
import { showSuccess, showError } from '@/utils/toast';

export const StaffNotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'adjustments'>('all');

  const { data: response, isLoading, refetch } = useGetNotificationsQuery();
  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead, { isLoading: isMarkingAll }] = useMarkAllAsReadMutation();

  const notifications = response?.data || [];

  const unreadCount = notifications.filter((n: any) => !n.read).length;
  const adjustmentsCount = notifications.filter(
    (n: any) => n.type === 'evidence_rejected' || n.title?.toLowerCase().includes('adjustment')
  ).length;

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n: any) => {
      if (activeTab === 'unread') return !n.read;
      if (activeTab === 'adjustments') {
        return (
          n.type === 'evidence_rejected' ||
          n.title?.toLowerCase().includes('adjustment') ||
          n.message?.toLowerCase().includes('adjustment')
        );
      }
      return true;
    });
  }, [notifications, activeTab]);

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead().unwrap();
      showSuccess('All notifications marked as read');
      refetch();
    } catch (err: any) {
      showError(err?.data?.message || 'Failed to mark all as read');
    }
  };

  const handleNotificationClick = async (notif: any) => {
    try {
      if (!notif.read) {
        await markAsRead(notif._id).unwrap();
      }
    } catch (e) {
      console.error('Error marking as read', e);
    }

    if (notif.complaintId) {
      const cId = typeof notif.complaintId === 'object' ? notif.complaintId._id : notif.complaintId;
      navigate(ROUTES.STAFF_COMPLAINT_DETAIL.replace(':id', cId));
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    const days = Math.floor(diff / 86400);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTypeBadge = (type: string, title?: string) => {
    if (type === 'evidence_rejected' || title?.toLowerCase().includes('adjustment')) {
      return {
        label: 'Adjustments Requested',
        bg: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
        icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
      };
    }
    if (type === 'assignment' || type === 'reassignment') {
      return {
        label: 'New Assignment',
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500',
        icon: <Inbox className="w-4 h-4 text-blue-600" />,
      };
    }
    if (type === 'evidence_approved' || type === 'status_update') {
      return {
        label: 'Approved / Status',
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
      };
    }
    return {
      label: type.replace(/_/g, ' '),
      bg: 'bg-slate-50 text-slate-700 border-slate-200',
      dot: 'bg-slate-400',
      icon: <Bell className="w-4 h-4 text-slate-500" />,
    };
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Bell className="w-6 h-6 text-slate-700" />
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Stay updated on new assignments, supervisor feedback, and approvals.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={isMarkingAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors shrink-0"
          >
            {isMarkingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-4 h-4 text-blue-600" />
            )}
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* ── Filter Tabs ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3 sm:p-4 flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>All</span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
              activeTab === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-200/70 text-slate-600'
            }`}
          >
            {notifications.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('unread')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'unread'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                activeTab === 'unread' ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700'
              }`}
            >
              {unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('adjustments')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
            activeTab === 'adjustments'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-amber-800 hover:bg-amber-50/80'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Adjustments Requested</span>
          {adjustmentsCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                activeTab === 'adjustments' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {adjustmentsCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Notification Feed ──────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Bell className="w-6 h-6" />
          </div>
          <p className="text-base font-semibold text-slate-900">No notifications</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {activeTab === 'adjustments'
              ? 'No supervisor adjustments have been requested on your tasks.'
              : activeTab === 'unread'
              ? 'You have caught up with all unread notifications.'
              : 'You have no notifications right now.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif: any) => {
            const badge = getTypeBadge(notif.type, notif.title);
            const isUnread = !notif.read;
            const hasComplaint = Boolean(notif.complaintId);
            const isAdjustment =
              notif.type === 'evidence_rejected' ||
              notif.title?.toLowerCase().includes('adjustment');

            return (
              <div
                key={notif._id}
                className={`border rounded-2xl p-5 sm:p-6 transition-all shadow-sm ${
                  isAdjustment
                    ? 'bg-amber-50/40 border-amber-200/90 hover:border-amber-300'
                    : isUnread
                    ? 'bg-blue-50/30 border-blue-200 hover:border-blue-300'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left Icon & Text */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-2xs ${
                        isAdjustment
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : isUnread
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {badge.icon}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Top Badges & Timestamp */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                          {badge.label}
                        </span>

                        {isUnread && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-600 text-white uppercase tracking-wider">
                            New
                          </span>
                        )}

                        <span className="text-xs text-slate-400 font-medium ml-auto sm:ml-0">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>

                      {/* Title if present */}
                      {notif.title && (
                        <h3 className="text-sm font-bold text-slate-900 tracking-tight pt-1">
                          {notif.title}
                        </h3>
                      )}

                      {/* Full Untruncated Notification Message */}
                      <p
                        className={`text-sm leading-relaxed whitespace-pre-line pt-0.5 ${
                          isAdjustment
                            ? 'text-amber-950 font-medium'
                            : isUnread
                            ? 'text-slate-900 font-medium'
                            : 'text-slate-700'
                        }`}
                      >
                        {notif.message}
                      </p>
                    </div>
                  </div>

                  {/* Right Action Button */}
                  {hasComplaint && (
                    <div className="sm:self-center shrink-0 pt-2 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleNotificationClick(notif)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs ${
                          isAdjustment
                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <span>View Complaint</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffNotificationsPage;
