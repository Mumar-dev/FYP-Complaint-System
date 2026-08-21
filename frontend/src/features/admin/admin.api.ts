import { createApi } from '@reduxjs/toolkit/query/react';
import { customBaseQuery } from '../../services/customBaseQuery';

export const adminApi = createApi({
  reducerPath: 'adminApi',
  baseQuery: customBaseQuery(),
  tagTypes: ['User', 'Complaint', 'Department', 'DepartmentStaff', 'Staff'],
  endpoints: (builder) => ({
    // ── Analytics ──────────────────────────────────────────────────────────────
    getAnalytics: builder.query<any, { startDate?: string; endDate?: string } | void>({
      query: (params) => ({ url: '/admin/analytics', method: 'GET', params: params || {} }),
      providesTags: ['Complaint'],
    }),

    // ── User Approval ──────────────────────────────────────────────────────────
    getPendingUsers: builder.query<any, void>({
      query: () => ({ url: '/admin/pending-users', method: 'GET' }),
      providesTags: ['User'],
    }),
    approveUser: builder.mutation<any, string>({
      query: (id) => ({ url: `/admin/users/${id}/approve`, method: 'PATCH' }),
      invalidatesTags: ['User'],
    }),
    rejectUser: builder.mutation<any, { id: string; reason: string }>({
      query: ({ id, reason }) => ({ url: `/admin/users/${id}/reject`, method: 'PATCH', data: { reason } }),
      invalidatesTags: ['User'],
    }),

    // ── Departments ────────────────────────────────────────────────────────────
    getDepartments: builder.query<any, { approvedOnly?: boolean; activeOnly?: boolean } | void>({
      query: (params) => ({ url: '/departments', method: 'GET', params: params || {} }),
      providesTags: ['Department'],
    }),
    createDepartment: builder.mutation<any, { 
      name: string; 
      slaTargetHours: number; 
      code?: string;
      description?: string; 
      positions?: string[];
      categories?: string[];
      headId?: string;
    }>({
      query: (data) => ({ url: '/departments', method: 'POST', data }),
      invalidatesTags: ['Department'],
    }),
    getDepartmentById: builder.query<any, string>({
      query: (id) => ({ url: `/departments/${id}`, method: 'GET' }),
      providesTags: (_result, _error, id) => [{ type: 'Department', id }],
    }),
    updateDepartment: builder.mutation<any, { 
      id: string; 
      data: { 
        name?: string; 
        code?: string;
        slaTargetHours?: number; 
        description?: string; 
        positions?: string[];
        categories?: string[];
        headId?: string | null;
        isActive?: boolean;
        approvalStatus?: 'pending' | 'approved' | 'rejected';
        resubmitForApproval?: boolean;
        rejectionReason?: string;
      } 
    }>({
      query: ({ id, data }) => ({ url: `/departments/${id}`, method: 'PATCH', data }),
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Department', id }, 'Department'],
    }),
    deleteDepartment: builder.mutation<any, string>({
      query: (id) => ({ url: `/departments/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Department'],
    }),
    getDepartmentStaff: builder.query<any, string>({
      query: (id) => ({ url: `/departments/${id}/staff`, method: 'GET' }),
      providesTags: (_result, _error, id) => [{ type: 'DepartmentStaff', id }],
    }),
    assignHead: builder.mutation<any, { deptId: string; staffId: string }>({
      query: ({ deptId, staffId }) => ({
        url: `/departments/${deptId}/assign-head`,
        method: 'PATCH',
        data: { staffId },
      }),
      invalidatesTags: (_result, _error, { deptId }) => [
        { type: 'Department', id: deptId },
        'Department',
      ],
    }),
    getHeadDashboard: builder.query<any, void>({
      query: () => ({ url: '/departments/head/dashboard', method: 'GET' }),
      providesTags: ['Complaint', 'Department'],
    }),
    getStaffRecommendations: builder.query<any, string>({
      query: (deptId) => ({ url: `/departments/${deptId}/recommend-staff`, method: 'GET' }),
      providesTags: ['Staff', 'DepartmentStaff', 'Complaint'],
    }),

    // ── Staff ────────────────────────────────────────────────────────────────
    createStaff: builder.mutation<any, any>({
      query: (data) => ({ url: '/users', method: 'POST', data }),
      invalidatesTags: ['User', 'Staff'],
    }),
    getStaffMembers: builder.query<any, { unassigned?: boolean; departmentId?: string } | void>({
      query: (params) => ({ url: '/users/staff', method: 'GET', params: params || {} }),
      providesTags: ['Staff'],
    }),
    promoteStaff: builder.mutation<any, { userId: string; deptId: string }>({
      query: ({ userId }) => ({ url: `/users/${userId}/promote`, method: 'PATCH' }),
      invalidatesTags: (_result, _error, { deptId }) => [{ type: 'DepartmentStaff', id: deptId }, 'Staff', 'Department'],
    }),
    demoteStaff: builder.mutation<any, { userId: string; deptId: string }>({
      query: ({ userId }) => ({ url: `/users/${userId}/demote`, method: 'PATCH' }),
      invalidatesTags: (_result, _error, { deptId }) => [{ type: 'DepartmentStaff', id: deptId }, 'Staff', 'Department'],
    }),
    removeStaffFromDepartment: builder.mutation<any, { userId: string; deptId: string }>({
      query: ({ userId }) => ({ url: `/users/${userId}/remove-department`, method: 'PATCH' }),
      invalidatesTags: (_result, _error, { deptId }) => [
        { type: 'DepartmentStaff', id: deptId },
        { type: 'Department', id: deptId },
        'Staff',
        'Department',
      ],
    }),
    assignStaffToDepartment: builder.mutation<any, { userId?: string; userIds?: string[]; departmentId: string; currentDeptId: string; reason?: string }>({
      query: ({ userId, userIds, departmentId, reason }) => ({
        url: userId ? `/users/${userId}/assign-department` : '/users/assign-department',
        method: 'PATCH',
        data: { departmentId, userIds, reason },
      }),
      invalidatesTags: (_result, _error, { currentDeptId }) => [
        { type: 'DepartmentStaff', id: currentDeptId },
        'Staff',
        'Department',
      ],
    }),
    updateStaffRoleOrPosition: builder.mutation<any, { userId: string; deptId: string; data: any }>({
      query: ({ userId, data }) => ({
        url: `/users/${userId}`,
        method: 'PATCH',
        data,
      }),
      invalidatesTags: (_result, _error, { deptId }) => [
        { type: 'DepartmentStaff', id: deptId },
        'Staff',
      ],
    }),
  }),
});

export const {
  useGetAnalyticsQuery,
  useGetPendingUsersQuery,
  useApproveUserMutation,
  useRejectUserMutation,
  useGetDepartmentsQuery,
  useCreateDepartmentMutation,
  useGetDepartmentByIdQuery,
  useUpdateDepartmentMutation,
  useDeleteDepartmentMutation,
  useGetDepartmentStaffQuery,
  useAssignHeadMutation,
  useCreateStaffMutation,
  useGetStaffMembersQuery,
  usePromoteStaffMutation,
  useDemoteStaffMutation,
  useRemoveStaffFromDepartmentMutation,
  useAssignStaffToDepartmentMutation,
  useUpdateStaffRoleOrPositionMutation,
  useGetHeadDashboardQuery,
  useGetStaffRecommendationsQuery,
} = adminApi;
