import mongoose, { Document, Schema } from 'mongoose';

export interface ITestCase {
  input: string;
  expectedOutput: string;
  isHidden: boolean;
}

export interface IProblemJudgeSpec {
  mode: 'stdio' | 'function';
  functionName?: string;
  className?: string;
  parameterTypes?: string[];
  returnType?: string;
  comparison: 'exact' | 'json' | 'numeric' | 'unordered_array';
}

export interface IProblem extends Document {
  slug: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tags: string[];
  constraints: string;
  examples: Array<{ input: string; output: string; explanation?: string }>;
  testCases: ITestCase[];
  starterCode: Record<string, string>;
  judgeSpec?: IProblemJudgeSpec;
  createdAt: Date;
  updatedAt: Date;
}

const problemSchema = new Schema<IProblem>(
  {
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
    judgeSpec: {
      mode: { type: String, enum: ['stdio', 'function'], default: 'function' },
      functionName: String,
      className: String,
      parameterTypes: [String],
      returnType: String,
      comparison: {
        type: String,
        enum: ['exact', 'json', 'numeric', 'unordered_array'],
        default: 'json',
      },
    },
  },
  { timestamps: true }
);

export const Problem = mongoose.model<IProblem>('Problem', problemSchema);
