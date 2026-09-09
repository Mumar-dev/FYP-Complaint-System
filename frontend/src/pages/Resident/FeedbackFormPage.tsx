import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Star, Loader2 } from 'lucide-react';
import { ROUTES } from '@constants/index';
import { useSubmitComplaintFeedbackMutation, useGetComplaintDetailsQuery } from '@/features/complaint/complaint.api';
import toast from 'react-hot-toast';

const RATING_LABELS: Record<number, string> = {
  1: '1 – Very Dissatisfied',
  2: '2 – Dissatisfied',
  3: '3 – Neutral',
  4: '4 – Satisfied',
  5: '5 – Very Satisfied',
};

export const FeedbackFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState('');

  const { data: detailsData } = useGetComplaintDetailsQuery(id as string, { skip: !id });
  const complaint = detailsData?.data;

  const [submitFeedback, { isLoading }] = useSubmitComplaintFeedbackMutation();

  // Always prefer complaint._id if available, falling back to id from route params
  const effectiveComplaintId = complaint?._id || (id as string);

  // Formatted complaint display ID helper
  const formattedComplaintId =
    complaint?.complaintId ||
    (id && id.length >= 6 ? `#${id.slice(-6).toUpperCase()}` : id || 'CMP-CASE');

  const complaintTitle = complaint?.title || 'Resolved Complaint';

  const displayedRating = hoveredRating || rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('Please select a rating before submitting.');
      return;
    }

    if (complaint?.feedbackSubmitted) {
      toast.error('Feedback was already submitted for this case.');
      return;
    }

    try {
      await submitFeedback({
        id: effectiveComplaintId,
        rating,
        comment: comment.trim()
      }).unwrap();

      toast.success('Thank you! Your feedback has been recorded.');
      navigate(ROUTES.RESIDENT_COMPLAINT_DETAIL.replace(':id', effectiveComplaintId), {
        state: { feedbackSuccess: true },
      });
    } catch (error: any) {
      const errMsg = error?.data?.message || error?.message || 'Failed to submit feedback.';
      toast.error(errMsg);
    }
  };

  return (
    <div className="max-w-2xl sm:max-w-3xl w-full mx-auto py-8 px-4 animate-in fade-in duration-200">
      {/* 1. Header (No back arrow) */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Rate Your Experience</h1>
        <p className="text-sm text-slate-500 mt-1">
          Share your feedback on how your complaint was resolved.
        </p>
      </div>

      {/* 2. Unified Feedback Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Metadata Strip */}
          <div className="bg-slate-50 border border-slate-200/70 rounded-xl px-4 py-3 flex items-center justify-between text-xs gap-3">
            <span className="font-medium text-slate-700 truncate" title={complaintTitle}>
              {complaintTitle}
            </span>
            <span className="font-mono text-slate-600 bg-white border border-slate-200 px-2.5 py-1 rounded-md text-[11px] shrink-0 font-semibold shadow-2xs">
              {formattedComplaintId}
            </span>
          </div>

          {/* Already Submitted Alert (if applicable) */}
          {complaint?.feedbackSubmitted && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <p className="text-xs text-amber-800 font-medium">
                Feedback has already been submitted for this complaint.
              </p>
            </div>
          )}

          {/* Interactive Star Rating (Centered & Compact) */}
          <div className="text-center space-y-2 py-2">
            <label className="block text-sm font-semibold text-slate-800">
              How satisfied are you with the resolution?
            </label>

            {/* Stars Row */}
            <div className="flex items-center justify-center gap-2.5 py-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isLit = star <= displayedRating;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    onClick={() => setRating(star)}
                    disabled={complaint?.feedbackSubmitted || isLoading}
                    className="p-1 rounded-lg transition-transform duration-150 hover:scale-110 active:scale-95 focus:outline-none cursor-pointer disabled:cursor-not-allowed"
                    aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}
                  >
                    <Star
                      className={`w-10 h-10 transition-colors ${
                        isLit
                          ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                          : 'text-slate-300 hover:text-slate-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Subtle Rating Description Label */}
            <p className="text-xs font-medium text-slate-500 h-4 transition-all">
              {displayedRating > 0 ? RATING_LABELS[displayedRating] : ''}
            </p>
          </div>

          {/* Comments Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="comments" className="text-xs font-semibold text-slate-700">
                Additional Comments <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <span className="text-[11px] text-slate-400 font-medium tabular-nums">
                {comment.length}/500
              </span>
            </div>
            <textarea
              id="comments"
              rows={3}
              maxLength={500}
              value={comment}
              disabled={complaint?.feedbackSubmitted || isLoading}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts about the resolution, timeliness, or staff behavior..."
              className="w-full rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-xs sm:text-sm p-3 text-slate-800 placeholder:text-slate-400 outline-none transition-all resize-none shadow-2xs disabled:bg-slate-50 disabled:text-slate-400"
            />
          </div>

          {/* Clean Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => navigate(-1)}
              className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rating === 0 || isLoading || complaint?.feedbackSubmitted}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Feedback</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackFormPage;
