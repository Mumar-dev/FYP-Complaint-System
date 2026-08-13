import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, X, ChevronDown, User, Settings, LogOut, CheckCheck, Clock, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import UserAvatar from './UserAvatar';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@hooks/useAuth';
import { USER_ROLES, ROUTES } from '@constants/index';
import { useGetNotificationsQuery, useMarkAsReadMutation, useMarkAllAsReadMutation } from '@/features/notification/notification.api';
import { getSocket, joinUserRoom } from '@/services/socket.service';

interface NavbarProps {
  onMenuClick?: () => void;
  sidebarOpen?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick, sidebarOpen = true }) => {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Notifications API Hook (polls every 30s as fallback)
  const { data: notificationsData, refetch: refetchNotifications } = useGetNotificationsQuery(undefined, {
    pollingInterval: 30000,
    skip: !user
  });
  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead] = useMarkAllAsReadMutation();

  const notificationsList: any[] = Array.isArray(notificationsData?.data)
    ? notificationsData.data
    : Array.isArray(notificationsData)
    ? notificationsData
    : [];

  const unreadCount = notificationsList.filter((n: any) => !n.read).length;

  // Resolve role-based dashboard route
  const getDashboardLink = () => {
    switch (user?.role) {
      case 'resident':
        return ROUTES.RESIDENT_DASHBOARD;
      case 'staff':
        return ROUTES.STAFF_DASHBOARD;
      case 'supervisor':
        return ROUTES.SUPERVISOR_DASHBOARD;
      case 'department_head':
        return ROUTES.DEPARTMENT_DASHBOARD;
      case 'admin':
        return ROUTES.ADMIN_DASHBOARD;
      case 'superadmin':
        return ROUTES.SUPERADMIN_DASHBOARD;
      default:
        return ROUTES.LOGIN;
    }
  };

  // Real-time socket listener for notifications
  useEffect(() => {
    if (!user?._id) return;
    const socket = getSocket();
    joinUserRoom(user._id);

    const handleNewNotif = (_notif: any) => {
      refetchNotifications();
    };

    socket.on('notification', handleNewNotif);

    return () => {
      socket.off('notification', handleNewNotif);
    };
  }, [user?._id, refetchNotifications]);

  // Format relative timestamp helper
  const getRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    const now = new Date().getTime();
    const then = new Date(dateStr).getTime();
    const diffSec = Math.floor((now - then) / 1000);

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showMenu || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu, showNotifications]);

  const handleLogout = async () => {
    setShowMenu(false);
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const getProfileLink = () => {
    if (user?.role === 'resident') return ROUTES.RESIDENT_PROFILE;
    return ROUTES.PROFILE;
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.read) {
      try {
        await markAsRead(notif._id).unwrap();
      } catch (err) {
        console.error('Failed to mark notification as read', err);
      }
    }
    setShowNotifications(false);

    // Target navigation based on notification type and complaintId
    if (notif.complaintId) {
      const complaintId = typeof notif.complaintId === 'string' ? notif.complaintId : notif.complaintId?._id;
      if (complaintId) {
        if (user?.role === 'resident') {
          navigate(ROUTES.RESIDENT_COMPLAINT_DETAIL.replace(':id', complaintId));
        } else if (user?.role === 'department_head') {
          navigate(`/department/complaints/${complaintId}`);
        } else {
          navigate(`/complaints/${complaintId}`);
        }
        return;
      }
    }

    if (notif.type === 'resident_registered') {
      navigate('/admin/approve-residents');
      return;
    }

    if (notif.type === 'transfer_request' || notif.type === 'employee_transfer') {
      if (user?.role === 'admin' || user?.role === 'superadmin') {
        navigate('/admin/transfer-requests');
      } else if (user?.role === 'department_head') {
        navigate(ROUTES.DEPARTMENT_REQUESTS);
      }
      return;
    }

    if (notif.type === 'attendance_correction' || notif.type === 'leave_submitted') {
      if (user?.role === 'department_head') {
        navigate(ROUTES.DEPARTMENT_REQUESTS);
      }
      return;
    }

    if (notif.type === 'check_in' || notif.type === 'check_out') {
      if (user?.role === 'department_head') {
        navigate(ROUTES.DEPARTMENT_ATTENDANCE);
      }
      return;
    }
  };

  // Render notification message parsing bold markdown syntax **[Prefix]**
  const renderNotificationMessage = (msg: string) => {
    if (!msg) return null;
    const boldRegex = /\*\*(.*?)\*\*/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIdx = 0;
    let match;

    while ((match = boldRegex.exec(msg)) !== null) {
      if (match.index > lastIdx) {
        parts.push(msg.substring(lastIdx, match.index));
      }
      parts.push(
        <strong key={match.index} className="font-bold text-slate-900">
          {match[1]}
        </strong>
      );
      lastIdx = match.index + match[0].length;
    }

    if (lastIdx < msg.length) {
      parts.push(msg.substring(lastIdx));
    }

    return parts.length > 0 ? parts : msg;
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead().unwrap();
      refetchNotifications();
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-xs h-16 w-full flex items-center px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between w-full">
        {/* Left Section: Menu Toggle + Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200 lg:hidden text-gray-600 focus:outline-none"
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-gray-700" />
            ) : (
              <Menu className="w-5 h-5 text-gray-700" />
            )}
          </button>

          {/* Logo / Brand & Role Portal Badge */}
          <Link to={getDashboardLink()} className="flex items-center gap-2.5 group">
            <div className="h-9 px-3 bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-sm tracking-wide transition-colors">
              {user?.role ? USER_ROLES[user.role as keyof typeof USER_ROLES] || user.role.replace('_', ' ') : 'CMS'}
            </div>
            <span className="font-bold text-gray-900 hidden sm:inline text-sm tracking-tight">
              Portal
            </span>
          </Link>
        </div>

        {/* Center Section: Page / Role Context (Optional subtle context) */}
        <div className="hidden md:block text-center">
          <span className="text-xs font-medium text-slate-400">
            {user?.role ? `${USER_ROLES[user.role as keyof typeof USER_ROLES] || user.role.replace('_', ' ')} Portal` : 'Portal'}
          </span>
        </div>

        {/* Right Section: Notifications + User Profile Menu */}
        <div className="flex items-center gap-3">
          {/* Notifications Popover */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 focus:outline-none"
              aria-label="Notifications"
              aria-expanded={showNotifications}
            >
              <Bell className="w-5 h-5 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full ring-2 ring-white flex items-center justify-center animate-in zoom-in-75 duration-150">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown Window */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Header */}
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark all as read</span>
                    </button>
                  )}
                </div>

                {/* Notifications Scrollable List */}
                <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                  {notificationsList.length === 0 ? (
                    <div className="py-10 text-center px-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                        <Bell className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700">No notifications yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {user?.role === 'department_head'
                          ? "We'll alert you when new complaints, staff requests, or attendance updates arrive."
                          : "We'll alert you as soon as your requests are updated."}
                      </p>
                    </div>
                  ) : (
                    notificationsList.map((notif: any) => (
                      <div
                        key={notif._id}
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-start gap-3 relative ${
                          !notif.read ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-none mt-0.5 ${
                          !notif.read ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {user?.role === 'department_head' ? (
                            /* Single concise sentence for Department Head without duplicate title header */
                            <>
                              <p className="text-xs text-slate-700 leading-relaxed">
                                {renderNotificationMessage(notif.message)}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                                <Clock className="w-3 h-3 text-slate-400" />
                                <span>{getRelativeTime(notif.createdAt)}</span>
                              </div>
                            </>
                          ) : (
                            /* Standard multi-line layout for other roles */
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-xs truncate ${!notif.read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                                  {notif.title || 'Notification'}
                                </p>
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                  {getRelativeTime(notif.createdAt)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                {notif.message}
                              </p>
                            </>
                          )}
                        </div>
                        {!notif.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 flex-none self-center"></span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-2.5 p-1.5 sm:px-2.5 sm:py-1.5 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-200 focus:outline-none cursor-pointer"
              aria-expanded={showMenu}
              aria-haspopup="true"
            >
              <UserAvatar
                name={user?.profile?.fullName || user?.email}
                src={user?.profile?.profileImage || user?.profile?.avatar}
                size="sm"
              />
              <div className="hidden sm:block text-left max-w-[120px] lg:max-w-[160px]">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {user?.profile?.fullName || user?.email?.split('@')[0]}
                </p>
                <p className="text-[11px] text-gray-400 capitalize truncate leading-tight">
                  {user?.role ? user.role.replace('_', ' ') : 'Resident'}
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                {/* User Header in Dropdown */}
                <div className="px-3.5 py-2.5 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
                  <div className="flex items-center gap-1.5 leading-none flex-wrap">
                    <span className="text-xs font-bold text-gray-900 truncate">
                      {user?.profile?.fullName || 'User'}
                    </span>
                    <span className="flex-none text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 capitalize leading-none">
                      {user?.role ? user.role.replace('_', ' ') : 'Resident'}
                    </span>
                  </div>
                  {user?.email && (
                    <p className="text-[11px] text-gray-400 truncate mt-1 leading-none">
                      {user.email}
                    </p>
                  )}
                </div>

                {/* Navigation Links */}
                <div className="p-1 space-y-0.5">
                  <Link
                    to={getProfileLink()}
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:text-blue-600 hover:bg-blue-50/70 rounded-xl transition-colors"
                  >
                    <User className="w-4 h-4 text-gray-400" />
                    <span>My Profile</span>
                  </Link>

                  <Link
                    to={ROUTES.SETTINGS}
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-gray-700 hover:text-blue-600 hover:bg-blue-50/70 rounded-xl transition-colors"
                  >
                    <Settings className="w-4 h-4 text-gray-400" />
                    <span>Account Settings</span>
                  </Link>
                </div>

                {/* Sign Out Action */}
                <div className="pt-1 mt-1 border-t border-gray-100 p-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors text-left"
                  >
                    <LogOut className="w-4 h-4 text-red-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
