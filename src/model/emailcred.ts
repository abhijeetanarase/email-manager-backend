import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailCredential extends Document {
  _id: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  email: string;
  password: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  provider: string; // e.g., 'Gmail', 'Outlook', etc.
  unread?: number; // Optional field to track if there are new emails
}

const EmailCredentialSchema = new Schema<IEmailCredential>(
  { 
    createdBy : { type: Schema.Types.ObjectId, ref: 'User',required: true },
    email: { type: String, required: true },
    password: { type: String, required: true , select: false }, // Password should not be returned in queries
    active: { type: Boolean, default: true },
    provider: { type: String, default: 'Gmail' },
    unread: { type: Number, default: 0 }, // Optional field to track new emails
  },
  { timestamps: true }
);

export default mongoose.model<IEmailCredential>('EmailCredential', EmailCredentialSchema);
