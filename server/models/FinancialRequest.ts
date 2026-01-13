import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IFinancialRequest extends Document {
  userId: Types.ObjectId;
  type: 'deposit' | 'withdrawal';
  amount: number;
  currency: string;
   owner: string;
  walletAddress?: string;
  transactionHash?: string;
  status: 'pending' | 'approved' | 'declined';
  adminNote?: string;
  processedBy?: Types.ObjectId;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FinancialRequestSchema = new Schema<IFinancialRequest>({
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['deposit', 'withdrawal'], 
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    default: 'ETH' 
  },
  walletAddress: { 
    type: String 
  },
  owner: { 
    type: String 
  },
  transactionHash: { 
    type: String 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'declined'], 
    default: 'pending' 
  },
  adminNote: { 
    type: String 
  },
  processedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'Admin' 
  },
  processedAt: { 
    type: Date 
  }
}, { 
  timestamps: true 
});

export const FinancialRequest = mongoose.model<IFinancialRequest>('FinancialRequest', FinancialRequestSchema);
