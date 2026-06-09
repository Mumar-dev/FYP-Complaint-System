/**
 * TypeScript type definitions for department-related API responses.
 */

export interface Department {
  _id: string;
  name: string;
  description?: string;
  slaTargetHours: number;
  headOfDepartment: {
    _id: string;
    profile: { fullName: string };
    email: string;
  } | null;
  isActive: boolean;
  keywords: string[];
  positions: string[];
  staffCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentStaff {
  _id: string;
  email: string;
  role: string;
  rank: string;
  profile: {
    fullName: string;
    phone?: string;
    cnic: string;
    avatar?: string;
  };
  createdAt: string;
}

export interface DepartmentResponse {
  success: boolean;
  message: string;
  data: Department[];
}

export interface DepartmentStaffResponse {
  success: boolean;
  message: string;
  data: DepartmentStaff[];
}
