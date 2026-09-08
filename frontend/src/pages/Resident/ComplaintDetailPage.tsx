import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Clock, AlertTriangle, CheckCircle, Check, FileText, Plus, X, Star, Phone, UserRound, Flag, Eye, MessageSquareQuote } from 'lucide-react';
import { Button, Card } from '@components/Common';
import { ROUTES } from '@constants/index';
// @ts-ignore
import { useGetComplaintDetailsQuery } from '@/features/complaint/complaint.api';
import ComplaintTimeline from '../../components/complaints/ComplaintTimeline';
import StaffActionPanel from '../../components/complaints/StaffActionPanel';
import ComplaintFeedbackCard from '../../components/complaints/ComplaintFeedbackCard';
import { useAuth } from '@hooks/useAuth';
import { getSLAStatus } from '@/utils/sla';
import { format } from 'date-fns';

const ComplaintDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const feedbackSectionRef = useRef<HTMLDivElement>(null);

  const { data: detailsData, isLoading: isDetailsLoading, isError: isDetailsError, refetch } = useGetComplaintDetailsQuery(id as string, { skip: !id });
  
  const complaint = detailsData?.data;

  const getPriorityConfig = (priority: string = '') => {
    switch(priority.toLowerCase()) {
      case 'critical': return { color: 'text-rose-700', bg: 'bg-white', badgeBg: 'bg-rose-50 text-rose-700 border-rose-200', icon: <Flag className="w-4 h-4 text-rose-600 fill-rose-100" />, label: 'CRITICAL' };
      case 'high': return { color: 'text-amber-700', bg: 'bg-white', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Flag className="w-4 h-4 text-amber-600 fill-amber-100" />, label: 'HIGH' };
      case 'medium': return { color: 'text-blue-700', bg: 'bg-white', badgeBg: 'bg-blue-50 text-blue-700 border-blue-200', icon: <Flag className="w-4 h-4 text-blue-600 fill-blue-100" />, label: 'MEDIUM' };
      case 'low': 
      default: return { color: 'text-slate-700', bg: 'bg-white', badgeBg: 'bg-slate-50 text-slate-700 border-slate-200', icon: <Flag className="w-4 h-4 text-slate-500 fill-slate-100" />, label: 'LOW' };
    }
  };

  const priorityConfig = getPriorityConfig(complaint?.priority);

  const getSLAConfig = (complaint: any) => {
    if (!complaint?.slaDeadline) return null;
    const status = getSLAStatus(complaint);
    if (status.type === 'neutral') return null;

    if (status.type === 'danger') return { label: 'OVERDUE', color: 'text-red-700', bg: 'bg-white', badgeBg: 'bg-red-50 text-red-700 border-red-200' };
    if (status.type === 'warning') return { label: 'DUE SOON', color: 'text-amber-700', bg: 'bg-white', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'ON TRACK', color: 'text-emerald-700', bg: 'bg-white', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  const slaConfig = getSLAConfig(complaint);
  const assignedStaff = complaint?.assignedStaffId;
  const assignedStaffId = typeof assignedStaff === 'string' ? assignedStaff : (assignedStaff as any)?._id;
  const isAssignedStaff = user?.role === 'staff' && assignedStaffId === user?._id;

  // Status mapping for pipeline:
  // Step 1: Submitted ('submitted', 'open', 'pending', 'pending_assignment')
  // Step 2: Assigned ('assigned')
  // Step 3: In Progress ('in_progress', 'in-progress', 'under_verification')
  // Step 4: Resolved ('resolved', 'closed', 'completed')
  const getTimelineStepStatus = (stepId: number, currentStatus: string) => {
    const raw = (currentStatus || 'submitted').toLowerCase();
    
    let stepRank = 1;
    if (['assigned'].includes(raw)) stepRank = 2;
    else if (['in_progress', 'in-progress', 'under_verification'].includes(raw)) stepRank = 3;
    else if (['resolved', 'closed', 'completed'].includes(raw)) stepRank = 4;

    // When complaint is resolved or closed, step 4 is fully completed
    if (stepId === 4 && (raw === 'resolved' || raw === 'closed' || raw === 'completed')) {
      return 'completed';
    }

    if (stepRank > stepId) return 'completed';
    if (stepRank === stepId) return 'current';
    return 'pending';
  };

  const isCompleted = ['resolved', 'closed', 'completed'].includes(complaint?.status?.toLowerCase() ?? '');

  useEffect(() => {
    if (location.state?.feedbackSuccess && feedbackSectionRef.current) {
       setTimeout(() => {
         feedbackSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
         // Clear location state securely
         window.history.replaceState({}, document.title);
       }, 500);
    }
  }, [location.state?.feedbackSuccess]);

  if (isDetailsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
        <p className="text-slate-500 font-semibold tracking-wider text-xs uppercase">Loading Details...</p>
      </div>
    );
  }

  if (isDetailsError || !complaint) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-8">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <h3 className="text-xl font-bold text-slate-800 mb-2">Complaint not found</h3>
        <p className="text-sm text-slate-500 mb-6">Unable to retrieve the requested record.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pt-2 sm:pt-4 pb-12 animate-in fade-in duration-300">
      {/* Visual Header */}
      <div className="flex items-center justify-between pb-1 pl-1 sm:pl-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <span>Complaint Details</span>
            <span className={`px-3 py-0.5 rounded-full text-xs font-bold border shadow-xs ${
              ['resolved', 'closed', 'completed'].includes(complaint.status?.toLowerCase())
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              {['pending', 'submitted', 'pending_assignment'].includes(complaint.status as string) ? 'Waiting for Team' : complaint.status?.replace(/_/g, ' ')}
            </span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN (70%) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Title & Meta Card */}
          <Card className="p-6 sm:p-7 border border-slate-200/90 shadow-sm rounded-2xl bg-white">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 leading-tight">
              {complaint.title || 'Untitled Report'}
            </h2>
            <div className="text-slate-500 text-xs sm:text-sm font-medium flex flex-wrap items-center gap-2 mb-6">
               <span className="font-semibold text-slate-700">Ticket ID: <span className="font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">#{(complaint as any).complaintId || complaint._id?.slice(-6).toUpperCase()}</span></span>
               <span className="opacity-40 text-slate-300">•</span>
               <span>Submitted on {new Date(complaint.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
               <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Category</p>
                  <p className="font-semibold text-slate-800 text-sm">{complaint.category || 'General Issue'}</p>
               </div>
               <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department</p>
                  <p className="font-semibold text-slate-800 text-sm truncate">{complaint.departmentId?.name || 'Waiting for assignment'}</p>
               </div>
               <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Reported At</p>
                  <p className="font-semibold text-slate-800 text-sm">{new Date(complaint.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
               </div>
            </div>
          </Card>

          {/* Details & Photos Card */}
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center gap-2">
               <FileText className="w-3.5 h-3.5 text-blue-600" />
               Details & Photos
             </h3>
             <Card className="p-6 sm:p-7 border border-slate-200/90 shadow-sm rounded-2xl bg-white space-y-6">
               <div>
                 <p className="text-slate-700 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                   {complaint.description || 'No detailed description provided.'}
                 </p>
               </div>

               {/* Responsive Image Grid with subtle zoom & enlarged modal */}
               {complaint.attachedImages && complaint.attachedImages.length > 0 && (
                 <div className="border-t border-slate-100 pt-5">
                   <p className="text-xs font-semibold text-slate-700 mb-3">Attached Photos</p>
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                     {complaint.attachedImages.map((img: string, idx: number) => (
                       <div 
                         key={idx} 
                         onClick={() => setPreviewImage(img)}
                         className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-200/80 cursor-pointer group relative bg-slate-100 shadow-2xs hover:shadow-md transition-all"
                       >
                         <img 
                           src={img} 
                           alt={`Evidence photo ${idx + 1}`} 
                           className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                         />
                         <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/30 transition-colors flex items-center justify-center">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-slate-800 px-2.5 py-1 rounded-md text-xs font-semibold shadow-sm flex items-center gap-1.5">
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </span>
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
             </Card>
          </div>

          {/* Reviews & Feedback Section */}
          <div ref={feedbackSectionRef}>
            <ComplaintFeedbackCard
              feedback={{
                rating: complaint.rating,
                feedbackComment: complaint.feedbackComment,
                feedbackSubmittedAt: complaint.feedbackSubmittedAt,
                feedbackSubmitted: complaint.feedbackSubmitted,
              }}
              isResolved={isCompleted}
              onRateClick={() => navigate(ROUTES.RESIDENT_FEEDBACK.replace(':id', complaint._id))}
            />
          </div>

        </div>

        {/* RIGHT COLUMN (30%) */}
        <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-4 lg:self-start">
           
           {/* Priority Card */}
           <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs transition-all">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Priority</p>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${priorityConfig.badgeBg}`}>
                  {priorityConfig.icon}
                  <span>{priorityConfig.label}</span>
                </span>
              </div>
           </div>

           {/* Expected Fix By (SLA) */}
           {slaConfig && (
             <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs transition-all space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expected Fix By</p>
                <p className="text-sm font-bold text-slate-800">
                  {new Date(complaint.slaDeadline as string).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
                <div>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide border shadow-2xs ${slaConfig.badgeBg}`}>
                    {slaConfig.label}
                  </span>
                </div>
             </div>
           )}

           {/* Assigned To Card */}
           <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs transition-all space-y-3">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned To</p>
             {assignedStaff && typeof assignedStaff !== 'string' ? (
               <div className="flex items-center gap-3.5">
                 {assignedStaff.profile?.profileImage ? (
                   <img
                     src={assignedStaff.profile.profileImage}
                     alt={assignedStaff.profile.fullName || 'Assigned team member'}
                     className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs flex-none"
                   />
                 ) : (
                   <div className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs flex-none">
                     <UserRound className="w-5 h-5" />
                   </div>
                 )}
                 <div className="min-w-0">
                   <p className="font-bold text-slate-900 text-sm truncate">
                     {assignedStaff.profile?.fullName || 'Assigned team member'}
                   </p>
                   {assignedStaff.profile?.phone ? (
                     <a href={`tel:${assignedStaff.profile.phone}`} className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">
                       <Phone className="w-3.5 h-3.5" />
                       {assignedStaff.profile.phone}
                     </a>
                   ) : (
                     <p className="mt-1 text-xs text-slate-400">Phone not available</p>
                   )}
                 </div>
               </div>
             ) : (
               <p className="text-xs text-slate-500 leading-relaxed">
                 Not assigned yet. We'll notify you as soon as a team member picks this up.
               </p>
             )}
           </div>
           
           {/* Staff Action Panel (if viewing as staff) */}
           <StaffActionPanel 
             complaintId={complaint._id} 
             currentStatus={complaint.status} 
             isAssignedStaff={isAssignedStaff} 
             onSuccess={() => refetch()} 
           />
           
           {/* Clean STATUS TRACKER Pipeline */}
           <div className="space-y-2">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Status Tracker</h3>
             <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
               <div className="space-y-5 relative before:absolute before:inset-0 before:ml-[1.15rem] before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-100">
                 
                 {[
                   { id: 1, title: 'Complaint Submitted', desc: 'We received your complaint.' },
                   { id: 2, title: 'Assigned', desc: 'A team member has been assigned.' },
                   { id: 3, title: 'In Progress', desc: 'The team is working on the fix.' },
                   { id: 4, title: 'Resolved', desc: 'The issue has been resolved.' }
                 ].map((step) => {
                   const stepState = getTimelineStepStatus(step.id, complaint.status);
                   const isStepDone = stepState === 'completed';
                   const isStepCurrent = stepState === 'current';

                   return (
                     <div key={step.id} className="relative flex gap-4 items-start">
                       <div className="shrink-0 relative z-10 w-9 h-9 rounded-full flex items-center justify-center border-2 bg-white shadow-2xs transition-all">
                          {isStepDone && (
                            <div className="w-full h-full bg-blue-600 rounded-full flex items-center justify-center text-white">
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          )}
                          {isStepCurrent && (
                            <div className="w-full h-full bg-blue-50 border-2 border-blue-600 rounded-full flex items-center justify-center">
                              <span className="w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
                            </div>
                          )}
                          {!isStepDone && !isStepCurrent && (
                            <div className="w-full h-full bg-slate-50 border-2 border-slate-200 rounded-full flex items-center justify-center text-[11px] font-bold text-slate-400">
                              {step.id}
                            </div>
                          )}
                       </div>
                       <div className={`pt-1 transition-opacity ${stepState === 'pending' ? 'opacity-40' : 'opacity-100'}`}>
                         <h4 className={`text-xs sm:text-sm font-bold ${stepState === 'pending' ? 'text-slate-400' : 'text-slate-900'} tracking-tight`}>
                           {step.title}
                         </h4>
                         <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                           {step.desc}
                         </p>
                       </div>
                     </div>
                   );
                 })}

               </div>
             </div>
           </div>

           {/* Updates Log */}
           <div className="space-y-2">
             <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Updates</h3>
             <ComplaintTimeline complaintId={complaint._id} />
           </div>

        </div>

      </div>

      {/* Dynamic Image Overlay Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
             <img src={previewImage} alt="Expanded preview" className="w-auto h-auto max-h-[85vh] max-w-full rounded-2xl shadow-2xl border border-white/10" />
             <button title="Close" onClick={() => setPreviewImage(null)} className="absolute -top-4 -right-4 w-10 h-10 bg-white text-slate-800 rounded-full shadow-lg flex items-center justify-center hover:bg-slate-100 transition-all font-bold">
               <X className="w-5 h-5"/>
             </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ComplaintDetailPage;
