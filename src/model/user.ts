import mongoose, { Document, Schema } from 'mongoose';

// 1. Define an interface representing a User document in MongoDB
export interface IUser extends Document {
  name: string;
  email: string;
  googleId?: string;
  createdAt: Date;
  picture?: string; // Optional field for profile image URL
}

// 2. Create the schema
const UserSchema: Schema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    picture:{
      type: String,
      
    }
  },
  { timestamps: true } // automatically add createdAt and updatedAt
);

// 3. Create and export the model
const User = mongoose.model<IUser>('User', UserSchema);
export default User;
