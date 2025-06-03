import mongoose, { Document, Schema } from 'mongoose';

export interface IEmail extends Document {
  from: { name: string; email: string };
  to: { name: string; email: string }[];
  subject: string;
  body: string;
  receivedAt: string; // ISO string
  raw: string;
  credential: mongoose.Types.ObjectId; // Reference to EmailCredential
  category: 'Interested' | 'Meeting Booked' | 'Not Interested' | 'Spam' | 'Out of Office';
  folder: string;
  snippet?: string;
  read?: boolean;
  starred?: boolean;
  hasAttachments?: boolean;
  attachments?: any[];
  messageId?: string; // <-- add this line
}

const EmailSchema = new Schema<IEmail>({
  from: {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  to: [
    {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
    }
  ],
  subject: { type: String },
  body: { type: String },
  receivedAt: { type: String, default: () => new Date().toISOString() },
  credential: { type: Schema.Types.ObjectId, ref: 'EmailCredential', required: true },
  category: {
    type: String,
    enum: ['Interested', 'Meeting Booked', 'Not Interested', 'Spam', 'Out of Office'],
    default: 'Interested'
  },
  folder: { type: String, default: 'inbox' },
  snippet: { type: String },
  read: { type: Boolean },
  starred: { type: Boolean },
  hasAttachments: { type: Boolean },
  attachments: { type: Array, default: [] },
  messageId: { type: String, index: true }, // <-- add this line
}, {
  timestamps: true, // Automatically add createdAt and updatedAt fields
});

export default mongoose.model<IEmail>('Email', EmailSchema);
