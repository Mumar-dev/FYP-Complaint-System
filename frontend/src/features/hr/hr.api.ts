import { api } from '../../services/api';

export interface EmployeeProfile {
  _id: string;
  name: string;
  email: string;
  cnic: string;
  phoneNumber?: string;
  role: string;
  department?: {
    _id: string;
    name: string;
    code: string;
  };
  designation?: string;
  employmentStatus: 'ACTIVE' | 'PROBATION' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'RESIGNED';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'TEMPORARY';
  joiningDate?: string;
  salary?: number;
  emergencyContact?: {
    name: string;
    relationship: string;
    phoneNumber: string;
  };
  skills?: string[];
  leaveInfo?: {
    activeLeave: {
      id: string;
      startDate: string;
      endDate: string;
      totalDays: number;
      remainingDays: number;
      leaveType: string;
      reason: string;
    } | null;
    totalApprovedLeaveDays: number;
    recentLeaves: Array<{
      id: string;
      leaveType: string;
      startDate: string;
      endDate: string;
      days: number;
      reason?: string;
      status: string;
    }>;
  };
}

export interface Shift {
  _id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
  isActive: boolean;
}

export interface AttendanceRecord {
  _id: string;
  employee: {
    _id: string;
    name?: string;
    email: string;
    designation?: string;
  };
  date: string;
  shift?: {
    _id: string;
    name: string;
    startTime: string;
    endTime: string;
  };
  checkInTime?: string;
  checkOutTime?: string;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'ON_LEAVE';
  totalWorkHours?: number;
  workingHours?: number;
  isLate?: boolean;
  overtimeHours?: number;
  isCorrectionRequested?: boolean;
}

export interface LeaveRequest {
  _id: string;
  employee: {
    _id: string;
    name?: string;
    email: string;
    department?: { name: string };
  };
  leaveType: {
    _id: string;
    name: string;
    code: string;
  };
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewedBy?: { name: string };
  reviewRemarks?: string;
  appliedAt: string;
}

export interface PerformanceEvaluation {
  _id: string;
  employee: {
    _id: string;
    name?: string;
    email: string;
    designation?: string;
    department?: { name: string };
  };
  evaluator: {
    _id: string;
    name?: string;
  };
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  factors: {
    resolutionQuality: number;
    timeliness: number;
    residentSatisfaction: number;
    attendancePunctuality: number;
    supervisorFeedback: number;
    workloadComplexity: number;
  };
  overallScore: number;
  performanceGrade: 'OUTSTANDING' | 'EXCEEDS_EXPECTATIONS' | 'MEETS_EXPECTATIONS' | 'NEEDS_IMPROVEMENT' | 'UNSATISFACTORY';
  evaluatorComments: string;
  isPublished: boolean;
  appealStatus?: 'NONE' | 'PENDING' | 'UPHELD' | 'DISMISSED';
}

export interface PromotionRequest {
  _id: string;
  employee: {
    _id: string;
    name?: string;
    designation: string;
    department?: { name: string };
  };
  proposedDesignation: string;
  proposedSalary?: number;
  justification: string;
  effectiveDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  recommendedBy?: { name: string };
  reviewedBy?: { name: string };
  reviewNotes?: string;
}

export interface EmployeeTransfer {
  _id: string;
  employee: {
    _id: string;
    name?: string;
  };
  fromDepartment: {
    _id: string;
    name: string;
  };
  toDepartment: {
    _id: string;
    name: string;
  };
  transferReason: string;
  reassignComplaints: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
}

export interface DisciplinaryCase {
  _id: string;
  employee: {
    _id: string;
    name?: string;
    department?: { name: string };
  };
  title: string;
  description: string;
  severity: 'MINOR' | 'MODERATE' | 'MAJOR' | 'CRITICAL';
  actionTaken?: 'WARNING' | 'SUSPENSION' | 'DEMOTION' | 'TERMINATION' | 'EXONERATED';
  suspensionDays?: number;
  status: 'OPEN' | 'UNDER_INVESTIGATION' | 'CONCLUDED';
  createdAt: string;
}

