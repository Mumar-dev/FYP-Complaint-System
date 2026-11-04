import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Star, 
  Search, 
  MoreVertical, 
  Eye, 
  X, 
  Clock, 
  Building2, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  Filter,
  Layers,
  Image as ImageIcon,
  Calendar,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { axiosInstance } from '../../services/customBaseQuery';
import { format } from 'date-fns';
import ComplaintFeedbackCard from '../../components/complaints/ComplaintFeedbackCard';

interface ResidentFeedbackItem {
  _id: string;
  complaintId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  department: string;
  resident: {
    name: string;
    email: string;
    phone: string;
  };
  rating: number;
  feedbackComment: string;
  feedbackSubmittedAt: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionTimeHours: number;
  resolutionTime: string;
  beforePhotos: string[];
  afterPhotos: string[];
  primaryImage: string | null;
}

const ResidentFeedbackPage: React.FC = () => {
  const [feedbackList, setFeedbackList] = useState<ResidentFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<string>('all');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ResidentFeedbackItem | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFeedback = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get('/dashboard/resident-feedback');
      if (res.data?.success && res.data?.data) {
        setFeedbackList(res.data.data.feedbackList || []);
      }
    } catch (error) {
      console.error('[ResidentFeedbackPage] Failed to fetch feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
  }, []);

  // Filter feedback
  const filteredList = useMemo(() => {
    return feedbackList.filter((item) => {
      // Rating filter
      if (ratingFilter === '5' && item.rating !== 5) return false;
      if (ratingFilter === '4' && item.rating !== 4) return false;
      if (ratingFilter === '3_below' && item.rating > 3) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = item.complaintId.toLowerCase().includes(q);
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesComment = item.feedbackComment?.toLowerCase().includes(q);
        const matchesDept = item.department.toLowerCase().includes(q);
        const matchesResident = item.resident.name.toLowerCase().includes(q);
        if (!matchesId && !matchesTitle && !matchesComment && !matchesDept && !matchesResident) {
          return false;
        }
      }

      return true;
    });
  }, [feedbackList, ratingFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s === 'resolved' || s === 'closed') {
      return (
        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-blue-200/60">
          <CheckCircle2 className="w-3 h-3 text-blue-600" />
          Resolved
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-slate-200/80">
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Page Header ── */}
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Resident Feedback</h1>
          <p className="text-sm text-slate-500 mt-1">
            Executive oversight of resident ratings, satisfaction feedback, and issue resolution metrics
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Search Input */}
          <div className="relative min-w-[240px] sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by complaint ID or feedback..."
              className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 rounded-xl pl-9 pr-3.5 py-2 text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Rating Dropdown / Filter */}
          <div className="relative">
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 cursor-pointer transition-colors shadow-2xs"
            >
              <option value="all">All Ratings</option>
              <option value="5">5★ Rating</option>
              <option value="4">4★ Rating</option>
              <option value="3_below">3★ & below</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        {/* Table Subheader */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Recorded Feedback</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 tabular-nums">
              {filteredList.length}
            </span>
          </div>

          {(ratingFilter !== 'all' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setRatingFilter('all');
                setSearchQuery('');
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Scrollable Table Container */}
        <div className="max-h-[460px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur-xs border-b border-slate-200/80">
              <tr>
                <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500">Image</th>
                <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500">Complaint</th>
                <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500">Department & Resident</th>
                <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500">Rating</th>
                <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500">Time to Solve</th>
                <th className="py-3 px-6 text-[11px] font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2" />
                    Loading resident feedback records...
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No resident feedback found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredList.map((item) => {
                  const thumbnail = item.primaryImage;
                  return (
                    <tr
                      key={item._id}
                      onClick={() => setSelectedItem(item)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Image Thumbnail */}
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        {thumbnail ? (
                          <div className="w-11 h-11 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                            <img
                              src={thumbnail}
                              alt="Thumbnail"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>
                        ) : (
                          <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-300 shrink-0">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )}
                      </td>

                      {/* Complaint ID & Title */}
                      <td className="py-3.5 px-6">
                        <div className="min-w-0 max-w-[200px]">
                          <span className="font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors tabular-nums">
                            {item.complaintId}
                          </span>
                          <p className="text-slate-600 font-medium truncate mt-0.5">{item.title}</p>
                        </div>
                      </td>

                      {/* Department & Resident */}
                      <td className="py-3.5 px-6">
                        <div className="min-w-0 max-w-[180px]">
                          <p className="font-semibold text-slate-800 truncate">{item.department}</p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">by {item.resident.name}</p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-6 whitespace-nowrap">{getStatusBadge(item.status)}</td>

                      {/* Rating */}
                      <td className="py-3.5 px-6 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                          <span className="font-bold text-slate-900 tabular-nums">{item.rating}.0</span>
                          <span className="text-[11px] text-slate-400 font-medium">/ 5</span>
                        </div>
                      </td>

                      {/* Time to Solve */}
                      <td className="py-3.5 px-6 whitespace-nowrap font-semibold text-slate-700 tabular-nums">
                        {item.resolutionTime}
                      </td>

                      {/* 3-Dot Actions Menu */}
                      <td className="py-3.5 px-6 text-right whitespace-nowrap">
                        <div
                          className="relative inline-block text-left"
                          onClick={(e) => e.stopPropagation()}
                          ref={openDropdownId === item._id ? dropdownRef : null}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDropdownId(openDropdownId === item._id ? null : item._id)
                            }
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openDropdownId === item._id && (
                            <div className="absolute right-0 z-20 mt-1 w-36 bg-white border border-slate-200/90 rounded-xl shadow-lg p-1 animate-in fade-in zoom-in-95 duration-100">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setOpenDropdownId(null);
                                }}
                                className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View Details
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Feedback & Resolution Detail Modal ── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-800 shadow-2xs tabular-nums">
                  {selectedItem.complaintId}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">{selectedItem.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getStatusBadge(selectedItem.status)}
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {format(new Date(selectedItem.createdAt), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Resolution Summary Strip */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Time to Solve</p>
                    <p className="text-sm font-bold text-slate-800 tabular-nums">{selectedItem.resolutionTime}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Department</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{selectedItem.department}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resident</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{selectedItem.resident.name}</p>
                  </div>
                </div>
              </div>

              {/* Detailed Description */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Complaint Description</h4>
                <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {selectedItem.description || 'No description provided.'}
                </div>
              </div>

              {/* Before & After Photos Side-by-Side */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Resolution Proof Photos</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Before / Submitted */}
                  <div className="border border-slate-200/80 rounded-xl p-3 bg-white">
                    <p className="text-xs font-bold text-slate-700 mb-2">Before (Submitted)</p>
                    {selectedItem.beforePhotos && selectedItem.beforePhotos.length > 0 ? (
                      <div
                        onClick={() => setLightboxImage(selectedItem.beforePhotos[0])}
                        className="aspect-video w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer relative group"
                      >
                        <img
                          src={selectedItem.beforePhotos[0]}
                          alt="Before Resolution"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                          View full size
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video w-full rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-xs font-medium">
                        No photo attached
                      </div>
                    )}
                  </div>

                  {/* After / Resolved */}
                  <div className="border border-slate-200/80 rounded-xl p-3 bg-white">
                    <p className="text-xs font-bold text-slate-700 mb-2">After (Resolved)</p>
                    {selectedItem.afterPhotos && selectedItem.afterPhotos.length > 0 ? (
                      <div
                        onClick={() => setLightboxImage(selectedItem.afterPhotos[0])}
                        className="aspect-video w-full rounded-lg overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer relative group"
                      >
                        <img
                          src={selectedItem.afterPhotos[0]}
                          alt="After Resolution"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                          View full size
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video w-full rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 text-xs font-medium">
                        No resolution photo
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Resident Feedback & Rating Card */}
              <ComplaintFeedbackCard
                feedback={{
                  rating: selectedItem.rating,
                  feedbackComment: selectedItem.feedbackComment,
                  feedbackSubmittedAt: selectedItem.feedbackSubmittedAt,
                  feedbackSubmitted: true,
                }}
                isResolved={true}
                readOnly={true}
              />
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image Lightbox Modal ── */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
        >
          <div className="relative max-w-3xl max-h-[90vh] bg-black rounded-xl overflow-hidden shadow-2xl">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/90 text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={lightboxImage} alt="Enlarged view" className="w-full h-full object-contain" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ResidentFeedbackPage;
