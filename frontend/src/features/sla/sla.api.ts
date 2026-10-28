import { api } from '../../services/api';

export interface SlaPolicy {
  _id: string;
  name: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  targetHours: number;
  warningThresholdPercent: number;
  isActive: boolean;
}

export interface EtaHistory {
  _id: string;
  complaintId: string;
  proposedBy: {
    _id: string;
    email: string;
    profile?: { fullName?: string };
  };
  proposedEta: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: {
    _id: string;
    email: string;
    profile?: { fullName?: string };
  };
  reviewRemarks?: string;
  createdAt: string;
}

export const slaApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSlaPolicies: builder.query<{ success: boolean; data: SlaPolicy[] }, void>({
      query: () => ({ url: '/sla/policies', method: 'GET' }),
      providesTags: ['SLA'],
    }),
    createSlaPolicy: builder.mutation<any, {
      name: string;
      category: string;
      priority: string;
      targetHours: number;
      warningThresholdPercent?: number;
    }>({
      query: (data) => ({ url: '/sla/policies', method: 'POST', data }),
      invalidatesTags: ['SLA'],
    }),
    updateSlaPolicy: builder.mutation<any, {
      id: string;
      name?: string;
      category?: string;
      priority?: string;
      targetHours?: number;
      warningThresholdPercent?: number;
      isActive?: boolean;
    }>({
      query: ({ id, ...data }) => ({
        url: `/sla/policies/${id}`,
        method: 'PUT',
        data,
      }),
      invalidatesTags: ['SLA'],
    }),
    deleteSlaPolicy: builder.mutation<any, string>({
      query: (id) => ({
        url: `/sla/policies/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['SLA'],
    }),
    getEtaHistory: builder.query<{ success: boolean; data: EtaHistory[] }, string>({
      query: (complaintId) => ({ url: `/sla/eta/history/${complaintId}`, method: 'GET' }),
      providesTags: ['SLA', 'Complaint'],
    }),
    reviewEtaChange: builder.mutation<any, { etaHistoryId: string; action: 'approved' | 'rejected'; reviewRemarks?: string }>({
      query: ({ etaHistoryId, ...data }) => ({
        url: `/sla/eta/${etaHistoryId}/review`,
        method: 'PATCH',
        data,
      }),
      invalidatesTags: ['Complaint', 'SLA'],
    }),
    reopenComplaint: builder.mutation<any, { id: string; reopenReason: string }>({
      query: ({ id, reopenReason }) => ({
        url: `/complaints/${id}/reopen`,
        method: 'POST',
        data: { reopenReason },
      }),
      invalidatesTags: ['Complaint'],
    }),
  }),
});

export const {
  useGetSlaPoliciesQuery,
  useCreateSlaPolicyMutation,
  useUpdateSlaPolicyMutation,
  useDeleteSlaPolicyMutation,
  useGetEtaHistoryQuery,
  useReviewEtaChangeMutation,
  useReopenComplaintMutation,
} = slaApi;
