import React, { useState } from 'react';
import { useGetPendingUsersQuery, useApproveUserMutation, useRejectUserMutation } from '@/features/admin/admin.api';
import {
  Search, CheckCircle2, XCircle, Loader2, UserCheck, UserX, Clock,
  ShieldAlert, User, Phone, MapPin, FileText, ExternalLink, X, Eye
} from 'lucide-react';
import UserAvatar from '@/components/Common/UserAvatar';
import { showSuccess, showError } from '@/utils/toast';

export const AdminApproveResidentsPage: React.FC = () => {
  const { data, isLoading } = useGetPendingUsersQuery(undefined, { pollingInterval: 30000 });
  const [approveUser, { isLoading: isApproving }] = useApproveUserMutation();
  const [rejectUser, { isLoading: isRejecting }] = useRejectUserMutation();

  const [searchTerm, setSearchTerm] = useState('');

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedRejectId, setSelectedRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Lightbox preview state for proof document
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const pendingUsers = data?.data?.pendingUsers || (Array.isArray(data?.data) ? data.data : []);
  const approvedCount = data?.data?.approvedCount ?? '--';
  const rejectedCount = data?.data?.rejectedCount ?? '--';

  const filteredUsers = pendingUsers.filter((user: any) =>
    user.role === 'resident' && (
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.profile?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.profile?.cnic?.includes(searchTerm)
    )
  );

  const handleApprove = async (id: string) => {
    try {
      await approveUser(id).unwrap();
      showSuccess('Resident approved');
    } catch (err) {
      console.error(err);
      showError('Failed to approve resident');
    }
  };

  const openRejectModal = (id: string) => {
    setSelectedRejectId(id);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (selectedRejectId) {
      try {
        await rejectUser({ id: selectedRejectId, reason: rejectReason }).unwrap();
        showSuccess('Resident rejected');
        setIsRejectModalOpen(false);
        setSelectedRejectId(null);
      } catch (err) {
        console.error(err);
        showError('Failed to reject resident');
      }
    }
  };

  const cancelReject = () => {
    setIsRejectModalOpen(false);
    setSelectedRejectId(null);
  };

  // Helper to build valid URL for proof document
  const getProofUrl = (url?: string) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `http://localhost:5000${cleanPath}`;
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200/80 gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Resident Approvals</h1>
          <p className="text-sm text-slate-500 mt-1">Review and verify resident accounts before granting access.</p>
        </div>
      </div>

      {/* 1. STATS PANELS (Clean White Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pending Approvals */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Approvals</p>
            <h2 className="text-2xl font-semibold text-slate-900 mt-1">{pendingUsers.length}</h2>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
        </div>

        {/* Approved Accounts */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Approved Accounts</p>
            <h2 className="text-2xl font-semibold text-slate-900 mt-1">{approvedCount}</h2>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        {/* Rejected Accounts */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rejected Accounts</p>
            <h2 className="text-2xl font-semibold text-slate-900 mt-1">{rejectedCount}</h2>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center">
            <UserX className="w-5 h-5 text-rose-600" />
          </div>
        </div>
      </div>

      {/* 2. SEARCH BAR (Single Crisp Input, No Double Box) */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by Resident Name, Email, or CNIC..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-10 w-full rounded-xl bg-white border border-slate-200/80 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all"
        />
      </div>

      {/* 3. QUEUE */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-dashed border-slate-200 text-center">
            <ShieldAlert className="w-10 h-10 text-slate-300 mb-2.5" />
            <h3 className="text-base font-semibold text-slate-800">No Pending Approvals</h3>
            <p className="text-slate-400 mt-1 text-xs">The verification queue is currently empty.</p>
          </div>
        ) : (
          filteredUsers.map((user: any) => {
            const proofUrl = getProofUrl(user.profile?.proofDocumentUrl);
            const residentName = user.profile?.fullName || 'Resident';
            const initial = residentName.charAt(0).toUpperCase();

            return (
              <div
                key={user._id}
                className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs transition-colors hover:border-slate-300 flex flex-col gap-5"
              >
                {/* Top Row: User Profile on Left, Actions on Right */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <UserAvatar
                      name={residentName}
                      src={user.profile?.profileImage || user.profile?.avatar}
                      size="md"
                      className="w-11 h-11 text-sm"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-slate-900 truncate leading-tight">
                          {residentName}
                        </h3>
                        <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(user.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => openRejectModal(user._id)}
                      disabled={isRejecting}
                      className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow-xs transition-colors disabled:opacity-50 focus:outline-none"
                    >
                      <span>Reject</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(user._id)}
                      disabled={isApproving}
                      className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-xs transition-colors disabled:opacity-50 focus:outline-none"
                    >
                      <span>Approve</span>
                    </button>
                  </div>
                </div>

                {/* Details Strip (3 Columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50/70 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">CNIC</p>
                      <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                        {user.profile?.cnic || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50/70 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5">
                    <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Phone</p>
                      <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                        {user.profile?.phone || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50/70 rounded-lg px-3.5 py-2.5 flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Resident Unit</p>
                      <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                        {user.profile?.address
                          ? `Unit ${user.profile.address.houseNumber || 'N/A'}, Block ${user.profile.address.block || 'A'}`
                          : `Unit ${user.profile?.houseNumber || '0'}, Block ${user.profile?.block || 'A'}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Verification Proof Image Section */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-slate-500">Residence Proof Document:</span>
                    {proofUrl && proofUrl !== 'dummy_url_for_now' ? (
                      <div
                        onClick={() => setPreviewImageUrl(proofUrl)}
                        className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50/60 hover:border-blue-200 transition-colors cursor-pointer"
                      >
                        <img
                          src={proofUrl}
                          alt="Proof document preview"
                          className="w-7 h-7 object-cover rounded border border-slate-200"
                          onError={(e) => {
                            // If load fails, hide image and show fallback icon
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <span className="text-xs font-medium text-slate-700 group-hover:text-blue-700 flex items-center gap-1">
                          <span>View Proof Document</span>
                          <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No proof document uploaded</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* LIGHTBOX MODAL FOR PROOF DOCUMENT PREVIEW */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Residence Proof Document</h3>
              <div className="flex items-center gap-2">
                <a
                  href={previewImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Open full size in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-100/60 overflow-auto flex items-center justify-center flex-1">
              <img
                src={previewImageUrl}
                alt="Enlarged residence proof"
                className="max-w-full max-h-[70vh] object-contain rounded-lg border border-slate-200 shadow-sm"
              />
            </div>
            <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL (Clean & Modern Shell) */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-base font-semibold text-slate-900">Reject Application</h3>
                <button
                  type="button"
                  onClick={cancelReject}
                  disabled={isRejecting}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                Are you sure you want to reject this resident's registration? You can optionally provide a reason for the applicant.
              </p>

              <div className="mt-4">
                <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                  Rejection Reason <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Invalid CNIC, unit mismatch..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 focus:outline-none transition-all resize-none"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={cancelReject}
                disabled={isRejecting}
                className="h-9 px-4 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors focus:outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={isRejecting}
                className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow-xs transition-colors disabled:opacity-50 flex items-center gap-2 focus:outline-none"
              >
                {isRejecting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Reject Resident</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApproveResidentsPage;
