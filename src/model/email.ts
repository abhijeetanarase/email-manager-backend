import mongoose, { Document, Schema } from 'mongoose';

export interface IEmail extends Document {
  from: { name: string; email: string };
  to: { name: string; email: string }[];
  subject: string;
  body: string;
  receivedAt: string; // ISO string
  raw: string;
  credential: mongoose.Types.ObjectId; // Reference to EmailCredential
  purpose: 'Personal' | 'Work' | 'Transactional' | 'Promotional' |'Newsletter' | 'Notification' | 'Spam';
  senderType : 'Human' | 'Automated' | 'Company';
  contentType?: 'Text-only' | 'Media-rich' | 'Interactive';
  priority?: 'Urgent' | 'High' | 'Normal' | 'Low';
  actionRequired?: 'Immediate Action' | 'Follow-up Needed' | 'Read Later' | 'Informational Only';
  topicDepartment?: string; 
  timeSensitivity?: 'Time-sensitive' | 'Evergreen';
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
  purpose: { type: String, enum: ['Personal', 'Work', 'Transactional', 'Promotional', 'Newsletter', 'Notification', 'Spam'], default: 'Personal' },
  senderType: { type: String, enum: ["Human", "Automated", "Company"]
, default: "Human" },
  contentType: { type: String, enum: ['Text-only', 'Media-rich', 'Interactive'], default: 'Text-only' },
  priority: { type: String, enum: ['Urgent', 'High', 'Normal', 'Low'], default: 'Normal' },
  actionRequired: { type: String, enum: ['Immediate Action', 'Follow-up Needed', 'Read Later', 'Informational Only'], default: 'Informational Only' },
  topicDepartment: { type: String, default: '' },
  timeSensitivity: { type: String, enum: ['Time-sensitive', 'Evergreen'], default: 'Evergreen' },
  subject: { type: String },
  body: { type: String },
  receivedAt: { type: String, default: () => new Date().toISOString() },
  credential: { type: Schema.Types.ObjectId, ref: 'EmailCredential', required: true },
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
