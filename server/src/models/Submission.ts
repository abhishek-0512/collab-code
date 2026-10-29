import mongoose, { Document, Schema } from 'mongoose';

export interface ISubmission extends Document {
  roomId: string;
  userId: mongoose.Types.ObjectId;
  problemId?: mongoose.Types.ObjectId;
  problemSlug?: string;
  judgeVersion?: string;
  language: string;
  code: string;
  status: 'pending' | 'running' | 'accepted' | 'wrong_answer' | 'time_limit' | 'runtime_error' | 'compile_error' | 'judge_error';
  output?: string;
  error?: string;
  executionTimeMs?: number;
  memoryUsedKb?: number;
  testResults?: Array<{ passed: boolean; input: string; expected: string; actual: string }>;
  createdAt: Date;
}

const submissionSchema = new Schema<ISubmission>(
  {
    roomId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    problemId: { type: Schema.Types.ObjectId, ref: 'Problem' },
      problemSlug: { type: String, index: true },
      judgeVersion: String,
    language: { type: String, required: true },
    code: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'accepted', 'wrong_answer', 'time_limit', 'runtime_error', 'compile_error', 'judge_error'],
      default: 'pending',
    },
    output: String,
    error: String,
    executionTimeMs: Number,
    memoryUsedKb: Number,
    testResults: [
      {
        passed: Boolean,
        input: String,
        expected: String,
        actual: String,
      },
    ],
  },
  { timestamps: true }
);

export const Submission = mongoose.model<ISubmission>('Submission', submissionSchema);
