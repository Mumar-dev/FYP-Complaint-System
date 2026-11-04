import React, { useState } from 'react';
import Card from '@components/Common/Card';
import Button from '@components/Common/Button';
import {
  Clock,
  CheckCircle,
  Award
} from 'lucide-react';
import {
  useGetAttendanceCorrectionsQuery,
  useReviewAttendanceCorrectionMutation,
  useGetAllLeaveRequestsQuery,
  useReviewLeaveRequestMutation,
  useSubmitEvaluationMutation
} from '@/features/hr/hr.api';
import toast from 'react-hot-toast';

const SupervisorApprovalsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leaves' | 'corrections' | 'evaluations'>('leaves');

  // Leaves
  const { data: leavesData, refetch: refetchLeaves } = useGetAllLeaveRequestsQuery({ status: 'PENDING' });
  const [reviewLeave, { isLoading: reviewingLeave }] = useReviewLeaveRequestMutation();

  // Attendance Corrections
  const { data: correctionsData, refetch: refetchCorrections } = useGetAttendanceCorrectionsQuery();
  const [reviewCorrection, { isLoading: reviewingCorrection }] = useReviewAttendanceCorrectionMutation();

  // Performance evaluations
  const [submitEvaluation, { isLoading: submittingEval }] = useSubmitEvaluationMutation();

  // Modal State for Evaluation
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [evalEmployeeId, setEvalEmployeeId] = useState('');
  const [qualityScore, setQualityScore] = useState(4.5);
  const [punctualityScore, setPunctualityScore] = useState(4.0);
  const [evalComments, setEvalComments] = useState('');

  const handleLeaveDecision = async (id: string, action: 'approved' | 'rejected') => {
    try {
      await reviewLeave({ id, action }).unwrap();
      toast.success(`Leave request ${action} successfully`);
      refetchLeaves();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Action failed');
    }
  };

  const handleCorrectionDecision = async (id: string, action: 'approved' | 'rejected') => {
    try {
      await reviewCorrection({ id, action }).unwrap();
      toast.success(`Attendance correction ${action}`);
      refetchCorrections();
    } catch (err: any) {
      toast.error(err?.data?.message || 'Action failed');
    }
  };

  const handleEvaluationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalComments) {
      toast.error('Please enter evaluator comments');
      return;
    }
    try {
      await submitEvaluation({
        employeeId: evalEmployeeId,
        reviewPeriodStart: '2026-07-01',
        reviewPeriodEnd: '2026-12-31',
        qualityOfWork: Number(qualityScore),
        punctuality: Number(punctualityScore),
        evaluatorComments: evalComments,
      }).unwrap();
      toast.success('Performance evaluation recorded and published');
      setShowEvalModal(false);
      setEvalComments('');
    } catch (err: any) {
      toast.error(err?.data?.message || 'Evaluation failed');
    }
  };

  const pendingLeaves = leavesData?.data || [];
  const corrections = correctionsData?.data || [];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Supervisor Approvals & Oversight Hub</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review department leave applications, attendance adjustments, and conduct formal 6-factor appraisals.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 space-x-8">
        <button
          onClick={() => setActiveTab('leaves')}
          className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'leaves'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Leave Requests ({pendingLeaves.length})
        </button>
        <button
          onClick={() => setActiveTab('corrections')}
          className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'corrections'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          Attendance Corrections ({corrections.length})
        </button>
        <button
          onClick={() => setActiveTab('evaluations')}
          className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
            activeTab === 'evaluations'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Award className="w-4 h-4" />
          Conduct Performance Appraisals
        </button>
      </div>

      {/* LEAVES TAB */}
      {activeTab === 'leaves' && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Pending Leave Applications</h3>
          {pendingLeaves.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700">All leave requests reviewed</p>
              <p className="text-xs text-gray-400 mt-1">There are no pending applications from department staff.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingLeaves.map((req) => (
                <div key={req._id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 text-sm">{req.employee?.name || 'Staff Member'}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-semibold">
                        {req.leaveType?.name || 'Leave'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Period: {req.startDate} to {req.endDate} ({req.totalDays || 1} day{req.totalDays > 1 ? 's' : ''})
                    </p>
                    <p className="text-xs text-gray-700 mt-2 bg-white p-2 rounded border border-gray-200 italic">
                      "{req.reason}"
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLeaveDecision(req._id, 'rejected')}
                      className="border-red-600 text-red-600 hover:bg-red-50"
                      isLoading={reviewingLeave}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleLeaveDecision(req._id, 'approved')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      isLoading={reviewingLeave}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* CORRECTIONS TAB */}
      {activeTab === 'corrections' && (
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Pending Attendance Adjustments</h3>
          {corrections.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <CheckCircle className="w-12 h-12 text-blue-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700">No attendance adjustments pending</p>
            </div>
          ) : (
            <div className="space-y-4">
              {corrections.map((corr: any) => (
                <div key={corr._id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="font-bold text-gray-900 text-sm">{corr.employee?.name || 'Staff Member'}</span>
                    <p className="text-xs text-gray-500 mt-1">Reason: {corr.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCorrectionDecision(corr._id, 'rejected')}
                      isLoading={reviewingCorrection}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleCorrectionDecision(corr._id, 'approved')}
                      isLoading={reviewingCorrection}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* EVALUATIONS TAB */}
      {activeTab === 'evaluations' && (
        <Card className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Conduct 6-Factor Performance Appraisal</h3>
              <p className="text-xs text-gray-500">Record quarterly scores based on SLA compliance and resident feedback.</p>
            </div>
            <Button variant="primary" onClick={() => setShowEvalModal(true)}>
              New Evaluation
            </Button>
          </div>

          <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-gray-600 space-y-1">
            <p className="font-bold text-blue-900">Official Society CMS 6-Factor Formula Weighting:</p>
            <p>• Resolution Quality: 25% | Timeliness: 20% | Resident Satisfaction: 20%</p>
            <p>• Attendance Punctuality: 15% | Supervisor Written Feedback: 10% | Workload Complexity: 10%</p>
          </div>
        </Card>
      )}

      {/* MODAL: NEW EVALUATION */}
      {showEvalModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Conduct Staff Performance Appraisal</h3>
            <form onSubmit={handleEvaluationSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Employee User ID</label>
                <input
                  type="text"
                  placeholder="24-character Mongo ID or Employee ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  value={evalEmployeeId}
                  onChange={(e) => setEvalEmployeeId(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Quality of Work (1.0 - 5.0)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    value={qualityScore}
                    onChange={(e) => setQualityScore(Number(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Punctuality Score (1.0 - 5.0)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    max="5.0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    value={punctualityScore}
                    onChange={(e) => setPunctualityScore(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Written Feedback / Evaluation Remarks</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  rows={4}
                  placeholder="Summarize technical precision, dedication during emergency shifts, and resident interactions..."
                  value={evalComments}
                  onChange={(e) => setEvalComments(e.target.value)}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setShowEvalModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={submittingEval}>
                  Publish Evaluation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupervisorApprovalsPage;
