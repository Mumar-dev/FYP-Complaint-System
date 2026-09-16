import { createApi } from '@reduxjs/toolkit/query/react';
import { customBaseQuery } from './customBaseQuery';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: customBaseQuery(),
  tagTypes: ['Auth', 'User', 'Complaint', 'Notification', 'Department', 'Staff', 'Employee', 'Shift', 'Attendance', 'Leave', 'Performance', 'Promotion', 'Transfer', 'Disciplinary', 'SLA', 'Audit'],
  endpoints: () => ({}), // Endpoints will be injected from feature slices
});
