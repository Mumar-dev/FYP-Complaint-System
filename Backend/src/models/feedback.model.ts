import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFeedback extends Document {
  complaintId: Types.ObjectId;
  residentId: Types.ObjectId;
  rating: number; // 1 to 5
  comments?: string;
  createdAt: Date;
  updatedAt: Date;
}

const feedbackSchema = new Schema<IFeedback>(
  {
    complaintId: { type: Schema.Types.ObjectId, ref: 'Complaint', required: true, unique: true, index: true },
    residentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comments: { type: String, trim: true }
  },
  { timestamps: true }
);

feedbackSchema.index({ residentId: 1, createdAt: -1 });

export const Feedback = mongoose.model<IFeedback>('Feedback', feedbackSchema);

