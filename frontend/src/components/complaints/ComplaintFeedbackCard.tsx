import React from 'react';
import { Star, Check } from 'lucide-react';
import { format } from 'date-fns';

export interface ComplaintFeedbackData {
  rating?: number;
  feedbackComment?: string;
  feedbackSubmittedAt?: string | Date;
  feedbackSubmitted?: boolean;
}

interface ComplaintFeedbackCardProps {
  feedback?: ComplaintFeedbackData | null;
  /** Whether the complaint is resolved or closed */
  isResolved?: boolean;
  /** If provided, renders an action button (e.g. for resident to submit feedback) */
  onRateClick?: () => void;
  /** Read-only mode hides the rating prompt action button */
  readOnly?: boolean;
}

export const ComplaintFeedbackCard: React.FC<ComplaintFeedbackCardProps> = ({
  feedback,
  isResolved = false,
  onRateClick,
  readOnly = false,
}) => {
  const isSubmitted = Boolean(feedback?.feedbackSubmitted || feedback?.rating);
  const rating = feedback?.rating || 0;
  const comment = feedback?.feedbackComment;
  const submittedAt = feedback?.feedbackSubmittedAt;

  // If complaint is not resolved, or if readOnly and no feedback exists and not resolved, hide
  if (!isResolved && !isSubmitted) {
    return null;
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Star className="w-4 h-4 fill-blue-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Reviews & Feedback</h3>
            <p className="text-xs text-slate-500">Resident experience and service evaluation</p>
          </div>
        </div>

        {isSubmitted && (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
            <Check className="w-3 h-3 stroke-[3]" />
            Submitted
          </span>
        )}
      </div>

      {/* Case 1: Feedback has been submitted */}
      {isSubmitted ? (
        <div className="pt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((starIdx) => {
                  const isFilled = rating >= starIdx;
                  return (
                    <Star
                      key={starIdx}
                      className={`w-5 h-5 ${
                        isFilled
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-200 fill-slate-100'
                      }`}
                    />
                  );
                })}
              </div>
              <span className="text-base font-bold text-slate-900 tabular-nums">
                {rating ? `${rating}.0` : '—'}{' '}
                <span className="text-xs font-medium text-slate-400">/ 5</span>
              </span>
            </div>

            {submittedAt && (
              <span className="text-xs text-slate-400 tabular-nums">
                {format(new Date(submittedAt), 'MMM dd, yyyy · hh:mm a')}
              </span>
            )}
          </div>

          {/* Comment text */}
          {comment ? (
            <div className="bg-slate-50/70 border border-slate-100 rounded-lg p-4 text-sm text-slate-700 leading-relaxed">
              "{comment}"
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No written comment provided with this rating.</p>
          )}
        </div>
      ) : isResolved ? (
        /* Case 2: Resolved but no feedback yet */
        <div className="pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">
              {readOnly ? 'No resident feedback submitted yet' : 'Your issue has been resolved'}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {readOnly
                ? 'The resident has not submitted a rating or review for this resolved case.'
                : 'How was your experience with the resolution team? Please take a moment to leave your rating.'}
            </p>
          </div>

          {!readOnly && onRateClick && (
            <button
              type="button"
              onClick={onRateClick}
              className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-lg whitespace-nowrap shadow-xs shrink-0 cursor-pointer transition-colors"
            >
              Rate & Give Feedback
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default ComplaintFeedbackCard;
