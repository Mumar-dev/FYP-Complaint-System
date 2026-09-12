import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  CheckCircle2,
  Calendar,
  Camera,
  X,
  ArrowRight,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { useGetComplaintsQuery } from '@/features/complaint/complaint.api';
import { ROUTES } from '@/constants';

export const CompletedWorkPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch complaints for current logged-in staff
  const { data: complaintsData, isLoading, isError, refetch } = useGetComplaintsQuery();
  const complaints = complaintsData?.data || [];

  // Filter to show only completed/resolved/closed complaints
  const completedComplaints = useMemo(() => {
    return complaints.filter((c) => c.status === 'resolved' || c.status === 'closed');
  }, [complaints]);

  const filteredComplaints = useMemo(() => {
    return completedComplaints.filter((c) => {
      const q = searchTerm.toLowerCase().trim();
      if (!q) return true;
      const titleMatch = c.title?.toLowerCase().includes(q);
      const descMatch = c.description?.toLowerCase().includes(q);
      const idMatch =
        (c.complaintId && c.complaintId.toLowerCase().includes(q)) ||
        (c._id && c._id.toLowerCase().includes(q));
      return titleMatch || descMatch || idMatch;
    });
  }, [completedComplaints, searchTerm]);

  const getPriorityBadge = (priority: string) => {
    const p = (priority || '').toLowerCase();
    switch (p) {
      case 'critical':
      case 'high':
      case 'urgent':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            {p === 'critical' ? 'Critical' : 'High'}
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Medium
          </span>
        );
      case 'low':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Low
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'resolved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Resolved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
        Closed
      </span>
    );
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200/60 rounded-xl w-64 mb-6"></div>
        <div className="h-16 bg-white border border-slate-200/80 rounded-2xl mb-6"></div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 bg-white border border-slate-200/80 rounded-2xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Completed Work</h1>
        <p className="text-sm text-slate-500 mt-1">
          View all your resolved and closed complaints.
        </p>
      </div>

      {/* Search Bar & Results Counter */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by title or complaint ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50/80 border border-slate-200 text-xs sm:text-sm font-medium rounded-xl pl-10 pr-9 py-2.5 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <span className="text-xs text-slate-500 font-medium shrink-0">
          Showing <strong className="text-slate-800 font-semibold">{filteredComplaints.length}</strong> completed ticket{filteredComplaints.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error State */}
      {isError && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-rose-900">Failed to Load Completed Work</h3>
          <p className="text-xs text-rose-600 mt-1">There was an issue fetching records. Please try again.</p>
          <button
            onClick={() => refetch()}
            className="mt-3 text-xs font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-100/50 px-3 py-1.5 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isError && filteredComplaints.length === 0 && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-base font-semibold text-slate-900">No completed work found</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchTerm
              ? 'No completed complaints match your search query.'
              : 'Resolved and closed complaints assigned to you will appear here once verified.'}
          </p>
        </div>
      )}

      {/* Completed Complaints Cards */}
      {!isError && filteredComplaints.length > 0 && (
        <div className="space-y-4">
          {filteredComplaints.map((complaint) => {
            // Display formatted unique complaintId (e.g. CMP-20261120-7604), fall back to _id slice only if absent
            const complaintCode =
              complaint.complaintId ||
              `#${(complaint._id || '').slice(-6).toUpperCase()}`;

            // Proof photos count (check resolutionPhotos, resolutionEvidence.images, or attachedImages)
            const proofCount =
              (complaint as any).resolutionPhotos?.length ||
              (complaint as any).resolutionEvidence?.images?.length ||
              0;

            const isRedundantDescription =
              complaint.description &&
              complaint.description.trim().toLowerCase() === complaint.title?.trim().toLowerCase();

            return (
              <div
                key={complaint._id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm hover:border-blue-300 transition-all flex flex-col justify-between"
              >
                {/* Top Row: Badges and View Details button */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(complaint.status)}
                    {getPriorityBadge(complaint.priority)}
                    <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200">
                      {complaintCode}
                    </span>
                  </div>

                  <button
                    onClick={() =>
                      navigate(ROUTES.STAFF_COMPLAINT_DETAIL.replace(':id', complaint._id))
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Details</span>
                  </button>
                </div>

                {/* Complaint Title & Description */}
                <div className="mt-3">
                  <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                    {complaint.title}
                  </h3>
                  {!isRedundantDescription && complaint.description && (
                    <p className="text-xs sm:text-sm text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {complaint.description}
                    </p>
                  )}
                </div>

                {/* Footer Metadata */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Submitted {formatDate(complaint.createdAt)}
                    </span>
                    {complaint.resolvedAt && (
                      <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Resolved {formatDate(complaint.resolvedAt)}
                      </span>
                    )}
                    {proofCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200/70 px-2 py-0.5 rounded-md">
                        <Camera className="w-3 h-3 text-blue-500" />
                        {proofCount} Proof Photo{proofCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {complaint.departmentId && (
                    <span className="text-[11px] text-slate-400">
                      Dept:{' '}
                      <span className="text-slate-600 font-medium">
                        {typeof complaint.departmentId === 'object'
                          ? (complaint.departmentId as any).name
                          : 'Assigned'}
                      </span>
                    </span>
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

export default CompletedWorkPage;