export interface HRDashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  suspendedEmployees: number;
  presentToday: number;
  lateToday: number;
  pendingLeaves: number;
  pendingPromotions: number;
  pendingDisciplinary: number;
}

export const hrApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // ── HR Overview ────────────────────────────────────────────────────────────
    getHRDashboardStats: builder.query<{ success: boolean; data: HRDashboardStats }, void>({
      query: () => ({ url: '/hr-dashboard/overview', method: 'GET' }),
      providesTags: ['Employee', 'Attendance', 'Leave', 'Performance'],
    }),

    // ── Employees ──────────────────────────────────────────────────────────────
    getEmployees: builder.query<{ success: boolean; data: EmployeeProfile[] }, { department?: string; status?: string } | void>({
      query: (params) => ({ url: '/employees', method: 'GET', params: params || {} }),
      providesTags: ['Employee'],
    }),
    getEmployeeById: builder.query<{ success: boolean; data: EmployeeProfile }, string>({
      query: (id) => ({ url: `/employees/${id}`, method: 'GET' }),
      providesTags: ['Employee'],
    }),
    createEmployee: builder.mutation<any, Partial<EmployeeProfile>>({
      query: (data) => ({ url: '/employees', method: 'POST', data }),
      invalidatesTags: ['Employee'],
    }),
    updateEmployee: builder.mutation<{ success: boolean; data: EmployeeProfile }, { id: string; data: Partial<EmployeeProfile> }>({
      query: ({ id, data }) => ({ url: `/employees/${id}`, method: 'PATCH', data }),
      invalidatesTags: ['Employee'],
    }),
    updateEmploymentStatus: builder.mutation<any, { id: string; status: string; reason?: string }>({
      query: ({ id, status, reason }) => ({
        url: `/employees/${id}/status`,
        method: 'PATCH',
        data: { status, reason },
      }),
      invalidatesTags: ['Employee'],
    }),
    getEmployeeDocuments: builder.query<any, string>({
      query: (id) => ({ url: `/employees/${id}/documents`, method: 'GET' }),
      providesTags: ['Employee'],
    }),

    // ── Shifts ─────────────────────────────────────────────────────────────────
    getShifts: builder.query<{ success: boolean; data: Shift[] }, void>({
      query: () => ({ url: '/shifts', method: 'GET' }),
      providesTags: ['Shift'],
    }),
    createShift: builder.mutation<any, Partial<Shift>>({
      query: (shiftData) => ({ url: '/shifts', method: 'POST', data: shiftData }),
      invalidatesTags: ['Shift'],
    }),
    deleteShift: builder.mutation<any, string>({
      query: (id) => ({ url: `/shifts/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Shift'],
    }),
    assignShift: builder.mutation<any, {
      shiftId: string;
      employeeId: string;
      scheduleType?: 'ALL_DAYS' | 'SPECIFIC_DATES';
      effectiveFrom?: string;
      effectiveTo?: string | null;
    }>({
      query: (data) => ({ url: '/shifts/assignments', method: 'POST', data }),
      invalidatesTags: ['Shift', 'Employee', 'Department'],
    }),

    // ── Attendance ─────────────────────────────────────────────────────────────
    checkIn: builder.mutation<any, { location?: { latitude: number; longitude: number } } | void>({
      query: (body) => ({ url: '/attendance/check-in', method: 'POST', data: body || {} }),
      invalidatesTags: ['Attendance', 'Employee'],
    }),
    checkOut: builder.mutation<any, { location?: { latitude: number; longitude: number } } | void>({
      query: (body) => ({ url: '/attendance/check-out', method: 'POST', data: body || {} }),
      invalidatesTags: ['Attendance', 'Employee'],
    }),
    getMyAttendance: builder.query<{
      success: boolean;
      data: AttendanceRecord[];
      todayAttendance?: AttendanceRecord | null;
      assignedShift?: { _id: string; name: string; startTime: string; endTime: string } | null;
    }, void>({
      query: () => ({ url: '/attendance/me', method: 'GET' }),
      providesTags: ['Attendance'],
    }),
    requestAttendanceCorrection: builder.mutation<any, { attendanceId: string; reason: string }>({
      query: (data) => ({ url: '/attendance/corrections', method: 'POST', data }),
      invalidatesTags: ['Attendance'],
    }),
    getAttendanceCorrections: builder.query<{ success: boolean; data: any[] }, void>({
      query: () => ({ url: '/attendance/corrections', method: 'GET' }),
      providesTags: ['Attendance'],
    }),
    reviewAttendanceCorrection: builder.mutation<any, { id: string; action: 'approved' | 'rejected' | 'APPROVED' | 'REJECTED'; reviewRemarks?: string; reason?: string }>({
      query: ({ id, action, reviewRemarks, reason }) => ({
        url: `/attendance/corrections/${id}/review`,
        method: 'PATCH',
        data: { action, reviewRemarks: reviewRemarks || reason },
      }),
      invalidatesTags: ['Attendance'],
    }),

    // ── Leaves ─────────────────────────────────────────────────────────────────
    getLeaveTypes: builder.query<{ success: boolean; data: any[] }, void>({
      query: () => ({ url: '/leaves/types', method: 'GET' }),
      providesTags: ['Leave'],
    }),
    createLeaveType: builder.mutation<any, { name: string; code: string; defaultDaysAllowed: number }>({
      query: (data) => ({ url: '/leaves/types', method: 'POST', data }),
      invalidatesTags: ['Leave'],
    }),
    getMyLeaveBalances: builder.query<{ success: boolean; data: any[] }, void>({
      query: () => ({ url: '/leaves/balances/me', method: 'GET' }),
      providesTags: ['Leave'],
    }),
    applyLeave: builder.mutation<any, FormData | { leaveTypeId: string; startDate: string; endDate: string; reason: string }>({
      query: (data) => ({ url: '/leaves/requests', method: 'POST', data }),
      invalidatesTags: ['Leave', 'Employee'],
    }),
    getAllLeaveRequests: builder.query<{ success: boolean; data: LeaveRequest[] }, { status?: string } | void>({
      query: (params) => ({ url: '/leaves/requests', method: 'GET', params: params || {} }),
      providesTags: ['Leave'],
    }),
    reviewLeaveRequest: builder.mutation<any, { id: string; action: 'approved' | 'rejected' | 'APPROVED' | 'REJECTED'; rejectionReason?: string; reason?: string; remarks?: string }>({
      query: ({ id, action, rejectionReason, reason, remarks }) => ({
        url: `/leaves/requests/${id}/review`,
        method: 'PATCH',
        data: {
          action: typeof action === 'string' ? action.toUpperCase() : action,
          rejectionReason: rejectionReason || reason || remarks,
        },
      }),
      invalidatesTags: ['Leave', 'Employee'],
    }),

    // ── Performance Management ─────────────────────────────────────────────────
    getEmployeePerformanceHistory: builder.query<{ success: boolean; data: PerformanceEvaluation[] }, string>({
      query: (employeeId) => ({ url: `/performance/employees/${employeeId}`, method: 'GET' }),
      providesTags: ['Performance'],
    }),
    submitEvaluation: builder.mutation<any, {
      employeeId: string;
      reviewPeriodStart: string;
      reviewPeriodEnd: string;
      qualityOfWork: number;
      punctuality: number;
      evaluatorComments: string;
    }>({
      query: (data) => ({ url: '/performance/evaluations', method: 'POST', data }),
      invalidatesTags: ['Performance'],
    }),
    submitPerformanceAppeal: builder.mutation<any, { evaluationId: string; appealReason: string }>({
      query: (data) => ({ url: '/performance/appeals', method: 'POST', data }),
      invalidatesTags: ['Performance'],
    }),
    reviewPerformanceAppeal: builder.mutation<any, { id: string; action: 'approved' | 'rejected'; reviewRemarks?: string }>({
      query: ({ id, ...data }) => ({
        url: `/performance/appeals/${id}/review`,
        method: 'PATCH',
        data,
      }),
      invalidatesTags: ['Performance'],
    }),

    // ── Promotions ─────────────────────────────────────────────────────────────
    getAllPromotionRequests: builder.query<{ success: boolean; data: any[] }, { status?: string; departmentId?: string } | void>({
      query: (params) => ({ url: '/promotions/requests', method: 'GET', params: params || {} }),
      providesTags: ['Promotion'],
    }),
    getPromotionHistory: builder.query<{ success: boolean; data: PromotionRequest[] }, string>({
      query: (employeeId) => ({ url: `/promotions/history/${employeeId}`, method: 'GET' }),
      providesTags: ['Promotion'],
    }),
    requestPromotion: builder.mutation<any, {
      employeeId?: string;
      requestedDesignation?: string;
      requestedRank?: string;
      proposedDesignation?: string;
      proposedDepartmentId?: string;
      justification: string;
      requestType?: 'self' | 'supervisor_recommendation';
    }>({
      query: (data) => ({ url: '/promotions/requests', method: 'POST', data }),
      invalidatesTags: ['Promotion'],
    }),
    reviewPromotion: builder.mutation<any, { id: string; action: 'APPROVED' | 'REJECTED' | 'approved' | 'rejected'; rejectionReason?: string; reviewRemarks?: string }>({
      query: ({ id, action, ...data }) => ({
        url: `/promotions/requests/${id}/review`,
        method: 'PATCH',
        data: {
          ...data,
          action: String(action).toUpperCase()
        },
      }),
      invalidatesTags: ['Promotion', 'Employee'],
    }),

    // ── Employee Transfers ─────────────────────────────────────────────────────
    getEmployeeTransfers: builder.query<{ success: boolean; data: any[] }, { status?: string; departmentId?: string } | void>({
      query: (params) => ({ url: '/employee-transfers', method: 'GET', params: params || {} }),
      providesTags: ['Transfer'],
    }),
    requestTransfer: builder.mutation<any, {
      employeeId: string;
      targetDepartmentId: string;
      reason: string;
      effectiveDate?: string;
    }>({
      query: (data) => ({ url: '/employee-transfers', method: 'POST', data }),
      invalidatesTags: ['Transfer', 'Department', 'Employee'],
    }),
    reviewTransfer: builder.mutation<any, { id: string; action: 'APPROVED' | 'REJECTED' | 'approved' | 'rejected'; rejectionReason?: string; reviewRemarks?: string }>({
      query: ({ id, ...data }) => ({
        url: `/employee-transfers/${id}/review`,
        method: 'PATCH',
        data,
      }),
      invalidatesTags: ['Transfer', 'Employee', 'Complaint', 'Department'],
    }),

    // ── Disciplinary & Warnings ───────────────────────────────────────────────
    getAllDisciplinaryCases: builder.query<{ success: boolean; data: { cases: any[]; suspensions: any[] } }, { employeeId?: string } | void>({
      query: (params) => ({ url: '/disciplinary/cases', method: 'GET', params: params || {} }),
      providesTags: ['Disciplinary'],
    }),
    getFormalWarnings: builder.query<{ success: boolean; data: any[] }, { employeeId?: string; viewMode?: string } | void>({
      query: (params) => ({ url: '/disciplinary/warnings', method: 'GET', params: params || {} }),
      providesTags: ['Disciplinary'],
    }),
    issueFormalWarning: builder.mutation<any, FormData | {
      employeeId: string;
      category: string;
      severity: string;
      subject: string;
      details: string;
      actionRequired?: string;
    }>({
      query: (data) => ({
        url: '/disciplinary/warnings',
        method: 'POST',
        data,
      }),
      invalidatesTags: ['Disciplinary', 'Employee'],
    }),
    createDisciplinaryCase: builder.mutation<any, {
      employeeId: string;
      title: string;
      description: string;
      severity: string;
    }>({
      query: (data) => ({ url: '/disciplinary/cases', method: 'POST', data }),
      invalidatesTags: ['Disciplinary'],
    }),
    recordSuspension: builder.mutation<any, {
      id: string;
      suspensionDays: number;
      reason: string;
    }>({
      query: ({ id, ...data }) => ({
        url: `/disciplinary/cases/${id}/suspension`,
        method: 'POST',
        data,
      }),
      invalidatesTags: ['Disciplinary', 'Employee'],
    }),
    recordReinstatement: builder.mutation<any, {
      id: string;
      reinstatementReason: string;
    }>({
      query: ({ id, ...data }) => ({
        url: `/disciplinary/cases/${id}/reinstatement`,
        method: 'POST',
        data,
      }),
      invalidatesTags: ['Disciplinary', 'Employee'],
    }),

    // ── Audit Logs ─────────────────────────────────────────────────────────────
    getAuditLogs: builder.query<any, { page?: number; limit?: number; entityType?: string; action?: string } | void>({
      query: (params) => ({ url: '/dashboard/audit-logs', method: 'GET', params: params || {} }),
      providesTags: ['Audit'],
    }),

    // ── Department Head Attendance ─────────────────────────────────────────────
    getDepartmentAttendance: builder.query<{
      success: boolean;
      data: {
        records: any[];
        insights: {
          totalTimeSpent: string;
          averageCheckInTime: string;
          averageCheckOutTime: string;
          averageDuration: string;
          totalAbsences: number;
        };
        staff: any[];
      };
    }, { employeeId?: string; month?: number; year?: number } | void>({
      query: (params) => ({
        url: '/attendance/department',
        method: 'GET',
        params: params || {},
      }),
      providesTags: ['Attendance'],
    }),
  }),
});

export const {
  useGetHRDashboardStatsQuery,
  useGetEmployeesQuery,
  useGetEmployeeByIdQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useUpdateEmploymentStatusMutation,
  useGetEmployeeDocumentsQuery,
  useGetShiftsQuery,
  useCreateShiftMutation,
  useDeleteShiftMutation,
  useAssignShiftMutation,
  useCheckInMutation,
  useCheckOutMutation,
  useGetMyAttendanceQuery,
  useRequestAttendanceCorrectionMutation,
  useGetAttendanceCorrectionsQuery,
  useReviewAttendanceCorrectionMutation,
  useGetLeaveTypesQuery,
  useCreateLeaveTypeMutation,
  useGetMyLeaveBalancesQuery,
  useApplyLeaveMutation,
  useGetAllLeaveRequestsQuery,
  useReviewLeaveRequestMutation,
  useGetEmployeePerformanceHistoryQuery,
  useSubmitEvaluationMutation,
  useSubmitPerformanceAppealMutation,
  useReviewPerformanceAppealMutation,
  useGetAllPromotionRequestsQuery,
  useGetPromotionHistoryQuery,
  useRequestPromotionMutation,
  useReviewPromotionMutation,
  useGetEmployeeTransfersQuery,
  useRequestTransferMutation,
  useReviewTransferMutation,
  useGetAllDisciplinaryCasesQuery,
  useGetFormalWarningsQuery,
  useIssueFormalWarningMutation,
  useCreateDisciplinaryCaseMutation,
  useRecordSuspensionMutation,
  useRecordReinstatementMutation,
  useGetAuditLogsQuery,
  useGetDepartmentAttendanceQuery,
} = hrApi;
