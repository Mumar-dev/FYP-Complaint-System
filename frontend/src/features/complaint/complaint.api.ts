import { api } from '../../services/api';
import { 
  ComplaintResponse, 
  CreateComplaintDto, 
  GetComplaintsResponse,
  GetComplaintActivityResponse,
  UpdateComplaintStatusDto,
  AssignComplaintDto,
  GetStaffResponse,
  SubmitFeedbackDto
} from './complaint.types';

export const complaintApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getComplaints: builder.query<GetComplaintsResponse, void>({
      query: () => ({
        url: '/complaints',
        method: 'GET',
      }),
      providesTags: ['Complaint'],
    }),
    getComplaintDetails: builder.query<ComplaintResponse, string>({
      query: (id) => ({
        url: `/complaints/${id}`,
        method: 'GET',
      }),
      providesTags: ['Complaint'],
    }),
    getStaffDashboard: builder.query<any, void>({
      query: () => ({
        url: '/staff/dashboard',
        method: 'GET',
      }),
      providesTags: ['Complaint'],
    }),
    getComplaintActivity: builder.query<GetComplaintActivityResponse, string>({
      query: (id) => ({
        url: `/complaints/${id}/activity`,
        method: 'GET',
      }),
      providesTags: ['Complaint'],
    }),
    createComplaint: builder.mutation<ComplaintResponse, CreateComplaintDto | FormData>({
      query: (body) => ({
        url: '/complaints',
        method: 'POST',
        data: body,
      }),
      invalidatesTags: ['Complaint', 'Notification'],
    }),
    checkDuplicateComplaint: builder.mutation<{ success: boolean; data: { duplicates: any[] } }, {
      title?: string;
      description: string;
      locationType?: string;
      address?: string;
      lat?: number;
      lng?: number;
    }>({
      query: (body) => ({
        url: '/complaints/check-duplicate',
        method: 'POST',
        data: body,
      }),
    }),
    updateComplaintStatus: builder.mutation<ComplaintResponse, UpdateComplaintStatusDto>({
      query: ({ id, status, resolutionRemarks, notes, reason }: any) => ({
        url: `/complaints/${id}/status`,
        method: 'PATCH',
        data: { status, resolutionRemarks, notes, reason },
      }),
      invalidatesTags: ['Complaint'],
    }),
    assignComplaint: builder.mutation<ComplaintResponse, AssignComplaintDto>({
      query: ({ id, assignedStaffId, primaryStaffId, supportingStaffIds, reason }) => ({
        url: `/complaints/${id}/assign`,
        method: 'PATCH',
        data: {
          assignedStaffId: primaryStaffId || assignedStaffId,
          primaryStaffId: primaryStaffId || assignedStaffId,
          supportingStaffIds,
          reason,
        },
      }),
      invalidatesTags: ['Complaint'],
    }),
    getStaff: builder.query<GetStaffResponse, void>({
      query: () => ({
        url: '/users/staff',
        method: 'GET',
      }),
    }),
    submitComplaintFeedback: builder.mutation<ComplaintResponse, SubmitFeedbackDto>({
      query: ({ id, rating, comment }) => ({
        url: `/complaints/${id}/feedback`,
        method: 'POST',
        data: { rating, comment },
      }),
      invalidatesTags: ['Complaint'],
    }),

    submitResolutionEvidence: builder.mutation<
      any,
      { complaintId: string; formData: FormData }
    >({
      query: ({ complaintId, formData }) => ({
        url: `/evidence/${complaintId}`,
        method: 'POST',
        data: formData,
      }),
      invalidatesTags: ['Complaint'],
    }),

    // Complaint Transfer Workflow
    requestComplaintTransfer: builder.mutation<
      { success: boolean; message: string; data: any },
      { complaintId: string; targetDepartmentId: string; reason: string }
    >({
      query: ({ complaintId, targetDepartmentId, reason }) => ({
        url: `/complaints/${complaintId}/transfer-request`,
        method: 'POST',
        data: { targetDepartmentId, reason },
      }),
      invalidatesTags: ['Complaint'],
    }),

    getComplaintTransferStatus: builder.query<
      { success: boolean; data: any },
      string
    >({
      query: (complaintId) => ({
        url: `/complaints/${complaintId}/transfer-status`,
        method: 'GET',
      }),
      providesTags: ['Complaint'],
    }),

    getComplaintTransferRequests: builder.query<
      { success: boolean; data: any[] },
      { status?: string } | void
    >({
      query: (params) => ({
        url: '/complaints/transfer-requests/all',
        method: 'GET',
        params: params || {},
      }),
      providesTags: ['Complaint'],
    }),

    approveComplaintTransfer: builder.mutation<
      { success: boolean; message: string; data: any },
      { id: string; reviewRemarks?: string }
    >({
      query: ({ id, reviewRemarks }) => ({
        url: `/complaints/transfer-requests/${id}/approve`,
        method: 'PATCH',
        data: { reviewRemarks },
      }),
      invalidatesTags: ['Complaint'],
    }),

    rejectComplaintTransfer: builder.mutation<
      { success: boolean; message: string; data: any },
      { id: string; reviewRemarks?: string }
    >({
      query: ({ id, reviewRemarks }) => ({
        url: `/complaints/transfer-requests/${id}/reject`,
        method: 'PATCH',
        data: { reviewRemarks },
      }),
      invalidatesTags: ['Complaint'],
    }),

    // Resolution Verification Endpoints
    getPendingResolutionVerifications: builder.query<{ success: boolean; data: any[] }, void>({
      query: () => ({
        url: '/evidence/pending-verifications',
        method: 'GET',
      }),
      providesTags: ['Complaint'],
    }),

    getComplaintEvidence: builder.query<{ success: boolean; data: any[] }, string>({
      query: (complaintId) => ({
        url: `/evidence/${complaintId}`,
        method: 'GET',
      }),
      providesTags: ['Complaint'],
    }),

    reviewResolutionEvidence: builder.mutation<
      { success: boolean; message: string; data: any },
      { evidenceId: string; action: 'approved' | 'rejected'; rejectionReason?: string; remarks?: string }
    >({
      query: ({ evidenceId, action, rejectionReason, remarks }) => ({
        url: `/evidence/${evidenceId}/review`,
        method: 'PATCH',
        data: { action, rejectionReason: rejectionReason || remarks, remarks },
      }),
      invalidatesTags: ['Complaint'],
    }),
  }),
});

export const { 
  useGetComplaintsQuery, 
  useCreateComplaintMutation, 
  useCheckDuplicateComplaintMutation,
  useUpdateComplaintStatusMutation,
  useGetComplaintDetailsQuery,
  useGetComplaintActivityQuery,
  useAssignComplaintMutation,
  useGetStaffQuery,
  useSubmitComplaintFeedbackMutation,
  useGetStaffDashboardQuery,
  useSubmitResolutionEvidenceMutation,
  useRequestComplaintTransferMutation,
  useGetComplaintTransferStatusQuery,
  useGetComplaintTransferRequestsQuery,
  useApproveComplaintTransferMutation,
  useRejectComplaintTransferMutation,
  useGetPendingResolutionVerificationsQuery,
  useGetComplaintEvidenceQuery,
  useReviewResolutionEvidenceMutation,
} = complaintApi;
