import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEmployeeDocument extends Document {
  employeeId: Types.ObjectId; // References User._id
  documentType: 'cnic' | 'appointment_letter' | 'educational_certificate' | 'experience_certificate' | 'agreement' | 'other';
  title: string;
  documentUrl: string;
  fileSize?: number;
  mimeType?: string;
  uploadedBy: Types.ObjectId;
  isConfidential: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const employeeDocumentSchema = new Schema<IEmployeeDocument>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    documentType: {
      type: String,
      enum: ['cnic', 'appointment_letter', 'educational_certificate', 'experience_certificate', 'agreement', 'other'],
      required: true
    },
    title: { type: String, required: true },
    documentUrl: { type: String, required: true },
    fileSize: { type: Number },
    mimeType: { type: String },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isConfidential: { type: Boolean, default: true },
    version: { type: Number, default: 1 }
  },
  { timestamps: true }
);

employeeDocumentSchema.index({ employeeId: 1, documentType: 1 });

export const EmployeeDocument = mongoose.model<IEmployeeDocument>(
  'EmployeeDocument',
  employeeDocumentSchema
);

