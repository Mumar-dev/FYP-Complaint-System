import { Document, Types } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  code?: string;
  keywords: string[];
  slaTargetHours: number;
  description?: string;
  positions?: string[];
  headOfDepartment?: Types.ObjectId;
  isActive: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}