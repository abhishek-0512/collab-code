import mongoose, { Document, Schema } from 'mongoose';

export type RoomLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'go' | 'rust';

export interface IRoom extends Document {
  roomId: string;
  name: string;
  description?: string;
  language: RoomLanguage;
  code: string;
  ownerId: mongoose.Types.ObjectId;
  isPrivate: boolean;
  inviteCode: string;
  members: mongoose.Types.ObjectId[];
  problemId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500 },
    language: {
      type: String,
      enum: ['javascript', 'typescript', 'python', 'java', 'cpp', 'go', 'rust'],
      default: 'javascript',
    },
    code: { type: String, default: '' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isPrivate: { type: Boolean, default: true },
    inviteCode: { type: String, required: true, unique: true, index: true },
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    problemId: { type: Schema.Types.ObjectId, ref: 'Problem' },
  },
  { timestamps: true }
);

export const Room = mongoose.model<IRoom>('Room', roomSchema);
