import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  username?: string;
  fullName?: string;
  bio?: string;
  website?: string;
  twitter?: string;
  instagram?: string;
  profileImage?: string | null;

  notifications?: {
    email: boolean;
    sales: boolean;
    bids: boolean;
    exhibitions: boolean;
  };

  verified: boolean;
  verificationCode?: string;
  verificationExpiry?: Date;

  walletBalance: number;
  wethBalance: number;

  resetPasswordCode?: string;
  resetPasswordToken?: string;
  resetPasswordExpiry?: Date;

  createdAt: Date;
  updatedAt: Date;
}


const UserSchema = new Schema<IUser>({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },

  password: { 
    type: String, 
    required: true 
  },

  username: { 
    type: String,
    trim: true
  },

  fullName: {
    type: String,
    trim: true
  },

  bio: {
    type: String,
    default: ''
  },

  website: {
    type: String,
    trim: true
  },

  twitter: {
    type: String,
    trim: true
  },

  instagram: {
    type: String,
    trim: true
  },

  profileImage: {
    type: String,
    default: null
  },

  notifications: {
    email: { type: Boolean, default: true },
    sales: { type: Boolean, default: true },
    bids: { type: Boolean, default: true },
    exhibitions: { type: Boolean, default: true }
  },

  verified: { 
    type: Boolean, 
    default: false 
  },

  verificationCode: { 
    type: String 
  },

  verificationExpiry: { 
    type: Date 
  },

  walletBalance: {
    type: Number,
    default: 0
  },

  wethBalance: {
    type: Number,
    default: 0
  },

  resetPasswordCode: {
    type: String
  },

  resetPasswordToken: {
    type: String
  },

  resetPasswordExpiry: {
    type: Date
  }
}, { 
  timestamps: true 
});


export default mongoose.model<IUser>('User', UserSchema);
