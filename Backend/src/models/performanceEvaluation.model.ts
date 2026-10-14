import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPerformanceEvaluation extends Document {
  employeeId: Types.ObjectId; // References User._id
  evaluatorId: Types.ObjectId; // References User._id (Supervisor/Manager)
  periodStart: Date;
  periodEnd: Date;
  
  // Normalized multi-factor scores (each 0 - 100)
  factors: {
    resolutionQuality: number;
    timeliness: number;
    residentSatisfaction: number;
    attendancePunctuality: number;
    reopenedComplaintRatio: number;
    supervisorFeedbackScore: number;
    complexityWorkloadScore: number;
  };

  weightedTotalScore: number; // 0 - 100
  performanceCategory: 'TOP_PERFORMER' | 'HIGH_PERFORMANCE' | 'MODERATE_PERFORMANCE' | 'NEEDS_IMPROVEMENT';
  
  hasSufficientData: boolean;
  sampleSize: number; // Number of complaints evaluated in period
  supervisorNotes: string;
  isPublished: boolean;
  publishedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const performanceEvaluationSchema = new Schema<IPerformanceEvaluation>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    evaluatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    factors: {
      resolutionQuality: { type: Number, default: 0, min: 0, max: 100 },
      timeliness: { type: Number, default: 0, min: 0, max: 100 },
      residentSatisfaction: { type: Number, default: 0, min: 0, max: 100 },
      attendancePunctuality: { type: Number, default: 0, min: 0, max: 100 },
      reopenedComplaintRatio: { type: Number, default: 0, min: 0, max: 100 },
      supervisorFeedbackScore: { type: Number, default: 0, min: 0, max: 100 },
      complexityWorkloadScore: { type: Number, default: 0, min: 0, max: 100 }
    },
    weightedTotalScore: { type: Number, required: true, min: 0, max: 100 },
    performanceCategory: {
      type: String,
      enum: ['TOP_PERFORMER', 'HIGH_PERFORMANCE', 'MODERATE_PERFORMANCE', 'NEEDS_IMPROVEMENT'],
      required: true
    },
    hasSufficientData: { type: Boolean, default: true },
    sampleSize: { type: Number, default: 0 },
    supervisorNotes: { type: String, required: true },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date }
  },
  { timestamps: true }
);

performanceEvaluationSchema.index({ employeeId: 1, periodStart: 1, periodEnd: 1 });

export const PerformanceEvaluation = mongoose.model<IPerformanceEvaluation>(
  'PerformanceEvaluation',
  performanceEvaluationSchema
);

