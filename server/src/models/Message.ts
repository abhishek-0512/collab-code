import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
  roomId: string;
  userId?: mongoose.Types.ObjectId;
  username: string;
  content: string;
  type: 'chat' | 'system';
  audioUrl?: string;
  isVoiceTranscribed?: boolean;
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    roomId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    username: { type: String, required: true },
    content: { type: String, required: true, maxlength: 5000 },
    type: { type: String, enum: ['chat', 'system'], default: 'chat' },
    audioUrl: { type: String },
    isVoiceTranscribed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Message = mongoose.model<IMessage>('Message', messageSchema);
