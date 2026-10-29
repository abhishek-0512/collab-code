import mongoose, { Document, Schema } from 'mongoose';

export interface ITestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface IProblem extends Document {
  problemId?: string;
  slug: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  constraints: string;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  testCases: ITestCase[];
  starterCode: Record<string, string>;
  problemType?: 'function' | 'stdin';
  supportedLanguages?: string[];
  comparatorType?: 'exact' | 'json' | 'unordered_array' | 'token';
  judgeStatus?: 'VERIFIED' | 'NEEDS_TESTS' | 'NEEDS_HARNESS' | 'UNSUPPORTED' | 'DISABLED';
  judgeVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

const problemSchema = new Schema<IProblem>(
  {
    problemId: { type: String, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true, index: true },
    tags: [String],
    constraints: { type: String, default: '' },
    examples: [
      {
        input: String,
        output: String,
        explanation: String,
      },
    ],
    testCases: [
      {
        input: String,
        expectedOutput: String,
        isHidden: { type: Boolean, default: false },
      },
    ],
    starterCode: { type: Map, of: String, default: {} },
    problemType: { type: String, enum: ['function', 'stdin'], default: 'function' },
    supportedLanguages: { type: [String], default: [] },
    comparatorType: { type: String, enum: ['exact', 'json', 'unordered_array', 'token'], default: 'exact' },
    judgeStatus: {
      type: String,
      enum: ['VERIFIED', 'NEEDS_TESTS', 'NEEDS_HARNESS', 'UNSUPPORTED', 'DISABLED'],
      default: 'NEEDS_TESTS',
    },
    judgeVersion: { type: String, default: '1' },
  },
  { timestamps: true }
);

export const Problem = mongoose.model<IProblem>('Problem', problemSchema);
