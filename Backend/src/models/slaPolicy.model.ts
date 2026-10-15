import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISLAPolicy extends Document {
  name: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetHours: number;
  warningThresholdPercent: number; // e.g. 80% to issue early warning
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const slaPolicySchema = new Schema<ISLAPolicy>(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true
    },
    targetHours: { type: Number, required: true, min: 1 },
    warningThresholdPercent: { type: Number, default: 80, min: 1, max: 100 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

slaPolicySchema.index({ category: 1, priority: 1 }, { unique: true });

export const SLAPolicy = mongoose.model<ISLAPolicy>('SLAPolicy', slaPolicySchema);

