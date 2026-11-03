import React, { useState } from 'react';
import Card from '@components/Common/Card';
import { ShieldAlert, Calendar, CheckCircle2, AlertTriangle, FileText, Loader2, User, Image as ImageIcon, X, ExternalLink } from 'lucide-react';
import { useGetFormalWarningsQuery } from '@/features/hr/hr.api';

export const StaffWarningsPage: React.FC = () => {
  const { data: warningsResponse, isLoading, isError, refetch } = useGetFormalWarningsQuery({ viewMode: 'self' });
  const warnings = Array.isArray(warningsResponse?.data) ? warningsResponse.data : [];
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Service Record & Official Notices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Official formal notices, performance reprimands, and disciplinary letters issued to your profile.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            warnings.length > 0 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {warnings.length === 0 ? 'Clean Record' : `${warnings.length} Active Notice${warnings.length > 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-12 flex justify-center items-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
        </Card>
      ) : warnings.length === 0 ? (
        <Card className="p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-gray-900">No formal notices on your record.</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
            You maintain a clean disciplinary record with full adherence to department standards and operational SLAs.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {warnings.map((wrn: any) => {
            const issuerName = wrn.issuedBy?.profile?.fullName || wrn.issuedBy?.email || 'Department Management';
            const issueDate = new Date(wrn.issuedAt || wrn.createdAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            });

            const severityClass =
              wrn.severity === 'Final'
                ? 'bg-red-50 text-red-800 border-red-200'
                : wrn.severity === 'Written'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-blue-50 text-blue-800 border-blue-200';

            return (
              <Card key={wrn._id} className="p-6 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-500">{wrn.warningNumber}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${severityClass}`}>
                          {wrn.severity} Warning
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {wrn.category}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-gray-900 mt-1">{wrn.subject}</h3>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-xs text-slate-500 flex items-center sm:justify-end gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{issueDate}</span>
                    </p>
                    <p className="text-xs text-slate-700 font-semibold mt-1">
                      Issued by: {issuerName}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Details & Remarks</h4>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100 leading-relaxed whitespace-pre-line">
                      {wrn.details}
                    </p>
                  </div>

                  {wrn.evidenceUrl && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Supporting Evidence</h4>
                      <div className="inline-block">
                        <div
                          onClick={() => setPreviewImage(wrn.evidenceUrl)}
                          className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-50 w-32 h-24 flex items-center justify-center hover:border-blue-400 transition-all shadow-2xs"
                        >
                          <img
                            src={wrn.evidenceUrl}
                            alt="Warning Evidence"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <ExternalLink className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {wrn.actionRequired && (
                    <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs space-y-0.5">
                      <p className="font-bold text-amber-900">Required Corrective Action:</p>
                      <p className="text-amber-800">{wrn.actionRequired}</p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* EVIDENCE PREVIEW MODAL */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative bg-white rounded-2xl max-w-2xl w-full p-4 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-gray-900">Supporting Evidence</h3>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-3 max-h-[70vh] flex items-center justify-center overflow-auto rounded-lg bg-slate-900">
              <img
                src={previewImage}
                alt="Warning Evidence Full"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffWarningsPage;
