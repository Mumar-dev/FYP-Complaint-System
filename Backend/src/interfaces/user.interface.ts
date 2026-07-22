import { Document, Types } from 'mongoose';

export interface IAddress {
  block: string;
  houseNumber: string;
  street?: string;
}

export interface IUserProfile {
  fullName?: string;
  phone?: string;
  phoneNumber?: string;
  cnic?: string;
  proofDocumentUrl?: string;
  position?: string;
  avatar?: string;
  profileImage?: string;
  address?: IAddress;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
}

export type UserRole = 'admin' | 'superadmin' | 'department_head' | 'supervisor' | 'staff' | 'resident';

export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'RESIGNED' | 'TERMINATED';

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'probation';

export interface IStatusHistory {
  status: 'active' | 'pending' | 'suspended';
  changedAt: Date;
  reason?: string;
}

export interface IUser extends Document {
  email: string;
  password?: string;
  role: UserRole;
  rank?: 'junior' | 'senior' | 'team_lead' | 'lead' | 'supervisor' | 'head';
  previousRank?: string;
  accountStatus: 'active' | 'pending' | 'suspended';
  statusHistory: IStatusHistory[];
  applicationVersion: number;
  rejectionReason?: string;
  lastAppliedAt?: Date;
  approvedBy?: Types.ObjectId | string;
  rejectedBy?: Types.ObjectId | string;
  profile: IUserProfile;
  departmentId?: Types.ObjectId | string; // Used if user belongs to a department

  // HR Extension Fields (Unified CMS Employee Identity)
  employeeId?: string; // Formatted unique readable string: e.g. EMP-2026-0001
  designation?: string;
  employmentStatus?: EmploymentStatus;
  employmentType?: EmploymentType;
  joiningDate?: Date;

  lastLogin?: Date;
  socketId?: string;
  refreshToken?: string;
  resetOTP?: string;
  resetOTPExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}
