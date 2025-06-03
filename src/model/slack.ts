import mongoose, { Schema, model, Document } from 'mongoose';
import { ref } from 'process';

export interface ISlackToken extends Document {
 createdBy : mongoose.ObjectId
  team_id: string;
  team_name?: string;
  access_token: string;
  bot_user_id?: string;
  authed_user_id?: string;
  scope?: string;
  installed_at?: Date;
}

const SlackTokenSchema = new Schema<ISlackToken>({
 createdBy : {
    type : Schema.Types.ObjectId,
    ref : "User"},
  team_id: {
    type: String,
    required: true,
    unique: true
  },
  team_name: {
    type: String
  },
  access_token: {
    type: String,
    required: true
  },
  bot_user_id: {
    type: String
  },
  authed_user_id: {
    type: String
  },
  scope: {
    type: String
  },
  installed_at: {
    type: Date,
    default: Date.now
  }
});

export default model<ISlackToken>('SlackToken', SlackTokenSchema);
